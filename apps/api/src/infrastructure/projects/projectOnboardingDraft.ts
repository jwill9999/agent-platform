import {
  ProjectOnboardingDialogueSchema,
  ProjectOnboardingDraftSchema,
  type ProjectOnboardingAssessment,
  type ProjectOnboardingDialogue,
  type ProjectOnboardingDraft,
  type ProjectOnboardingQuestion,
  type ProjectRecord,
} from '@agent-platform/contracts';

type StoredMetadata = Record<string, unknown>;

type DraftInput = {
  project: ProjectRecord;
  assessment: ProjectOnboardingAssessment;
  previousDraft?: ProjectOnboardingDraft;
  dialogue: ProjectOnboardingDialogue;
  nowMs: number;
};

function titleForProfile(profile: ProjectOnboardingAssessment['profile']): string {
  return profile
    .split('_')
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join(' ');
}

function uniqueQuestions(
  questions: readonly ProjectOnboardingQuestion[],
): ProjectOnboardingQuestion[] {
  const seen = new Set<string>();
  const result: ProjectOnboardingQuestion[] = [];
  for (const question of questions) {
    if (seen.has(question.id)) continue;
    seen.add(question.id);
    result.push(question);
  }
  return result;
}

export function onboardingQuestionQueue(
  assessment: ProjectOnboardingAssessment,
): ProjectOnboardingQuestion[] {
  const questions: ProjectOnboardingQuestion[] = [...assessment.questions];
  if (
    assessment.profile === 'docs_content' ||
    assessment.profile === 'research' ||
    assessment.profile === 'automation' ||
    assessment.profile === 'mixed' ||
    assessment.profile === 'unknown'
  ) {
    questions.unshift({
      id: 'project-intended-workflow',
      prompt:
        'What kind of work should this Project support: code changes, docs/content, research, automation, or a mix?',
      reason: 'The Project profile is not purely coding, so intended workflow should be confirmed.',
      required: true,
    });
  }
  if (assessment.subprojectScopes.length > 1) {
    questions.push({
      id: 'active-subproject-scope',
      prompt: 'Which app, package, service, or folder should be treated as the active work scope?',
      reason: 'Multiple subproject scopes were detected.',
      required: true,
    });
  }
  if (assessment.commands.length === 0) {
    questions.push({
      id: 'project-command-workflow',
      prompt: 'What commands should agents use for run, build, test, lint, or automation work?',
      reason: 'No operational commands were discovered from project files.',
      required: true,
    });
  }
  return uniqueQuestions(questions);
}

export function parseStoredOnboardingDraft(
  metadata: StoredMetadata,
): ProjectOnboardingDraft | undefined {
  const parsed = ProjectOnboardingDraftSchema.safeParse(metadata['onboardingDraft']);
  return parsed.success ? parsed.data : undefined;
}

export function parseStoredOnboardingDialogue(
  metadata: StoredMetadata,
): ProjectOnboardingDialogue | undefined {
  const parsed = ProjectOnboardingDialogueSchema.safeParse(metadata['onboardingDialogue']);
  return parsed.success ? parsed.data : undefined;
}

function assistantTurn(
  question: ProjectOnboardingQuestion | undefined,
  nowMs: number,
): ProjectOnboardingDialogue['turns'][number] | undefined {
  if (!question) return undefined;
  return {
    id: `assistant-${nowMs}`,
    role: 'assistant',
    content: question.prompt,
    questionId: question.id,
    createdAtMs: nowMs,
  };
}

export function createInitialOnboardingDialogue(
  assessment: ProjectOnboardingAssessment,
  nowMs: number,
): ProjectOnboardingDialogue {
  const firstQuestion = onboardingQuestionQueue(assessment)[0];
  const turn = assistantTurn(firstQuestion, nowMs);
  return ProjectOnboardingDialogueSchema.parse({
    status: firstQuestion ? 'asking' : 'draft_ready',
    ...(firstQuestion ? { activeQuestionId: firstQuestion.id } : {}),
    answeredQuestionIds: [],
    turns: turn ? [turn] : [],
    updatedAtMs: nowMs,
  });
}

export function recordOnboardingAnswer(input: {
  assessment: ProjectOnboardingAssessment;
  dialogue: ProjectOnboardingDialogue;
  questionId?: string;
  answer: string;
  nowMs: number;
}): ProjectOnboardingDialogue {
  const currentQuestionId = input.questionId ?? input.dialogue.activeQuestionId;
  const answeredQuestionIds = currentQuestionId
    ? [...new Set([...input.dialogue.answeredQuestionIds, currentQuestionId])]
    : [...input.dialogue.answeredQuestionIds];
  const nextQuestion = onboardingQuestionQueue(input.assessment).find(
    (question) => !answeredQuestionIds.includes(question.id),
  );
  const userTurn: ProjectOnboardingDialogue['turns'][number] = {
    id: `user-${input.nowMs}`,
    role: 'user',
    content: input.answer,
    createdAtMs: input.nowMs,
    ...(currentQuestionId ? { questionId: currentQuestionId } : {}),
  };
  const followUp = assistantTurn(nextQuestion, input.nowMs + 1);
  return ProjectOnboardingDialogueSchema.parse({
    status: nextQuestion ? 'asking' : 'draft_ready',
    ...(nextQuestion ? { activeQuestionId: nextQuestion.id } : {}),
    answeredQuestionIds,
    turns: [...input.dialogue.turns, userTurn, ...(followUp ? [followUp] : [])],
    updatedAtMs: input.nowMs,
  });
}

function answersByQuestionId(dialogue: ProjectOnboardingDialogue): Map<string, string[]> {
  const answers = new Map<string, string[]>();
  for (const turn of dialogue.turns) {
    if (turn.role !== 'user' || !turn.questionId) continue;
    const existing = answers.get(turn.questionId) ?? [];
    existing.push(turn.content);
    answers.set(turn.questionId, existing);
  }
  return answers;
}

function listOrPlaceholder(values: readonly string[], placeholder: string): string {
  return values.length ? values.map((value) => `- ${value}`).join('\n') : `- ${placeholder}`;
}

function formatEvidence(assessment: ProjectOnboardingAssessment): string {
  return listOrPlaceholder(
    assessment.evidenceFiles.slice(0, 12).map((file) => `${file.path} (${file.kind})`),
    'No project evidence files were discovered during the read-only assessment.',
  );
}

function formatScopes(assessment: ProjectOnboardingAssessment): string {
  return listOrPlaceholder(
    assessment.subprojectScopes.map((scope) =>
      scope.packageName ? `${scope.path} (${scope.packageName})` : scope.path,
    ),
    'No separate app, package, or service scopes were discovered.',
  );
}

function formatCommands(assessment: ProjectOnboardingAssessment): string {
  return listOrPlaceholder(
    assessment.commands.map((command) =>
      command.path ? `${command.command} from ${command.path}` : command.command,
    ),
    'Ask the user for run, build, test, lint, and automation commands before executing them.',
  );
}

function formatAnswers(input: {
  assessment: ProjectOnboardingAssessment;
  dialogue: ProjectOnboardingDialogue;
}): string {
  const answers = answersByQuestionId(input.dialogue);
  const queue = onboardingQuestionQueue(input.assessment);
  const lines = queue.flatMap((question) => {
    const questionAnswers = answers.get(question.id) ?? [];
    if (!questionAnswers.length) return [];
    return [`- ${question.prompt}`, ...questionAnswers.map((answer) => `  - ${answer}`)];
  });
  return lines.length ? lines.join('\n') : '- No user answers have been captured yet.';
}

function formatOpenQuestions(input: {
  assessment: ProjectOnboardingAssessment;
  dialogue: ProjectOnboardingDialogue;
}): string {
  const unanswered = onboardingQuestionQueue(input.assessment).filter(
    (question) => !input.dialogue.answeredQuestionIds.includes(question.id),
  );
  return listOrPlaceholder(
    unanswered.map((question) => question.prompt),
    'No open onboarding questions remain.',
  );
}

export function buildOnboardingDraft(input: DraftInput): ProjectOnboardingDraft {
  const revision = (input.previousDraft?.revision ?? 0) + 1;
  const history = input.previousDraft
    ? [
        ...input.previousDraft.history,
        {
          revision: input.previousDraft.revision,
          markdown: input.previousDraft.markdown,
          summary: `Revision ${input.previousDraft.revision} before onboarding answer update.`,
          createdAtMs: input.nowMs,
        },
      ].slice(-5)
    : [];
  const markdown = [
    '# Agent Instructions',
    '',
    '## Project Overview',
    '',
    `- Project: ${input.project.name}`,
    `- Profile: ${titleForProfile(input.assessment.profile)}`,
    `- Onboarding status: ${input.assessment.status}`,
    `- Summary: ${input.assessment.summary}`,
    '',
    '## User Workflow Notes',
    '',
    formatAnswers({ assessment: input.assessment, dialogue: input.dialogue }),
    '',
    '## Project Structure',
    '',
    formatEvidence(input.assessment),
    '',
    '## Apps, Packages, And Services',
    '',
    formatScopes(input.assessment),
    '',
    '## Architecture Overview',
    '',
    '- Use the files listed above as read-only evidence until the Project instructions are approved.',
    '- Ask the user before assuming an active subproject, service boundary, or non-code workflow.',
    '',
    '## Commands',
    '',
    formatCommands(input.assessment),
    '',
    '## Docker And Containers',
    '',
    '- Use discovered Docker or compose files only after confirming the intended workflow.',
    '- Do not start, rebuild, or remove containers until Project onboarding is approved.',
    '',
    '## Environment And Secrets',
    '',
    '- Never print, persist, or expose secret values.',
    '- Ask before creating or changing environment files.',
    '',
    '## Coding And Content Conventions',
    '',
    '- Follow existing files and local project conventions first.',
    '- For mixed or non-code Projects, confirm whether the task is code, docs, research, automation, or another workflow before applying coding assumptions.',
    '',
    '## Agent Safety Rules',
    '',
    '- Read-only inspection and planning are allowed during onboarding.',
    '- Code writes, commits, installs, migrations, destructive commands, and approval of generated instructions remain blocked until human approval.',
    '- If project scope or commands are ambiguous, ask a focused question instead of guessing.',
    '',
    '## Open Questions',
    '',
    formatOpenQuestions({ assessment: input.assessment, dialogue: input.dialogue }),
    '',
  ].join('\n');

  return ProjectOnboardingDraftSchema.parse({
    id: input.previousDraft?.id ?? `draft-${input.project.id}`,
    projectId: input.project.id,
    targetPath: input.previousDraft?.targetPath ?? 'AGENTS.md',
    markdown,
    revision,
    history,
    createdAtMs: input.previousDraft?.createdAtMs ?? input.nowMs,
    updatedAtMs: input.nowMs,
  });
}
