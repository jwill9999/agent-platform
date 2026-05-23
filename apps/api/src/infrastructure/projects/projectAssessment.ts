import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, sep } from 'node:path';

import {
  ProjectOnboardingAssessmentSchema,
  transitionProjectOnboardingState,
  type ProjectCapability,
  type ProjectInstructionFileReference,
  type ProjectOnboardingAssessment,
  type ProjectOnboardingCommand,
  type ProjectOnboardingEvidenceFile,
  type ProjectOnboardingGap,
  type ProjectOnboardingQuestion,
  type ProjectOnboardingState,
  type ProjectProfile,
  type ProjectSubprojectScope,
} from '@agent-platform/contracts';

import { discoverProjectInstructions } from './projectInstructions.js';

const MAX_EVIDENCE_FILES = 80;
const MAX_SCAN_DEPTH = 4;
const MAX_TEXT_READ_CHARS = 20_000;
const SKIPPED_DIRS = new Set([
  '.git',
  '.next',
  'coverage',
  'dist',
  'build',
  'node_modules',
  'playwright-report',
  'test-results',
]);

type EvidenceKind = ProjectOnboardingEvidenceFile['kind'];

type FileEvidence = {
  path: string;
  kind: EvidenceKind;
};

type AssessmentInput = {
  projectId: string;
  projectName: string;
  projectRoot: string;
  repositoryRoot: string;
  activeBranch?: string;
  currentState: ProjectOnboardingState;
  existingInstructionFiles: readonly ProjectInstructionFileReference[];
  nowMs?: number;
};

type PackageManifest = {
  path: string;
  packageName?: string;
  packageManager: PackageManager;
  scripts: Record<string, string>;
};

type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

function toRelativeProjectPath(root: string, filePath: string): string {
  return relative(root, filePath).split(sep).join('/');
}

function isSkippedDir(name: string): boolean {
  return SKIPPED_DIRS.has(name) || name.startsWith('.');
}

function scanEvidenceFiles(root: string): FileEvidence[] {
  const evidence: FileEvidence[] = [];
  const visit = (dir: string, depth: number) => {
    if (depth > MAX_SCAN_DEPTH || evidence.length >= MAX_EVIDENCE_FILES) return;

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (evidence.length >= MAX_EVIDENCE_FILES) return;
      const filePath = join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!isSkippedDir(entry.name)) visit(filePath, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;

      const kind = evidenceKindFor(entry.name);
      if (!kind) continue;
      evidence.push({ path: toRelativeProjectPath(root, filePath), kind });
    }
  };

  visit(root, 0);
  return evidence;
}

function evidenceKindFor(name: string): EvidenceKind | undefined {
  if (name === 'AGENTS.md') return 'instructions';
  if (name === 'package.json' || name.endsWith('.csproj') || name.endsWith('.sln')) {
    return 'manifest';
  }
  if (
    name === 'pnpm-workspace.yaml' ||
    name === 'tsconfig.json' ||
    name === 'Dockerfile' ||
    name.startsWith('docker-compose') ||
    name.endsWith('.config.js') ||
    name.endsWith('.config.ts')
  ) {
    return 'config';
  }
  if (name.endsWith('.md') || name.endsWith('.mdx')) return 'docs';
  if (/\.(html|css)$/.test(name)) return 'source';
  if (/\.(ts|tsx|js|jsx|py|go|rs|java|kt|swift|cs)$/.test(name)) return 'source';
  if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(name)) return 'test';
  if (name.includes('cron') || name.includes('schedule')) return 'automation';
  return undefined;
}

function safeReadText(filePath: string): string | undefined {
  try {
    if (!statSync(filePath).isFile()) return undefined;
    const content = readFileSync(filePath, 'utf8');
    return content.length > MAX_TEXT_READ_CHARS
      ? `${content.slice(0, MAX_TEXT_READ_CHARS)}\n[Truncated]`
      : content;
  } catch {
    return undefined;
  }
}

function packageManagerFromPackageJson(value: unknown): PackageManager | undefined {
  if (typeof value !== 'string') return undefined;
  if (value.startsWith('pnpm@')) return 'pnpm';
  if (value.startsWith('yarn@')) return 'yarn';
  if (value.startsWith('bun@')) return 'bun';
  if (value.startsWith('npm@')) return 'npm';
  return undefined;
}

function detectPackageManager(
  root: string,
  manifestPath: string,
  packageManager: unknown,
): PackageManager {
  const manifestDir = dirname(join(root, manifestPath));
  const candidates = [manifestDir, root];
  for (const dir of candidates) {
    if (existsSync(join(dir, 'pnpm-lock.yaml')) || existsSync(join(dir, 'pnpm-workspace.yaml'))) {
      return 'pnpm';
    }
    if (existsSync(join(dir, 'yarn.lock'))) return 'yarn';
    if (existsSync(join(dir, 'bun.lockb')) || existsSync(join(dir, 'bun.lock'))) return 'bun';
    if (
      existsSync(join(dir, 'package-lock.json')) ||
      existsSync(join(dir, 'npm-shrinkwrap.json'))
    ) {
      return 'npm';
    }
  }
  return packageManagerFromPackageJson(packageManager) ?? 'npm';
}

function readPackageManifest(root: string, path: string): PackageManifest | undefined {
  const content = safeReadText(join(root, path));
  if (!content) return undefined;
  try {
    const parsed = JSON.parse(content) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined;
    const record = parsed as Record<string, unknown>;
    const rawScripts = record['scripts'];
    const scripts =
      typeof rawScripts === 'object' && rawScripts !== null && !Array.isArray(rawScripts)
        ? Object.fromEntries(
            Object.entries(rawScripts).filter(
              (entry): entry is [string, string] => typeof entry[1] === 'string',
            ),
          )
        : {};
    const name = record['name'];
    return {
      path,
      packageName: typeof name === 'string' && name.trim() ? name : undefined,
      packageManager: detectPackageManager(root, path, record['packageManager']),
      scripts,
    };
  } catch {
    return undefined;
  }
}

function inferCommands(manifests: readonly PackageManifest[]): ProjectOnboardingCommand[] {
  const commands: ProjectOnboardingCommand[] = [];
  for (const manifest of manifests) {
    for (const script of Object.keys(manifest.scripts)) {
      const entry = commandEntry(manifest, script);
      if (entry) commands.push(entry);
    }
  }
  return commands.slice(0, 20);
}

function commandEntry(
  manifest: PackageManifest,
  script: string,
): ProjectOnboardingCommand | undefined {
  const kind = commandKind(script);
  if (!kind) return undefined;

  const cwd = dirname(manifest.path);
  const path = cwd === '.' ? undefined : cwd;
  const entry: ProjectOnboardingCommand = {
    kind,
    command: packageCommand(manifest, script, path),
    confidence: manifest.packageName ? 0.85 : 0.65,
  };
  if (path) entry.path = path;
  if (manifest.packageName) entry.packageName = manifest.packageName;
  return entry;
}

function packageCommand(
  manifest: PackageManifest,
  script: string,
  path: string | undefined,
): string {
  if (!path) return rootPackageCommand(manifest.packageManager, script);
  const packageName = manifest.packageName ?? basename(path);
  switch (manifest.packageManager) {
    case 'pnpm':
      return `pnpm --filter ${packageName} ${script}`;
    case 'yarn':
      return `yarn --cwd ${path} ${script}`;
    case 'bun':
      return `bun --cwd ${path} run ${script}`;
    case 'npm':
      return `npm --prefix ${path} run ${script}`;
  }
}

function rootPackageCommand(packageManager: PackageManager, script: string): string {
  switch (packageManager) {
    case 'pnpm':
      return `pnpm ${script}`;
    case 'yarn':
      return `yarn ${script}`;
    case 'bun':
      return `bun run ${script}`;
    case 'npm':
      return `npm run ${script}`;
  }
}

function commandKind(script: string): ProjectOnboardingCommand['kind'] | undefined {
  const lower = script.toLowerCase();
  if (lower.includes('test')) return 'test';
  if (lower.includes('lint')) return 'lint';
  if (lower.includes('build')) return 'build';
  if (lower.includes('docker')) return 'container';
  if (lower.includes('dev') || lower.includes('start')) return 'run';
  return undefined;
}

function inferScopes(manifests: readonly PackageManifest[]): ProjectSubprojectScope[] {
  return manifests
    .filter((manifest) => manifest.path !== 'package.json')
    .map((manifest) => {
      const scope: ProjectSubprojectScope = { path: dirname(manifest.path) };
      if (manifest.packageName) scope.packageName = manifest.packageName;
      return scope;
    })
    .slice(0, 20);
}

function inferProfile(evidence: readonly FileEvidence[]): ProjectProfile {
  const hasSource = evidence.some((file) => file.kind === 'source' || file.kind === 'manifest');
  const hasDocs = evidence.some((file) => file.kind === 'docs');
  const hasAutomation = evidence.some(
    (file) => file.kind === 'automation' || file.kind === 'config',
  );

  if (hasSource && hasDocs) return 'mixed';
  if (hasSource) return 'coding';
  if (hasAutomation) return 'automation';
  if (hasDocs) return 'docs_content';
  return 'unknown';
}

function inferCapabilities(
  evidence: readonly FileEvidence[],
  commands: readonly ProjectOnboardingCommand[],
): ProjectCapability[] {
  const capabilities = new Set<ProjectCapability>(['files', 'chat']);
  if (evidence.some((file) => file.kind === 'source' || file.kind === 'manifest')) {
    capabilities.add('coding_tools');
  }
  if (evidence.some((file) => file.kind === 'manifest') || commands.length > 0) {
    capabilities.add('terminal');
  }
  if (commands.some((command) => command.kind === 'test')) capabilities.add('tests');
  if (
    evidence.some((file) => file.kind === 'automation') ||
    commands.some((c) => c.kind === 'automation')
  ) {
    capabilities.add('automation');
  }
  if (evidence.some((file) => file.kind === 'docs')) capabilities.add('docs_research');
  return [...capabilities];
}

function instructionSufficiency(
  root: string,
  instructionFiles: readonly ProjectInstructionFileReference[],
) {
  const rootInstruction = instructionFiles.find((file) => file.scope === 'root');
  if (!rootInstruction) return { sufficient: false, summary: 'No root AGENTS.md was found.' };

  const content = safeReadText(join(root, rootInstruction.path)) ?? '';
  const normalized = content.toLowerCase();
  const hasOperationalRules =
    normalized.includes('test') ||
    normalized.includes('lint') ||
    normalized.includes('quality') ||
    normalized.includes('beads') ||
    normalized.includes('git workflow');
  const sufficient = content.trim().length >= 120 && hasOperationalRules;
  return {
    sufficient,
    summary: sufficient
      ? 'Root instructions describe project workflow and quality expectations.'
      : 'Root instructions exist but do not yet describe enough workflow and quality expectations.',
  };
}

function buildGaps(input: {
  hasRootInstructions: boolean;
  instructionsSufficient: boolean;
  profile: ProjectProfile;
  commands: readonly ProjectOnboardingCommand[];
}): ProjectOnboardingGap[] {
  const gaps: ProjectOnboardingGap[] = [];
  if (!input.hasRootInstructions) {
    gaps.push({
      kind: 'missing_instructions',
      severity: 'blocking',
      message: 'A root AGENTS.md is required before write-capable Project work can be approved.',
      evidencePaths: [],
    });
  } else if (!input.instructionsSufficient) {
    gaps.push({
      kind: 'stale_instructions',
      severity: 'warning',
      message: 'The root instructions need clearer project workflow, command, and closeout rules.',
      evidencePaths: ['AGENTS.md'],
    });
  }
  if (input.profile === 'unknown') {
    gaps.push({
      kind: 'unknown_profile',
      severity: 'warning',
      message: 'The Project shape is not clear from the files inspected.',
      evidencePaths: [],
    });
  }
  if (input.commands.length === 0) {
    gaps.push({
      kind: 'missing_command',
      severity: 'warning',
      message: 'No build, test, lint, run, or automation commands were discovered.',
      evidencePaths: [],
    });
  }
  return gaps;
}

function buildQuestions(gaps: readonly ProjectOnboardingGap[]): ProjectOnboardingQuestion[] {
  return gaps
    .filter((gap) => gap.severity !== 'info')
    .map((gap, index) => ({
      id: `project-onboarding-${index + 1}`,
      prompt:
        gap.kind === 'missing_instructions'
          ? 'Should I draft root Project instructions before enabling write-capable work?'
          : `How should this be resolved: ${gap.message}`,
      reason: gap.message,
      required: gap.severity === 'blocking',
    }));
}

function assessmentStatus(
  hasRootInstructions: boolean,
  instructionsSufficient: boolean,
): ProjectOnboardingAssessment['status'] {
  return hasRootInstructions && instructionsSufficient ? 'approved' : 'in_progress';
}

function transitionForAssessment(input: {
  currentState: ProjectOnboardingState;
  status: ProjectOnboardingAssessment['status'];
}): ProjectOnboardingState {
  if (input.status === 'approved') {
    if (input.currentState === 'approved') {
      return transitionProjectOnboardingState({
        current: input.currentState,
        trigger: 'refresh_no_change',
      });
    }
    return transitionProjectOnboardingState({
      current: input.currentState,
      trigger: 'assessment_approved',
    });
  }
  if (input.currentState === 'approved') {
    return transitionProjectOnboardingState({
      current: input.currentState,
      trigger: 'assessment_needs_review',
    });
  }
  if (input.currentState === 'missing') {
    return transitionProjectOnboardingState({
      current: input.currentState,
      trigger: 'assessment_missing',
    });
  }
  if (input.currentState === 'in_progress') return 'in_progress';
  return transitionProjectOnboardingState({
    current: input.currentState,
    trigger: 'assessment_needs_review',
  });
}

function evidenceSummary(file: FileEvidence): string {
  switch (file.kind) {
    case 'instructions':
      return 'Project instruction file.';
    case 'manifest':
      return 'Project or package manifest.';
    case 'config':
      return 'Project configuration file.';
    case 'docs':
      return 'Documentation content.';
    case 'source':
      return 'Source file indicating implementation work.';
    case 'test':
      return 'Test file indicating verification workflow.';
    case 'automation':
      return 'Automation or scheduled-work file.';
    case 'container':
      return 'Container runtime file.';
    case 'other':
      return 'Other relevant project evidence.';
  }
}

export function assessProjectOnboarding(input: AssessmentInput): {
  assessment: ProjectOnboardingAssessment;
  nextState: ProjectOnboardingState;
  instructionFiles: ProjectInstructionFileReference[];
} {
  const instructionDiscovery = discoverProjectInstructions(
    input.projectRoot,
    input.existingInstructionFiles,
  );
  const evidence = scanEvidenceFiles(input.projectRoot);
  const manifests = evidence
    .filter((file) => basename(file.path) === 'package.json')
    .flatMap((file) => {
      const manifest = readPackageManifest(input.projectRoot, file.path);
      return manifest ? [manifest] : [];
    });
  const commands = inferCommands(manifests);
  const subprojectScopes = inferScopes(manifests);
  const profile = inferProfile(evidence);
  const capabilities = inferCapabilities(evidence, commands);
  const sufficiency = instructionSufficiency(
    input.projectRoot,
    instructionDiscovery.instructionFiles,
  );
  const hasRootInstructions = instructionDiscovery.instructionFiles.some(
    (file) => file.scope === 'root',
  );
  const gaps = buildGaps({
    hasRootInstructions,
    instructionsSufficient: sufficiency.sufficient,
    profile,
    commands,
  });
  const status =
    input.currentState === 'approved' && instructionDiscovery.onboardingState === 'approved'
      ? 'approved'
      : assessmentStatus(hasRootInstructions, sufficiency.sufficient);
  const onboardingLabel = status === 'approved' ? 'Ready' : 'Needs onboarding';
  const folderLabel = basename(input.projectRoot);
  const display = {
    projectName: input.projectName,
    folderLabel,
    profileLabel: profile
      .split('_')
      .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
      .join(' '),
    onboardingLabel,
    ...(input.activeBranch ? { branchLabel: input.activeBranch } : {}),
  };

  const assessment = ProjectOnboardingAssessmentSchema.parse({
    status,
    profile,
    capabilities,
    summary: [
      sufficiency.summary,
      `Detected ${profile.replace('_', ' ')} Project with ${evidence.length} relevant evidence files.`,
    ].join(' '),
    evidenceFiles: evidence.map((file) => ({ ...file, summary: evidenceSummary(file) })),
    subprojectScopes,
    commands,
    gaps,
    questions: buildQuestions(gaps),
    recommendedInstructionUpdates: gaps.length
      ? [
          {
            targetPath: 'AGENTS.md',
            summary: 'Update Project instructions with workflow, commands, and closeout rules.',
            rationale: 'The assessment found gaps that block or weaken safe Project work.',
          },
        ]
      : [],
    display,
    assessedAtMs: input.nowMs ?? Date.now(),
  });

  return {
    assessment,
    nextState: transitionForAssessment({ currentState: input.currentState, status }),
    instructionFiles: instructionDiscovery.instructionFiles,
  };
}
