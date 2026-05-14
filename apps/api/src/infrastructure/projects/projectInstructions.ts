import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

import type {
  ProjectInstructionFileReference,
  ProjectOnboardingState,
} from '@agent-platform/contracts';
import { ProjectInstructionFileReferenceSchema } from '@agent-platform/contracts';

const INSTRUCTION_FILE = 'AGENTS.md';
const SKIPPED_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.next', 'coverage']);
const MAX_PROMPT_CHARS_PER_FILE = 12_000;

export type ProjectInstructionReference = ProjectInstructionFileReference & {
  contentHash: string;
};

export type InstructionDiscovery = {
  onboardingState: ProjectOnboardingState;
  instructionFiles: ProjectInstructionReference[];
};

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function toRelativeProjectPath(root: string, filePath: string): string {
  const rel = relative(root, filePath).split(sep).join('/');
  return rel === '' ? INSTRUCTION_FILE : rel;
}

function readInstructionReference(
  root: string,
  filePath: string,
  scope: 'root' | 'nested',
): ProjectInstructionReference {
  const path = toRelativeProjectPath(root, filePath);
  const ref: ProjectInstructionReference = {
    scope,
    path,
    contentHash: sha256(readFileSync(filePath, 'utf8')),
  };
  if (scope === 'nested') ref.appliesToPath = dirname(path).split(sep).join('/');
  return ref;
}

function discoverNestedInstructionFiles(root: string, dir: string, results: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === INSTRUCTION_FILE) {
      const filePath = join(dir, entry.name);
      if (filePath !== join(root, INSTRUCTION_FILE)) results.push(filePath);
      continue;
    }
    if (!entry.isDirectory() || SKIPPED_DIRS.has(entry.name)) continue;
    discoverNestedInstructionFiles(root, join(dir, entry.name), results);
  }
}

function isReferenceApproved(
  discovered: ProjectInstructionReference,
  existing: ProjectInstructionFileReference | undefined,
): boolean {
  return Boolean(
    existing?.approvedAtMs &&
    existing.path === discovered.path &&
    existing.contentHash === discovered.contentHash,
  );
}

export function parseProjectInstructionFileReferences(
  metadata: Record<string, unknown>,
): ProjectInstructionFileReference[] {
  const value = metadata['instructionFiles'];
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const parsed = ProjectInstructionFileReferenceSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

export function discoverProjectInstructions(
  root: string,
  existing: readonly ProjectInstructionFileReference[] = [],
): InstructionDiscovery {
  const rootFile = join(root, INSTRUCTION_FILE);
  if (!existsSync(rootFile) || !statSync(rootFile).isFile()) {
    return { onboardingState: 'missing', instructionFiles: [] };
  }

  const nestedFiles: string[] = [];
  discoverNestedInstructionFiles(root, root, nestedFiles);
  const rootRef = readInstructionReference(root, rootFile, 'root');
  const discovered = [
    rootRef,
    ...nestedFiles.map((filePath) => readInstructionReference(root, filePath, 'nested')),
  ];
  const instructionFiles = discovered.map((file) => {
    const approved = existing.find((candidate) => candidate.path === file.path);
    if (!approved?.approvedAtMs || !isReferenceApproved(file, approved)) return file;
    return { ...file, approvedAtMs: approved.approvedAtMs };
  });
  const rootApproved = isReferenceApproved(
    rootRef,
    existing.find((candidate) => candidate.path === rootRef.path),
  );
  return {
    onboardingState: rootApproved ? 'approved' : 'needs_review',
    instructionFiles,
  };
}

function nearestNestedInstruction(
  instructionFiles: readonly ProjectInstructionFileReference[],
  scopePath: string | undefined,
): ProjectInstructionFileReference | undefined {
  if (!scopePath) return undefined;
  const scopedInstructions = instructionFiles.filter(
    (file): file is ProjectInstructionFileReference & { appliesToPath: string } =>
      file.scope === 'nested' && typeof file.appliesToPath === 'string',
  );
  return scopedInstructions
    .filter(
      (file) => scopePath === file.appliesToPath || scopePath.startsWith(`${file.appliesToPath}/`),
    )
    .sort((a, b) => b.appliesToPath.length - a.appliesToPath.length)
    .at(0);
}

function readPromptFile(root: string, ref: ProjectInstructionFileReference): string {
  const content = readFileSync(join(root, ref.path), 'utf8');
  return content.length > MAX_PROMPT_CHARS_PER_FILE
    ? `${content.slice(0, MAX_PROMPT_CHARS_PER_FILE)}\n\n[Truncated]`
    : content;
}

export function buildProjectInstructionPrompt(
  root: string,
  instructionFiles: readonly ProjectInstructionFileReference[],
  scopePath?: string,
): string | undefined {
  const rootRef = instructionFiles.find((file) => file.scope === 'root');
  if (!rootRef) return undefined;
  const selected = [rootRef, nearestNestedInstruction(instructionFiles, scopePath)].filter(
    (ref): ref is ProjectInstructionFileReference => Boolean(ref),
  );
  return [
    [
      'Project instruction files for this session follow.',
      'Treat them as user-provided operating instructions for work in the active Project.',
      'When replying to the user, use Project-relative paths and do not mention the internal /workspace mount.',
    ].join(' '),
    ...selected.map((ref) => `\n--- ${ref.path} ---\n${readPromptFile(root, ref)}`),
  ].join('\n');
}
