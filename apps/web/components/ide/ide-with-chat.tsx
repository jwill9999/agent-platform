'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type {
  Agent,
  ProjectOnboardingAssessment,
  ProjectOnboardingDialogue,
  ProjectOnboardingDraft,
  ProjectInstructionUpdateCandidate,
  ProjectInstructionUpdateProposal,
  ProjectRecord,
  SessionRecord,
} from '@agent-platform/contracts';
import {
  ProjectOnboardingAssessmentSchema,
  ProjectOnboardingDialogueSchema,
  ProjectOnboardingDraftSchema,
  ProjectInstructionUpdateCandidateSchema,
  ProjectInstructionUpdateProposalSchema,
} from '@agent-platform/contracts';
import type { UIMessage } from 'ai';
import {
  FolderOpen,
  File,
  Save,
  X,
  ChevronRight,
  ChevronDown,
  FileCode,
  FileJson,
  FileText,
  FileType,
  Folder,
  Diff,
  GitBranch,
  Search,
  Send,
  Sparkles,
  Check,
  PanelLeftClose,
  PanelRightClose,
  PanelBottomClose,
  Code2,
  MessageSquare,
  Plus,
  Paperclip,
  RefreshCw,
  ListCollapse,
  Terminal as TerminalIcon,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { cn } from '@/lib/cn';
import { toast } from 'sonner';
import { IDEMarkdown } from '@/components/ide/ide-markdown';
import { Terminal } from '@/components/ide/terminal';
import { useFileSystem } from '@/hooks/use-file-system';
import {
  useHarnessChat,
  type ApprovalCardState,
  type ApprovalDecision,
  type ToolTraceEvent,
} from '@/hooks/use-harness-chat';
import type { FileNode } from '@/hooks/use-file-system';
import { apiGet, apiPath, apiPost, ApiRequestError } from '@/lib/apiClient';
import { pickDefaultAgentForMode } from '@/lib/default-agent';
import { formatFileContext } from '@/lib/file-context';
import { ChatAgentSelector } from '@/components/chat/chat-agent-selector';
import { ApprovalCard } from '@/components/chat/approval-card';
import { CriticBadges } from '@/components/chat/critic-badges';
import { BrowserArtifactPreviews } from '@/components/chat/browser-artifact-previews';
import { ThinkingBlock } from '@/components/chat/thinking-block';
import { ToolTraceBlock } from '@/components/chat/tool-trace-block';
import { formatCriticStatus, type CriticEvent } from '@/lib/critic-events';
import { WorkbenchCodeEditor } from '@/components/ide/workbench-code-editor';
import { getWorkbenchLanguage, updateWorkbenchTabContent } from '@/lib/code-workbench-editor';
import {
  buildWorkbenchContextDraft,
  type WorkbenchContextDraft,
} from '@/lib/code-workbench-context';
import {
  isSupportedWorkbenchTextPath,
  parseWorkbenchFileReference,
  type WorkbenchFileReferenceStatus,
} from '@/lib/code-workbench-file-references';
import type { WorkbenchFileReferenceAction } from '@/components/ide/ide-markdown';
import {
  createWorkbenchEditProposal,
  type WorkbenchEditProposal,
} from '@/lib/code-workbench-edit-review';
import {
  buildWorkbenchBranchSummary,
  type WorkbenchBranchSummary,
} from '@/lib/code-workbench-branch-summary';

type ProjectOnboardingState = 'missing' | 'in_progress' | 'approved' | 'needs_review';
type ProjectBindingStatus = 'open' | 'folder-selected' | 'not-open';

function getProjectBindingStatus(
  project: ProjectRecord | null,
  rootName: string | null,
): ProjectBindingStatus {
  if (project) return 'open';
  if (rootName) return 'folder-selected';
  return 'not-open';
}

function ProjectBindingStatusBadge({ status }: Readonly<{ status: ProjectBindingStatus }>) {
  if (status === 'open') {
    return <span className="text-xs text-emerald-600">Open</span>;
  }
  if (status === 'folder-selected') {
    return <span className="text-xs text-sky-600">Folder selected</span>;
  }
  return <span className="text-xs text-muted-foreground">Not open</span>;
}

function projectMetadataString(project: ProjectRecord | null, key: string): string | undefined {
  const value = project?.metadata[key];
  return typeof value === 'string' ? value : undefined;
}

function projectOnboardingState(project: ProjectRecord | null): ProjectOnboardingState {
  const value = projectMetadataString(project, 'onboardingState');
  if (
    value === 'missing' ||
    value === 'in_progress' ||
    value === 'approved' ||
    value === 'needs_review'
  ) {
    return value;
  }
  return 'missing';
}

function projectHasRootInstructions(project: ProjectRecord | null): boolean {
  const files = project?.metadata.instructionFiles;
  return (
    Array.isArray(files) &&
    files.some(
      (file) =>
        typeof file === 'object' &&
        file !== null &&
        !Array.isArray(file) &&
        (file as { scope?: unknown }).scope === 'root',
    )
  );
}

function canManuallyApproveProjectInstructions(input: {
  project: ProjectRecord | null;
  onboardingState: ProjectOnboardingState;
  onboardingAssessment: ProjectOnboardingAssessment | null;
}): boolean {
  if (!input.project || input.onboardingState === 'approved') return false;
  if (input.onboardingAssessment?.status !== 'approved') return false;
  return projectHasRootInstructions(input.project);
}

function hasInstructionUpdateReview(
  candidates: readonly ProjectInstructionUpdateCandidate[],
  proposal: ProjectInstructionUpdateProposal | null,
): boolean {
  return candidates.length > 0 || proposal !== null;
}

function projectOnboardingAssessment(
  project: ProjectRecord | null,
): ProjectOnboardingAssessment | null {
  const parsed = ProjectOnboardingAssessmentSchema.safeParse(
    project?.metadata.onboardingAssessment,
  );
  return parsed.success ? parsed.data : null;
}

function projectOnboardingDraft(project: ProjectRecord | null): ProjectOnboardingDraft | null {
  const parsed = ProjectOnboardingDraftSchema.safeParse(project?.metadata.onboardingDraft);
  return parsed.success ? parsed.data : null;
}

function projectOnboardingDialogue(
  project: ProjectRecord | null,
): ProjectOnboardingDialogue | null {
  const parsed = ProjectOnboardingDialogueSchema.safeParse(project?.metadata.onboardingDialogue);
  return parsed.success ? parsed.data : null;
}

function projectInstructionUpdateCandidates(
  project: ProjectRecord | null,
): ProjectInstructionUpdateCandidate[] {
  const parsed = ProjectInstructionUpdateCandidateSchema.array().safeParse(
    project?.metadata.instructionUpdateCandidates,
  );
  return parsed.success ? parsed.data : [];
}

function projectInstructionUpdateProposal(
  project: ProjectRecord | null,
): ProjectInstructionUpdateProposal | null {
  const parsed = ProjectInstructionUpdateProposalSchema.safeParse(
    project?.metadata.instructionUpdateProposal,
  );
  return parsed.success ? parsed.data : null;
}

function projectOnboardingLabel(state: ProjectOnboardingState): string {
  switch (state) {
    case 'approved':
      return 'Project ready';
    case 'needs_review':
    case 'in_progress':
    case 'missing':
      return 'Project setup needs review';
  }
}

function projectOnboardingDescription(state: ProjectOnboardingState): string {
  if (state === 'approved') {
    return 'File edits are enabled for this Project.';
  }
  return 'Before file edits are enabled, review the Project instructions with the agent.';
}

// ---------------------------------------------------------------------------
// Small presentational components
// ---------------------------------------------------------------------------

function StatusLabel({
  isLoading,
  sessionReady,
  criticStatus,
}: Readonly<{ isLoading: boolean; sessionReady: boolean; criticStatus?: string | null }>) {
  let label: string;
  if (isLoading) label = criticStatus ?? 'Thinking...';
  else if (sessionReady) label = 'Ready';
  else label = 'Connecting…';
  return (
    <span data-testid="chat-status-label" className="text-xs text-muted-foreground shrink-0">
      {label}
    </span>
  );
}

function ContentActivityBlocks({
  criticEvents,
  thinking,
  toolEvents,
  approvals,
  onApprovalDecision,
  defaultOpenThinking = false,
  isStreaming = false,
}: Readonly<{
  criticEvents?: readonly CriticEvent[];
  thinking?: string;
  toolEvents?: readonly ToolTraceEvent[];
  approvals?: readonly ApprovalCardState[];
  onApprovalDecision?: (approvalRequestId: string, decision: ApprovalDecision) => void;
  defaultOpenThinking?: boolean;
  isStreaming?: boolean;
}>) {
  const hasToolEvents = Boolean(toolEvents?.length);

  return (
    <>
      {criticEvents && criticEvents.length > 0 ? <CriticBadges events={criticEvents} /> : null}
      {thinking ? <ThinkingBlock content={thinking} defaultOpen={defaultOpenThinking} /> : null}
      {hasToolEvents ? (
        <ToolTraceBlock events={toolEvents ?? []} isStreaming={isStreaming} />
      ) : null}
      {hasToolEvents ? <BrowserArtifactPreviews events={toolEvents ?? []} /> : null}
      {approvals?.map((approval) => (
        <ApprovalCard
          key={approval.approvalRequestId}
          approval={approval}
          onDecision={onApprovalDecision}
        />
      ))}
    </>
  );
}

export function ProjectOnboardingAssessmentPanel({
  assessment,
  isRefreshing,
  onRefresh,
}: Readonly<{
  assessment: ProjectOnboardingAssessment;
  isRefreshing: boolean;
  onRefresh: () => void;
}>) {
  return (
    <div className="rounded-md border border-border bg-background px-2 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground">Project setup</div>
          <div className="text-muted-foreground">
            {assessment.status === 'approved'
              ? 'Ready for file work'
              : 'Review required before edits'}
          </div>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          aria-label="Refresh project assessment"
          title="Refresh project assessment"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} aria-hidden />
        </Button>
      </div>
      <p className="mt-2 leading-snug">
        {assessment.status === 'approved'
          ? 'The agent can use this Project for approved file changes.'
          : 'The agent needs you to review or create Project instructions before it can edit files.'}
      </p>
      {assessment.questions.length > 0 && assessment.status !== 'approved' && (
        <p className="mt-2 leading-snug text-muted-foreground">
          Continue in the setup draft below.
        </p>
      )}
    </div>
  );
}

function activeOnboardingQuestion(dialogue: ProjectOnboardingDialogue | null): string | null {
  if (!dialogue?.activeQuestionId) return null;
  const turn = [...dialogue.turns]
    .reverse()
    .find(
      (candidate) =>
        candidate.role === 'assistant' && candidate.questionId === dialogue.activeQuestionId,
    );
  return turn?.content ?? null;
}

export function ProjectOnboardingDraftPanel({
  draft,
  dialogue,
  answer,
  isStarting,
  isSubmitting,
  isReviewing,
  reviewComment,
  onStart,
  onAnswerChange,
  onSubmitAnswer,
  onReviewCommentChange,
  onApprove,
  onRequestChanges,
  onReject,
}: Readonly<{
  draft: ProjectOnboardingDraft | null;
  dialogue: ProjectOnboardingDialogue | null;
  answer: string;
  isStarting: boolean;
  isSubmitting: boolean;
  isReviewing: boolean;
  reviewComment: string;
  onStart: () => void;
  onAnswerChange: (value: string) => void;
  onSubmitAnswer: () => void;
  onReviewCommentChange: (value: string) => void;
  onApprove: () => void;
  onRequestChanges: () => void;
  onReject: () => void;
}>) {
  const question = activeOnboardingQuestion(dialogue);
  return (
    <div className="rounded-md border border-border bg-background px-2 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground">Onboarding draft</div>
          <div className="text-muted-foreground">
            {draft ? `Revision ${draft.revision}` : 'Not started'}
          </div>
        </div>
        {!draft && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 shrink-0"
            onClick={onStart}
            disabled={isStarting}
          >
            {isStarting ? 'Starting...' : 'Review setup'}
          </Button>
        )}
      </div>
      {question && (
        <form
          className="mt-2 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmitAnswer();
          }}
        >
          <p className="leading-snug text-foreground">{question}</p>
          <Textarea
            aria-label="Onboarding answer"
            value={answer}
            onChange={(event) => {
              onAnswerChange(event.target.value);
            }}
            className="min-h-20 text-sm"
            placeholder="Answer this question for the Project instructions"
          />
          <Button type="submit" size="sm" className="h-7" disabled={!answer.trim() || isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Send answer'}
          </Button>
        </form>
      )}
      {draft && (
        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-muted px-2 py-2 text-xs leading-relaxed text-foreground">
          {draft.markdown}
        </pre>
      )}
      {draft && (
        <div className="mt-2 space-y-2">
          <Textarea
            aria-label="Review feedback"
            value={reviewComment}
            onChange={(event) => {
              onReviewCommentChange(event.target.value);
            }}
            className="min-h-16 text-sm"
            placeholder="Optional feedback before requesting changes"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="h-7"
              onClick={onApprove}
              disabled={isReviewing}
            >
              {isReviewing ? 'Reviewing...' : 'Approve draft'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7"
              onClick={onRequestChanges}
              disabled={!reviewComment.trim() || isReviewing}
            >
              Request changes
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7"
              onClick={onReject}
              disabled={!reviewComment.trim() || isReviewing}
            >
              Reject
            </Button>
          </div>
        </div>
      )}
      {draft?.history.length ? (
        <div className="mt-2 text-muted-foreground">{draft.history.length} earlier revision(s)</div>
      ) : null}
    </div>
  );
}

export function ProjectInstructionUpdatesPanel({
  candidates,
  proposal,
  isPreparing,
  isDeciding,
  onPrepare,
  onApply,
  onReject,
}: Readonly<{
  candidates: readonly ProjectInstructionUpdateCandidate[];
  proposal: ProjectInstructionUpdateProposal | null;
  isPreparing: boolean;
  isDeciding: boolean;
  onPrepare: () => void;
  onApply: (candidateId: string) => void;
  onReject: (candidateId: string) => void;
}>) {
  const visible = candidates.filter(
    (candidate) => candidate.status === 'pending' || candidate.status === 'proposed',
  );
  return (
    <div className="rounded-md border border-border bg-background px-2 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground">Closeout updates</div>
          <div className="text-muted-foreground">
            {proposal?.summary ?? `${visible.length} candidate update(s) waiting`}
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-7 shrink-0"
          onClick={onPrepare}
          disabled={isPreparing}
        >
          {isPreparing ? 'Preparing...' : 'Prepare'}
        </Button>
      </div>
      {visible.length > 0 && (
        <div className="mt-2 space-y-2">
          {visible.map((candidate) => (
            <div key={candidate.id} className="rounded border border-border px-2 py-2">
              <div className="text-foreground">{candidate.summary}</div>
              <div className="mt-1 text-muted-foreground">
                {candidate.risk === 'policy_change'
                  ? 'Policy change requires explicit review'
                  : 'Reviewable factual update'}
              </div>
              {candidate.proposedMarkdown && (
                <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap rounded bg-muted px-2 py-2 text-xs leading-relaxed text-foreground">
                  {candidate.proposedMarkdown}
                </pre>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-7"
                  onClick={() => {
                    onApply(candidate.id);
                  }}
                  disabled={isDeciding || candidate.status !== 'proposed'}
                >
                  Apply
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7"
                  onClick={() => {
                    onReject(candidate.id);
                  }}
                  disabled={isDeciding}
                >
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getAssistantMarkdownContextFiles(
  contextFiles: { path: string; name: string }[],
  activeFile: { path: string; name: string } | null,
) {
  if (!activeFile || contextFiles.some((f) => f.path === activeFile.path)) {
    return [...contextFiles];
  }
  return [...contextFiles, { path: activeFile.path, name: activeFile.name }];
}

function shouldShowEmptyAssistantResponse(input: {
  messageText: string;
  thinking?: string;
  hasToolEvents: boolean;
  hasApprovals: boolean;
  criticEvents?: readonly CriticEvent[];
}) {
  return (
    !input.messageText.trim() &&
    !input.thinking?.trim() &&
    !input.hasToolEvents &&
    !input.hasApprovals &&
    !input.criticEvents?.length
  );
}

export function AssistantContent({
  message,
  awaiting,
  contextFiles,
  activeFile,
  onApplyCode,
  onCreateFile,
  onShowDiff,
  getFileReferenceAction,
  criticEvents,
  thinking,
  toolEvents,
  approvals,
  onApprovalDecision,
}: Readonly<{
  message: UIMessage;
  awaiting: boolean;
  contextFiles: { path: string; name: string }[];
  activeFile: { path: string; name: string } | null;
  onApplyCode: (code: string, targetFile?: string) => void;
  onCreateFile: (code: string, suggestedName?: string) => void;
  onShowDiff?: (code: string, targetFile?: string) => void;
  getFileReferenceAction?: (reference: string) => WorkbenchFileReferenceAction | null;
  criticEvents?: readonly CriticEvent[];
  thinking?: string;
  toolEvents?: readonly ToolTraceEvent[];
  approvals?: readonly ApprovalCardState[];
  onApprovalDecision?: (approvalRequestId: string, decision: ApprovalDecision) => void;
}>) {
  const hasToolEvents = Boolean(toolEvents?.length);
  const hasApprovals = Boolean(approvals?.length);
  const messageText = getMessageText(message);

  if (awaiting) {
    return (
      <>
        <ContentActivityBlocks
          criticEvents={criticEvents}
          thinking={thinking}
          toolEvents={toolEvents}
          approvals={approvals}
          onApprovalDecision={onApprovalDecision}
          defaultOpenThinking
          isStreaming
        />
        <span className="sr-only" aria-busy="true" aria-live="polite">
          Assistant is responding
        </span>
      </>
    );
  }
  const allFiles = getAssistantMarkdownContextFiles(contextFiles, activeFile);
  return (
    <>
      <ContentActivityBlocks
        criticEvents={criticEvents}
        thinking={thinking}
        toolEvents={toolEvents}
        approvals={approvals}
        onApprovalDecision={onApprovalDecision}
      />
      <IDEMarkdown
        content={messageText}
        contextFiles={allFiles}
        onApplyCode={onApplyCode}
        onCreateFile={onCreateFile}
        onShowDiff={onShowDiff}
        getFileReferenceAction={getFileReferenceAction}
      />
      {shouldShowEmptyAssistantResponse({
        messageText,
        thinking,
        hasToolEvents,
        hasApprovals,
        criticEvents,
      }) ? (
        <p className="text-xs text-muted-foreground">No assistant response was returned.</p>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OpenTab {
  path: string;
  name: string;
  content: string;
  isDirty: boolean;
  language: string;
  handle?: FileSystemFileHandle;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return <FileCode className="h-4 w-4 text-blue-500" />;
    case 'json':
      return <FileJson className="h-4 w-4 text-yellow-500" />;
    case 'md':
    case 'txt':
      return <FileText className="h-4 w-4 text-muted-foreground" />;
    case 'css':
    case 'scss':
      return <FileType className="h-4 w-4 text-pink-500" />;
    default:
      return <File className="h-4 w-4 text-muted-foreground" />;
  }
}

function getLanguage(filename: string): string {
  return getWorkbenchLanguage(filename);
}

/** Match {@link Message} / chat — prefer `parts`, fall back to legacy `content`. */
function getMessageText(message: UIMessage): string {
  const textParts = (message.parts ?? [])
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text);
  if (textParts.length > 0) {
    return textParts.join('');
  }
  if (typeof message.content === 'string' && message.content.trim()) {
    return message.content;
  }
  return '';
}

// Sample file tree (replaced by File System Access API in later task)
// ---------------------------------------------------------------------------
// FileTreeNode
// ---------------------------------------------------------------------------

function FileTreeNode({
  node,
  depth = 0,
  onFileSelect,
  onAddToContext,
  selectedPath,
  contextPaths,
  collapseTreeSignal,
}: Readonly<{
  node: FileNode;
  depth?: number;
  onFileSelect: (node: FileNode) => void;
  onAddToContext?: (node: FileNode) => void;
  selectedPath: string | null;
  contextPaths?: string[];
  collapseTreeSignal: number;
}>) {
  const [isExpanded, setIsExpanded] = useState(depth < 2);
  const lastCollapseSignal = useRef<number | null>(null);

  useEffect(() => {
    if (lastCollapseSignal.current === null) {
      lastCollapseSignal.current = collapseTreeSignal;
      return;
    }
    if (collapseTreeSignal > lastCollapseSignal.current) {
      setIsExpanded(false);
    }
    lastCollapseSignal.current = collapseTreeSignal;
  }, [collapseTreeSignal]);

  if (node.type === 'directory') {
    return (
      <div>
        <button
          onClick={() => {
            setIsExpanded(!isExpanded);
          }}
          className={cn(
            'flex items-center gap-1 w-full px-2 py-1 text-sm hover:bg-muted/50 rounded-md transition-colors',
            'text-left',
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <Folder
            className={cn('h-4 w-4', isExpanded ? 'text-blue-500' : 'text-muted-foreground')}
          />
          <span className="truncate">{node.name}</span>
        </button>
        {isExpanded && node.children && (
          <div>
            {node.children.map((child) => (
              <FileTreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                onFileSelect={onFileSelect}
                onAddToContext={onAddToContext}
                selectedPath={selectedPath}
                contextPaths={contextPaths}
                collapseTreeSignal={collapseTreeSignal}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isInContext = contextPaths?.includes(node.path);

  return (
    <div
      className={cn(
        'flex items-center gap-1 group text-sm rounded-md transition-colors',
        selectedPath === node.path ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50',
      )}
      style={{ paddingLeft: `${depth * 12 + 28}px` }}
    >
      <button
        onClick={() => {
          onFileSelect(node);
        }}
        className="flex items-center gap-2 flex-1 py-1 text-left truncate"
      >
        {getFileIcon(node.name)}
        <span className="truncate">{node.name}</span>
        {isInContext && <span className="text-xs text-primary/70 ml-1">(in context)</span>}
      </button>
      {onAddToContext && node.type === 'file' && !isInContext && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddToContext(node);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-opacity"
          title="Add to context"
        >
          <Plus className="h-3 w-3 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

function getFolderButtonLabel(
  isLoading: boolean,
  isOpeningDirectory: boolean,
  rootName: string | null,
): string {
  if (isOpeningDirectory) return 'Opening...';
  if (isLoading) return 'Loading...';
  if (rootName) return `Close ${rootName}`;
  return 'Project not open';
}

function getToggleButtonState(isOpen: boolean, openLabel: string, closedLabel: string) {
  return {
    variant: isOpen ? 'secondary' : 'ghost',
    label: isOpen ? openLabel : closedLabel,
  } as const;
}

function getTerminalTitle(canUseProjectTools: boolean, showTerminal: boolean): string {
  if (!canUseProjectTools) return 'Open a Project before using the terminal';
  return showTerminal ? 'Hide terminal' : 'Show terminal';
}

function getSaveTitle(activeFileIsDirty: boolean, canSaveActiveFile: boolean): string {
  if (activeFileIsDirty && !canSaveActiveFile) {
    return 'Approve project instructions before saving changes';
  }
  return 'Save file';
}

function IDEToolbar({
  showExplorer,
  setShowExplorer,
  showTerminal,
  setShowTerminal,
  showChat,
  setShowChat,
  activeFilePath,
  activeFileIsDirty,
  canSaveActiveFile,
  onSave,
  isPathDialogOpen,
  setIsPathDialogOpen,
  pathInput,
  setPathInput,
  onLoadFromPath,
  isLoadingFolder,
  isOpeningFolder,
  rootName,
  onRefreshFolder,
  onCloseFolder,
  canUseProjectTools,
}: Readonly<{
  showExplorer: boolean;
  setShowExplorer: (v: boolean) => void;
  showTerminal: boolean;
  setShowTerminal: (v: boolean) => void;
  showChat: boolean;
  setShowChat: (v: boolean) => void;
  activeFilePath: string | null;
  activeFileIsDirty: boolean;
  canSaveActiveFile: boolean;
  onSave: () => void;
  isPathDialogOpen: boolean;
  setIsPathDialogOpen: (v: boolean) => void;
  pathInput: string;
  setPathInput: (v: string) => void;
  onLoadFromPath: () => void;
  isLoadingFolder: boolean;
  isOpeningFolder: boolean;
  rootName: string | null;
  onRefreshFolder: () => void;
  onCloseFolder: () => void;
  canUseProjectTools: boolean;
}>) {
  const explorerButton = getToggleButtonState(showExplorer, 'Hide', 'Files');
  const explorerTitle = showExplorer ? 'Hide file explorer' : 'Show file explorer';
  const ExplorerIcon = showExplorer ? PanelLeftClose : Folder;

  const terminalButton = getToggleButtonState(showTerminal, 'Hide', 'Terminal');
  const terminalTitle = getTerminalTitle(canUseProjectTools, showTerminal);
  const TermIcon = showTerminal ? PanelBottomClose : TerminalIcon;

  const chatButton = getToggleButtonState(showChat, 'Hide', 'AI');
  const chatTitle = showChat ? 'Hide AI assistant' : 'Show AI assistant';
  const ChatIcon = showChat ? PanelRightClose : MessageSquare;

  const folderLabel = getFolderButtonLabel(isLoadingFolder, isOpeningFolder, rootName);
  const folderActionDisabled = isLoadingFolder || isOpeningFolder;
  const saveTitle = getSaveTitle(activeFileIsDirty, canSaveActiveFile);

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50">
      <div className="flex items-center gap-2">
        <Button
          variant={explorerButton.variant}
          size="sm"
          onClick={() => {
            setShowExplorer(!showExplorer);
          }}
          className="gap-2"
          title={explorerTitle}
        >
          <ExplorerIcon className="h-4 w-4" />
          <span className="hidden sm:inline text-xs">{explorerButton.label}</span>
        </Button>
        <Dialog open={isPathDialogOpen} onOpenChange={setIsPathDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <FileText className="h-4 w-4" />
              Open File
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Open File from Path</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <Input
                placeholder="Enter file path (e.g., /src/index.ts)"
                value={pathInput}
                onChange={(e) => {
                  setPathInput(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onLoadFromPath();
                }}
              />
              <Button onClick={onLoadFromPath} className="w-full">
                Open File
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        {rootName && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={onCloseFolder}
            disabled={folderActionDisabled}
          >
            <FolderOpen className="h-4 w-4" />
            {folderLabel}
          </Button>
        )}
        {rootName && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefreshFolder}
            disabled={folderActionDisabled}
            title="Refresh file tree"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={onSave}
          disabled={!canSaveActiveFile}
          title={saveTitle}
        >
          <Save className="h-4 w-4" />
          Save
        </Button>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground hidden md:block">
          {activeFilePath ?? 'No file open'}
        </span>
        <Button
          variant={terminalButton.variant}
          size="sm"
          onClick={() => {
            setShowTerminal(!showTerminal);
          }}
          className="gap-2"
          title={terminalTitle}
          disabled={!canUseProjectTools}
        >
          <TermIcon className="h-4 w-4" />
          <span className="hidden sm:inline text-xs">{terminalButton.label}</span>
        </Button>
        <Button
          variant={chatButton.variant}
          size="sm"
          onClick={() => {
            setShowChat(!showChat);
          }}
          className="gap-2"
          title={chatTitle}
        >
          <ChatIcon className="h-4 w-4" />
          <span className="hidden sm:inline text-xs">{chatButton.label}</span>
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EditorTabs
// ---------------------------------------------------------------------------

function EditorTabs({
  openTabs,
  activeTab,
  setActiveTab,
  onCloseTab,
}: Readonly<{
  openTabs: OpenTab[];
  activeTab: string | null;
  setActiveTab: (path: string) => void;
  onCloseTab: (path: string, e: React.MouseEvent) => void;
}>) {
  if (openTabs.length === 0) return null;

  return (
    <div className="flex items-center border-b border-border bg-muted/30 overflow-x-auto">
      {openTabs.map((tab) => (
        <button
          key={tab.path}
          onClick={() => {
            setActiveTab(tab.path);
          }}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm border-r border-border transition-colors hover:bg-muted/50',
            activeTab === tab.path ? 'bg-background text-foreground' : 'text-muted-foreground',
          )}
        >
          {getFileIcon(tab.name)}
          <span className="truncate max-w-[120px]">{tab.name}</span>
          {tab.isDirty && <span className="w-2 h-2 rounded-full bg-primary" />}
          <button
            onClick={(e) => {
              onCloseTab(tab.path, e);
            }}
            className="ml-1 p-0.5 rounded hover:bg-muted"
          >
            <X className="h-3 w-3" />
          </button>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EditorPanel
// ---------------------------------------------------------------------------

function EditorPanel({
  activeFile,
  editProposal,
  onContentChange,
  onOpenPathDialog,
  onApplyProposal,
  onRejectProposal,
}: Readonly<{
  activeFile: OpenTab | undefined;
  editProposal: WorkbenchEditProposal | null;
  onContentChange: (content: string) => void;
  onOpenPathDialog: () => void;
  onApplyProposal: () => void;
  onRejectProposal: () => void;
}>) {
  if (!activeFile) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Code2 className="h-16 w-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium mb-2">No file open</p>
          <p className="text-sm mb-4">Select a file from the explorer or open a file by path</p>
          <Button variant="outline" onClick={onOpenPathDialog} className="gap-2">
            <FileText className="h-4 w-4" />
            Open File
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-1 bg-muted/20 border-b border-border text-xs text-muted-foreground">
        <span>{activeFile.language}</span>
        <span>{activeFile.content.split('\n').length} lines</span>
      </div>
      {editProposal && (
        <EditProposalPanel
          proposal={editProposal}
          onApply={onApplyProposal}
          onReject={onRejectProposal}
        />
      )}
      <WorkbenchCodeEditor
        value={activeFile.content}
        language={getWorkbenchLanguage(activeFile.name)}
        onChange={onContentChange}
        ariaLabel={`Code editor for ${activeFile.name}`}
      />
    </div>
  );
}

function EditProposalPanel({
  proposal,
  onApply,
  onReject,
}: Readonly<{
  proposal: WorkbenchEditProposal;
  onApply: () => void;
  onReject: () => void;
}>) {
  return (
    <div className="border-b border-border bg-card/80">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Diff className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Review proposed edit</span>
            {proposal.isNewFile && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                new file
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{proposal.path}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={onReject}>
            <X className="h-3.5 w-3.5" />
            Reject
          </Button>
          <Button size="sm" className="h-8 gap-1.5" onClick={onApply}>
            <Check className="h-3.5 w-3.5" />
            Apply
          </Button>
        </div>
      </div>
      <ScrollArea className="max-h-64 border-t border-border bg-background">
        <div className="min-w-max py-2 font-mono text-xs">
          {proposal.diff.map((line, index) => (
            <div
              key={`${line.kind}-${index}`}
              className={cn(
                'grid grid-cols-[3rem_3rem_1.5rem_1fr] gap-2 px-4 py-0.5',
                line.kind === 'added' && 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
                line.kind === 'removed' && 'bg-destructive/10 text-destructive',
              )}
            >
              <span className="select-none text-right text-muted-foreground">
                {line.oldLineNumber ?? ''}
              </span>
              <span className="select-none text-right text-muted-foreground">
                {line.newLineNumber ?? ''}
              </span>
              <span className="select-none">
                {line.kind === 'added' ? '+' : line.kind === 'removed' ? '-' : ' '}
              </span>
              <span className="whitespace-pre">{line.content || ' '}</span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChatPanel
// ---------------------------------------------------------------------------

function ChatPanel({
  messages,
  isLoading,
  chatInput,
  setChatInput,
  onSendMessage,
  contextDraft,
  branchSummary,
  activeFile,
  includeActiveFile,
  pinnedPaths,
  workspaceName,
  onToggleIncludeActiveFile,
  onAddToContext,
  onRemoveFromContext,
  onClearContext,
  onApplyCode,
  onCreateFile,
  onShowDiff,
  getFileReferenceAction,
  agents,
  selectedAgentId,
  onAgentChange,
  sessionReady,
  criticEventsByMessage,
  thinkingByMessage,
  toolEventsByMessage,
  approvalEventsByMessage,
  onApprovalDecision,
}: Readonly<{
  messages: UIMessage[];
  isLoading: boolean;
  chatInput: string;
  setChatInput: (v: string) => void;
  onSendMessage: () => void;
  contextDraft: WorkbenchContextDraft;
  branchSummary: WorkbenchBranchSummary;
  activeFile: OpenTab | undefined;
  includeActiveFile: boolean;
  pinnedPaths: ReadonlySet<string>;
  workspaceName: string;
  onToggleIncludeActiveFile: () => void;
  onAddToContext: (tab: OpenTab) => void;
  onRemoveFromContext: (path: string) => void;
  onClearContext: () => void;
  onApplyCode: (code: string, targetFile?: string) => void;
  onCreateFile: (code: string, suggestedName?: string) => void;
  onShowDiff: (code: string, targetFile?: string) => void;
  getFileReferenceAction: (reference: string) => WorkbenchFileReferenceAction | null;
  agents: Agent[];
  selectedAgentId: string | null;
  onAgentChange: (id: string) => void;
  sessionReady: boolean;
  criticEventsByMessage: Record<string, CriticEvent[]>;
  thinkingByMessage: Record<string, string>;
  toolEventsByMessage: Record<string, ToolTraceEvent[]>;
  approvalEventsByMessage: Record<string, ApprovalCardState[]>;
  onApprovalDecision: (approvalRequestId: string, decision: ApprovalDecision) => void;
}>) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  const lastCriticEvent = lastAssistant
    ? criticEventsByMessage[lastAssistant.id]?.at(-1)
    : undefined;
  const criticStatus = lastCriticEvent ? formatCriticStatus(lastCriticEvent) : null;

  return (
    <div className="flex flex-col h-full border-l border-border">
      {/* Header */}
      <div className="flex flex-col gap-2 px-4 py-2 border-b border-border bg-card/50">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <ChatAgentSelector
            agents={agents}
            selectedId={selectedAgentId}
            onSelect={onAgentChange}
            disabled={isLoading}
          />
          <StatusLabel
            isLoading={isLoading}
            sessionReady={sessionReady}
            criticStatus={criticStatus}
          />
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <span className="font-medium text-sm truncate">AI Assistant</span>
        </div>
      </div>

      <WorkbenchBranchPanel summary={branchSummary} />

      {/* Messages */}
      <ScrollArea className="flex-1 px-4">
        <div className="py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <Sparkles className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground mb-2">Ask about your code</p>
              <p className="text-xs text-muted-foreground">The assistant can see your open file</p>
            </div>
          ) : (
            messages.map((message, index) => {
              const awaitingAssistant =
                isLoading &&
                message.role === 'assistant' &&
                index === messages.length - 1 &&
                !getMessageText(message).trim();
              return (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-3',
                    message.role === 'user' ? 'justify-end' : 'justify-start',
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      'rounded-xl px-3 py-2 max-w-[85%] text-sm',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary/50 border border-border/50',
                    )}
                  >
                    {message.role === 'user' ? (
                      <span className="whitespace-pre-wrap">{getMessageText(message)}</span>
                    ) : (
                      <AssistantContent
                        message={message}
                        awaiting={awaitingAssistant}
                        contextFiles={getAssistantContextFiles(contextDraft)}
                        activeFile={null}
                        onApplyCode={onApplyCode}
                        onCreateFile={onCreateFile}
                        onShowDiff={onShowDiff}
                        getFileReferenceAction={getFileReferenceAction}
                        criticEvents={criticEventsByMessage[message.id]}
                        thinking={thinkingByMessage[message.id]}
                        toolEvents={toolEventsByMessage[message.id]}
                        approvals={approvalEventsByMessage[message.id]}
                        onApprovalDecision={onApprovalDecision}
                      />
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-border bg-card/30">
        <WorkbenchContextPanel
          contextDraft={contextDraft}
          activeFile={activeFile}
          includeActiveFile={includeActiveFile}
          pinnedPaths={pinnedPaths}
          workspaceName={workspaceName}
          onToggleIncludeActiveFile={onToggleIncludeActiveFile}
          onAddToContext={onAddToContext}
          onRemoveFromContext={onRemoveFromContext}
          onClearContext={onClearContext}
        />
        <div className="flex gap-2">
          <Textarea
            placeholder="Ask about your code..."
            value={chatInput}
            onChange={(e) => {
              setChatInput(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSendMessage();
              }
            }}
            className="min-h-[60px] max-h-[120px] text-sm resize-none"
          />
          <Button
            size="icon"
            aria-label="Send message"
            onClick={onSendMessage}
            disabled={!chatInput.trim() || isLoading || !sessionReady}
            className="flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function WorkbenchBranchPanel({ summary }: Readonly<{ summary: WorkbenchBranchSummary }>) {
  return (
    <div className="border-b border-border bg-card/30 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            <GitBranch className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{summary.branchLabel}</span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {summary.workspaceName} · {summary.stateLabel}
          </p>
        </div>
        <span className="rounded-md border border-border bg-background px-2 py-0.5 text-xs">
          {summary.changedFiles.length} changed
        </span>
      </div>

      {summary.changedFiles.length > 0 && (
        <div className="mt-2 space-y-1">
          {summary.changedFiles.map((file) => (
            <div
              key={file.path}
              className="flex items-center justify-between gap-2 rounded border border-border/70 bg-background/60 px-2 py-1 text-xs"
            >
              <span className="truncate">{file.name}</span>
              <span className="shrink-0 text-muted-foreground">
                {file.state === 'pending_review' ? 'review pending' : 'modified'}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 space-y-1">
        {summary.providers.map((provider) => (
          <div key={provider.label} className="text-[11px] leading-snug text-muted-foreground">
            <span className="font-medium text-foreground">{provider.label} unavailable:</span>{' '}
            {provider.description}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Context panel (small sub-components)
// ---------------------------------------------------------------------------

function WorkbenchContextPanel({
  contextDraft,
  activeFile,
  includeActiveFile,
  pinnedPaths,
  workspaceName,
  onToggleIncludeActiveFile,
  onAddToContext,
  onRemoveFromContext,
  onClearContext,
}: Readonly<{
  contextDraft: WorkbenchContextDraft;
  activeFile: OpenTab | undefined;
  includeActiveFile: boolean;
  pinnedPaths: ReadonlySet<string>;
  workspaceName: string;
  onToggleIncludeActiveFile: () => void;
  onAddToContext: (tab: OpenTab) => void;
  onRemoveFromContext: (path: string) => void;
  onClearContext: () => void;
}>) {
  if (contextDraft.entries.length === 0 && !activeFile) return null;

  const activeIsPinned = Boolean(activeFile && pinnedPaths.has(activeFile.path));
  const activeStatus = activeIsPinned
    ? 'Pinned'
    : includeActiveFile
      ? 'Auto-included'
      : 'Not included';

  return (
    <div className="mb-2 rounded-md border border-border bg-background/60 p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">Code context</span>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Workspace: {workspaceName}. {contextDraft.includedCount} file
            {contextDraft.includedCount === 1 ? '' : 's'} will be sent with the next message
            {contextDraft.totalCharacters > 0
              ? ` (${contextDraft.totalCharacters.toLocaleString()} chars)`
              : ''}
            .
          </p>
        </div>
        {pinnedPaths.size > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px] text-muted-foreground"
            onClick={onClearContext}
          >
            Clear
          </Button>
        )}
      </div>

      {activeFile && (
        <div className="mt-2 rounded border border-border/70 bg-card/50 p-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs">
                <FileCode className="h-3.5 w-3.5 text-primary" />
                <span className="truncate font-medium">{activeFile.name}</span>
                {activeFile.isDirty && (
                  <span className="shrink-0 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                    unsaved
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                Active file · {activeStatus}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!activeIsPinned && (
                <Button
                  variant={includeActiveFile ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={onToggleIncludeActiveFile}
                >
                  {includeActiveFile ? 'Exclude' : 'Include'}
                </Button>
              )}
              {!activeIsPinned && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    onAddToContext(activeFile);
                  }}
                >
                  Pin
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {contextDraft.entries.length > 0 && (
        <div className="mt-2 space-y-1">
          {contextDraft.entries.map((entry) => (
            <div
              key={entry.path}
              className={cn(
                'flex items-center justify-between gap-2 rounded border px-2 py-1.5 text-xs',
                entry.status === 'included'
                  ? 'border-border/70 bg-secondary/35'
                  : 'border-destructive/25 bg-destructive/5',
              )}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate font-medium">{entry.name}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {entry.source === 'active' ? 'active' : 'pinned'}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {entry.status === 'included'
                    ? `${entry.language ?? 'text'} · ${entry.characters.toLocaleString()} chars`
                    : 'Excluded from the next message'}
                </p>
              </div>
              {entry.source === 'pinned' && (
                <button
                  type="button"
                  aria-label={`Remove ${entry.name} from context`}
                  onClick={() => {
                    onRemoveFromContext(entry.path);
                  }}
                  className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {contextDraft.warnings.length > 0 && (
        <div className="mt-2 space-y-1">
          {contextDraft.warnings.map((warning) => (
            <p
              key={warning}
              className="text-[11px] leading-snug text-amber-700 dark:text-amber-300"
            >
              {warning}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function getFreshContextFiles(contextFiles: OpenTab[], openTabs: OpenTab[]): OpenTab[] {
  return contextFiles.map((contextFile) => {
    const current = openTabs.find((tab) => tab.path === contextFile.path);
    return current ?? contextFile;
  });
}

function getAssistantContextFiles(
  contextDraft: WorkbenchContextDraft,
): { path: string; name: string }[] {
  return contextDraft.sanitisedFiles.map((file) => ({
    path: file.path,
    name: file.path.split('/').pop() ?? file.path,
  }));
}

function fileReferenceLabel(status: WorkbenchFileReferenceStatus, path: string): string {
  switch (status) {
    case 'available':
      return `Open ${path} in workbench`;
    case 'no_workspace':
      return 'Open a workspace before opening file references';
    case 'outside_workspace':
      return 'This file reference is outside the active workspace';
    case 'directory':
      return 'This reference points to a folder, not a file';
    case 'unsupported':
      return 'This file type is not available for workbench preview';
    case 'not_found':
      return 'This file was not found in the active workspace';
  }
}

// ---------------------------------------------------------------------------
// Main IDEWithChat component
// ---------------------------------------------------------------------------

export interface IDEWithChatProps {
  fileTree?: FileNode[];
}

export function IDEWithChat({ fileTree: initialFileTree }: Readonly<IDEWithChatProps>) {
  // File System Access API
  const fs = useFileSystem();

  // Use FS API tree when a directory is open, otherwise fall back to props or empty
  const fileTree = fs.isDirectoryOpen ? fs.fileTree : (initialFileTree ?? []);

  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pathInput, setPathInput] = useState('');
  const [isPathDialogOpen, setIsPathDialogOpen] = useState(false);
  const [projectPathInput, setProjectPathInput] = useState('');
  const [activeProject, setActiveProject] = useState<ProjectRecord | null>(null);
  const [projectOpenError, setProjectOpenError] = useState<string | null>(null);
  const [isOpeningBackendProject, setIsOpeningBackendProject] = useState(false);
  const [isApprovingProjectInstructions, setIsApprovingProjectInstructions] = useState(false);
  const [isAssessingProject, setIsAssessingProject] = useState(false);
  const [isStartingOnboardingDraft, setIsStartingOnboardingDraft] = useState(false);
  const [isSubmittingOnboardingAnswer, setIsSubmittingOnboardingAnswer] = useState(false);
  const [isReviewingOnboardingDraft, setIsReviewingOnboardingDraft] = useState(false);
  const [isPreparingInstructionUpdates, setIsPreparingInstructionUpdates] = useState(false);
  const [isDecidingInstructionUpdate, setIsDecidingInstructionUpdate] = useState(false);
  const [onboardingAnswer, setOnboardingAnswer] = useState('');
  const [onboardingReviewComment, setOnboardingReviewComment] = useState('');

  // Panel visibility
  const [showExplorer, setShowExplorer] = useState(true);
  const [explorerCollapseSignal, setExplorerCollapseSignal] = useState(0);
  const [showChat, setShowChat] = useState(true);
  const [showTerminal, setShowTerminal] = useState(false);

  // Chat state — harness + agent session
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [contextFiles, setContextFiles] = useState<OpenTab[]>([]);
  const [includeActiveFile, setIncludeActiveFile] = useState(true);
  const [editProposal, setEditProposal] = useState<WorkbenchEditProposal | null>(null);

  const workspaceName = activeProject?.name ?? fs.rootName ?? 'No folder open';
  const activeFile = openTabs.find((tab) => tab.path === activeTab);
  const freshContextFiles = useMemo(
    () => getFreshContextFiles(contextFiles, openTabs),
    [contextFiles, openTabs],
  );
  const branchSummary = useMemo(
    () =>
      buildWorkbenchBranchSummary({
        workspaceName,
        openTabs,
        pendingProposalPath: editProposal?.path,
      }),
    [editProposal?.path, workspaceName, openTabs],
  );
  const contextDraft = useMemo(
    () =>
      buildWorkbenchContextDraft({
        pinnedFiles: freshContextFiles,
        activeFile,
        includeActiveFile,
      }),
    [freshContextFiles, activeFile, includeActiveFile],
  );
  const pinnedContextPaths = useMemo(
    () => new Set(contextFiles.map((file) => file.path)),
    [contextFiles],
  );
  const onboardingState = projectOnboardingState(activeProject);
  const onboardingAssessment = projectOnboardingAssessment(activeProject);
  const onboardingDraft = projectOnboardingDraft(activeProject);
  const onboardingDialogue = projectOnboardingDialogue(activeProject);
  const instructionUpdateCandidates = projectInstructionUpdateCandidates(activeProject);
  const instructionUpdateProposal = projectInstructionUpdateProposal(activeProject);
  const projectBindingStatus = getProjectBindingStatus(activeProject, fs.rootName);
  const projectWritesApproved = !activeProject || onboardingState === 'approved';
  const canSaveActiveFile = Boolean(activeFile?.isDirty && projectWritesApproved);
  const canApproveProjectInstructions = canManuallyApproveProjectInstructions({
    project: activeProject,
    onboardingState,
    onboardingAssessment,
  });
  const showInstructionUpdatesPanel = hasInstructionUpdateReview(
    instructionUpdateCandidates,
    instructionUpdateProposal,
  );

  const {
    messages,
    sendMessage,
    status,
    error: harnessError,
    setError: setHarnessError,
    criticEventsByMessage,
    thinkingByMessage,
    toolEventsByMessage,
    approvalEventsByMessage,
    decideApproval,
  } = useHarnessChat(sessionId);

  useEffect(() => {
    void (async () => {
      try {
        const list = await apiGet<Agent[]>(apiPath('agents'));
        const next = list ?? [];
        setAgents(next);
        const def = pickDefaultAgentForMode(next, 'project');
        if (def) {
          setSelectedAgentId((prev) => prev ?? def.id);
        }
      } catch (e) {
        toast.error(e instanceof ApiRequestError ? e.message : 'Failed to load agents');
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedAgentId) return;
    void (async () => {
      try {
        const body: { agentId: string; mode: 'project'; projectId?: string } = {
          agentId: selectedAgentId,
          mode: 'project',
        };
        if (activeProject?.id) body.projectId = activeProject.id;
        const session = await apiPost<SessionRecord>(apiPath('sessions'), body);
        if (session?.id) {
          setSessionId(session.id);
        } else {
          setSessionId(null);
          toast.error('Failed to create chat session');
        }
      } catch (e) {
        setSessionId(null);
        toast.error(e instanceof ApiRequestError ? e.message : 'Failed to create session');
      }
    })();
  }, [activeProject?.id, selectedAgentId]);

  useEffect(() => {
    if (harnessError) {
      toast.error(harnessError);
      setHarnessError(null);
    }
  }, [harnessError, setHarnessError]);

  const isLoading = status === 'streaming';

  const clearProjectContext = useCallback(() => {
    setOpenTabs([]);
    setActiveTab(null);
    setContextFiles([]);
    setEditProposal(null);
    setChatInput('');
    setOnboardingAnswer('');
    setOnboardingReviewComment('');
    setShowTerminal(false);
    fs.closeDirectory();
  }, [fs]);

  const handleOpenBackendProject = useCallback(async () => {
    const path = projectPathInput.trim();
    if (!path) {
      setProjectOpenError(null);
      await fs.openDirectory();
      return;
    }

    setIsOpeningBackendProject(true);
    setProjectOpenError(null);
    try {
      const project = await apiPost<ProjectRecord>(apiPath('projects', 'open'), { path });
      if (!project) {
        throw new ApiRequestError('Failed to open Project', 500);
      }
      clearProjectContext();
      setActiveProject(project);
      setSessionId(null);
      toast.success(`Opened ${project.name}`);
    } catch (error) {
      setActiveProject(null);
      setSessionId(null);
      clearProjectContext();
      const message =
        error instanceof ApiRequestError && error.code !== 'PROJECT_UNAVAILABLE'
          ? error.message
          : 'That Project folder could not be opened';
      setProjectOpenError(message);
      toast.error(message);
    } finally {
      setIsOpeningBackendProject(false);
    }
  }, [clearProjectContext, fs, projectPathInput]);

  const handleApproveProjectInstructions = useCallback(async () => {
    if (!activeProject?.id) return;
    setIsApprovingProjectInstructions(true);
    setProjectOpenError(null);
    try {
      const project = await apiPost<ProjectRecord>(
        apiPath('projects', activeProject.id, 'onboarding', 'approve'),
        { reviewer: 'User' },
      );
      if (!project) throw new ApiRequestError('Failed to approve project instructions', 500);
      setActiveProject(project);
      toast.success('Project instructions approved');
    } catch (error) {
      const message =
        error instanceof ApiRequestError ? error.message : 'Failed to approve project instructions';
      setProjectOpenError(message);
      toast.error(message);
    } finally {
      setIsApprovingProjectInstructions(false);
    }
  }, [activeProject?.id]);

  const handleReviewOnboardingDraft = useCallback(
    async (decision: 'approve' | 'reject' | 'request_changes') => {
      if (!activeProject?.id) return;
      const comment = onboardingReviewComment.trim();
      if (decision !== 'approve' && !comment) return;
      setIsReviewingOnboardingDraft(true);
      setProjectOpenError(null);
      try {
        const project = await apiPost<ProjectRecord>(
          apiPath('projects', activeProject.id, 'onboarding', 'review'),
          {
            decision,
            reviewer: 'User',
            ...(comment ? { comment } : {}),
          },
        );
        if (!project) throw new ApiRequestError('Failed to review project instructions', 500);
        setActiveProject(project);
        setOnboardingReviewComment('');
        toast.success(
          decision === 'approve'
            ? 'Project instructions approved'
            : 'Project instruction feedback saved',
        );
      } catch (error) {
        const message =
          error instanceof ApiRequestError
            ? error.message
            : 'Failed to review project instructions';
        setProjectOpenError(message);
        toast.error(message);
      } finally {
        setIsReviewingOnboardingDraft(false);
      }
    },
    [activeProject?.id, onboardingReviewComment],
  );

  const handleAssessProject = useCallback(async () => {
    if (!activeProject?.id) return;
    setIsAssessingProject(true);
    setProjectOpenError(null);
    try {
      const project = await apiPost<ProjectRecord>(
        apiPath('projects', activeProject.id, 'onboarding', 'refresh'),
        {},
      );
      if (!project) throw new ApiRequestError('Failed to assess project', 500);
      setActiveProject(project);
      const refresh = project.metadata.onboardingRefresh as { materialDrift?: unknown } | undefined;
      toast.success(
        refresh?.materialDrift ? 'Project instructions need review' : 'Project assessment updated',
      );
    } catch (error) {
      const message = error instanceof ApiRequestError ? error.message : 'Failed to assess project';
      setProjectOpenError(message);
      toast.error(message);
    } finally {
      setIsAssessingProject(false);
    }
  }, [activeProject?.id]);

  const handlePrepareInstructionUpdates = useCallback(async () => {
    if (!activeProject?.id) return;
    setIsPreparingInstructionUpdates(true);
    setProjectOpenError(null);
    try {
      const project = await apiPost<ProjectRecord>(
        apiPath('projects', activeProject.id, 'instruction-updates', 'closeout'),
        {},
      );
      if (!project) throw new ApiRequestError('Failed to prepare closeout updates', 500);
      setActiveProject(project);
      toast.success('Closeout updates prepared');
    } catch (error) {
      const message =
        error instanceof ApiRequestError ? error.message : 'Failed to prepare closeout updates';
      setProjectOpenError(message);
      toast.error(message);
    } finally {
      setIsPreparingInstructionUpdates(false);
    }
  }, [activeProject?.id]);

  const handleInstructionUpdateDecision = useCallback(
    async (candidateId: string, decision: 'apply' | 'reject') => {
      if (!activeProject?.id) return;
      setIsDecidingInstructionUpdate(true);
      setProjectOpenError(null);
      try {
        const project = await apiPost<ProjectRecord>(
          apiPath(
            'projects',
            activeProject.id,
            'instruction-updates',
            'candidates',
            candidateId,
            decision,
          ),
          { reviewer: 'User' },
        );
        if (!project) throw new ApiRequestError('Failed to review closeout update', 500);
        setActiveProject(project);
        toast.success(decision === 'apply' ? 'Instruction update applied' : 'Update rejected');
      } catch (error) {
        const message =
          error instanceof ApiRequestError ? error.message : 'Failed to review closeout update';
        setProjectOpenError(message);
        toast.error(message);
      } finally {
        setIsDecidingInstructionUpdate(false);
      }
    },
    [activeProject?.id],
  );

  const handleStartOnboardingDraft = useCallback(async () => {
    if (!activeProject?.id) return;
    setIsStartingOnboardingDraft(true);
    setProjectOpenError(null);
    try {
      const project = await apiPost<ProjectRecord>(
        apiPath('projects', activeProject.id, 'onboarding', 'draft'),
        {},
      );
      if (!project) throw new ApiRequestError('Failed to start onboarding draft', 500);
      setActiveProject(project);
      toast.success('Onboarding draft started');
    } catch (error) {
      const message =
        error instanceof ApiRequestError ? error.message : 'Failed to start onboarding draft';
      setProjectOpenError(message);
      toast.error(message);
    } finally {
      setIsStartingOnboardingDraft(false);
    }
  }, [activeProject?.id]);

  const handleSubmitOnboardingAnswer = useCallback(async () => {
    if (!activeProject?.id || !onboardingAnswer.trim()) return;
    setIsSubmittingOnboardingAnswer(true);
    setProjectOpenError(null);
    try {
      const project = await apiPost<ProjectRecord>(
        apiPath('projects', activeProject.id, 'onboarding', 'answer'),
        {
          questionId: onboardingDialogue?.activeQuestionId,
          answer: onboardingAnswer.trim(),
        },
      );
      if (!project) throw new ApiRequestError('Failed to save onboarding answer', 500);
      setActiveProject(project);
      setOnboardingAnswer('');
      toast.success('Onboarding draft updated');
    } catch (error) {
      const message =
        error instanceof ApiRequestError ? error.message : 'Failed to save onboarding answer';
      setProjectOpenError(message);
      toast.error(message);
    } finally {
      setIsSubmittingOnboardingAnswer(false);
    }
  }, [activeProject?.id, onboardingAnswer, onboardingDialogue?.activeQuestionId]);

  // --- File operations ---

  const findFileByPath = useCallback(
    (path: string, nodes: FileNode[] = fileTree): FileNode | null => {
      for (const node of nodes) {
        if (node.path === path) return node;
        if (node.children) {
          const found = findFileByPath(path, node.children);
          if (found) return found;
        }
      }
      return null;
    },
    [fileTree],
  );

  const handleFileSelect = useCallback(
    async (node: FileNode) => {
      if (node.type !== 'file') return;
      const exists = openTabs.some((tab) => tab.path === node.path);
      if (!exists) {
        let content = node.content ?? '';
        // Read from filesystem if handle is available
        if (node.handle) {
          try {
            content = await fs.readFile(node);
          } catch {
            content = `// Failed to read ${node.path}\n`;
          }
        }
        const newTab: OpenTab = {
          path: node.path,
          name: node.name,
          content,
          isDirty: false,
          language: getLanguage(node.name),
          handle: node.handle as FileSystemFileHandle | undefined,
        };
        setOpenTabs((prev) => [...prev, newTab]);
      }
      setActiveTab(node.path);
    },
    [openTabs, fs],
  );

  const handleCloseTab = useCallback(
    (path: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setOpenTabs((prev) => prev.filter((tab) => tab.path !== path));
      if (activeTab === path) {
        const remaining = openTabs.filter((tab) => tab.path !== path);
        const last = remaining.at(-1);
        setActiveTab(last?.path ?? null);
      }
    },
    [activeTab, openTabs],
  );

  const handleContentChange = useCallback(
    (content: string) => {
      if (!activeTab) return;
      setOpenTabs((prev) => updateWorkbenchTabContent(prev, activeTab, content));
    },
    [activeTab],
  );

  const handleSave = useCallback(async () => {
    if (!activeTab || !activeFile) return;
    if (!projectWritesApproved) {
      toast.error('Approve project instructions before saving changes');
      return;
    }
    // Write to filesystem if handle is available
    if (activeFile.handle) {
      const node: FileNode = {
        name: activeFile.name,
        path: activeFile.path,
        type: 'file',
        handle: activeFile.handle,
      };
      const ok = await fs.writeFile(node, activeFile.content);
      if (!ok) {
        toast.error(`Failed to save ${activeFile.name}`, {
          description: 'The browser may have lost write permission. Try re-opening the folder.',
        });
        return;
      }
      toast.success(`Saved ${activeFile.name}`);
    } else {
      toast.info(`${activeFile.name} updated in editor`, {
        description: 'Open a folder first to save changes to disk.',
      });
    }
    setOpenTabs((prev) =>
      prev.map((tab) => (tab.path === activeTab ? { ...tab, isDirty: false } : tab)),
    );
  }, [activeTab, activeFile, fs, projectWritesApproved]);

  // --- Context management ---

  const handleAddToContext = useCallback(
    (tab: OpenTab) => {
      if (!contextFiles.some((f) => f.path === tab.path)) {
        setContextFiles((prev) => [...prev, tab]);
      }
    },
    [contextFiles],
  );

  const handleRemoveFromContext = useCallback((path: string) => {
    setContextFiles((prev) => prev.filter((f) => f.path !== path));
  }, []);

  const handleClearContext = useCallback(() => {
    setContextFiles([]);
  }, []);

  const handleToggleIncludeActiveFile = useCallback(() => {
    setIncludeActiveFile((current) => !current);
  }, []);

  const handleAddNodeToContext = useCallback(
    async (node: FileNode) => {
      if (node.type !== 'file') return;
      const openTab = openTabs.find((tab) => tab.path === node.path);
      if (openTab) {
        handleAddToContext(openTab);
        return;
      }

      let content = node.content ?? '';
      if (node.handle) {
        try {
          content = await fs.readFile(node);
        } catch {
          content = `// Failed to read ${node.path}\n`;
        }
      }

      handleAddToContext({
        path: node.path,
        name: node.name,
        content,
        isDirty: false,
        language: getLanguage(node.name),
        handle: node.handle as FileSystemFileHandle | undefined,
      });
    },
    [fs, handleAddToContext, openTabs],
  );

  // --- Code apply from AI ---

  const handleApplyCode = useCallback(
    (code: string, targetFile?: string) => {
      if (!targetFile) return;
      const existing = openTabs.find((tab) => tab.path === targetFile);
      if (existing) {
        setEditProposal(
          createWorkbenchEditProposal({
            path: targetFile,
            before: existing.content,
            after: code,
          }),
        );
        setActiveTab(targetFile);
      } else {
        const name = targetFile.split('/').pop() ?? 'untitled';
        setEditProposal(
          createWorkbenchEditProposal({
            path: targetFile,
            before: '',
            after: code,
          }),
        );
        setOpenTabs((prev) => [
          ...prev,
          { path: targetFile, name, content: '', isDirty: false, language: getLanguage(name) },
        ]);
        setActiveTab(targetFile);
      }
    },
    [openTabs],
  );

  const handleRejectProposal = useCallback(() => {
    setEditProposal(null);
  }, []);

  const handleApplyProposal = useCallback(() => {
    if (!editProposal) return;
    setOpenTabs((prev) =>
      prev.map((tab) =>
        tab.path === editProposal.path
          ? { ...tab, content: editProposal.after, isDirty: true }
          : tab,
      ),
    );
    setActiveTab(editProposal.path);
    setEditProposal(null);
  }, [editProposal]);

  const handleCreateFile = useCallback((code: string, suggestedName = 'new-file.ts') => {
    const path = `/src/${suggestedName}`;
    setOpenTabs((prev) => [
      ...prev,
      {
        path,
        name: suggestedName,
        content: code,
        isDirty: true,
        language: getLanguage(suggestedName),
      },
    ]);
    setActiveTab(path);
  }, []);

  // --- Path dialog ---

  const handleLoadFromPath = useCallback(() => {
    if (!pathInput.trim()) return;
    const file = findFileByPath(pathInput);
    if (file?.type === 'file') {
      handleFileSelect(file);
    } else {
      const name = pathInput.split('/').pop() ?? 'untitled';
      setOpenTabs((prev) => [
        ...prev,
        {
          path: pathInput,
          name,
          content: `// File: ${pathInput}\n`,
          isDirty: false,
          language: getLanguage(name),
        },
      ]);
      setActiveTab(pathInput);
    }
    setPathInput('');
    setIsPathDialogOpen(false);
  }, [pathInput, findFileByPath, handleFileSelect]);

  const getFileReferenceAction = useCallback(
    (reference: string): WorkbenchFileReferenceAction | null => {
      const parsed = parseWorkbenchFileReference(reference);
      if (!parsed) return null;

      if (fileTree.length === 0) {
        const status: WorkbenchFileReferenceStatus = 'no_workspace';
        return {
          path: parsed.path,
          status,
          label: fileReferenceLabel(status, parsed.path),
        };
      }

      if (!isSupportedWorkbenchTextPath(parsed.path)) {
        const status: WorkbenchFileReferenceStatus = 'unsupported';
        return {
          path: parsed.path,
          status,
          label: fileReferenceLabel(status, parsed.path),
        };
      }

      const node = findFileByPath(parsed.path);
      const status: WorkbenchFileReferenceStatus =
        node?.type === 'file'
          ? 'available'
          : node?.type === 'directory'
            ? 'directory'
            : 'not_found';

      return {
        path: parsed.path,
        status,
        label: fileReferenceLabel(status, parsed.path),
        open:
          status === 'available' && node
            ? () => {
                handleFileSelect(node).catch(() => {
                  toast.error(`Failed to open ${node.name}`);
                });
              }
            : undefined,
      };
    },
    [fileTree.length, findFileByPath, handleFileSelect],
  );

  // --- Chat send ---

  const handleSendMessage = useCallback(() => {
    const userLine = chatInput.trim();
    if (!userLine || !sessionId) return;
    const prefix = formatFileContext(contextDraft.sanitisedFiles);
    const messageForApi = prefix ? `${prefix}\n${userLine}` : userLine;
    sendMessage(messageForApi, userLine).catch(() => {});
    setChatInput('');
  }, [chatInput, sessionId, contextDraft, sendMessage]);

  // --- Keyboard shortcuts ---

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    globalThis.addEventListener('keydown', onKeyDown);
    return () => {
      globalThis.removeEventListener('keydown', onKeyDown);
    };
  }, [handleSave]);

  // --- Filter file tree by search ---

  const filteredFileTree = useMemo(() => {
    if (!searchQuery.trim()) return fileTree;

    function filterNodes(nodes: FileNode[]): FileNode[] {
      return nodes.reduce<FileNode[]>((acc, node) => {
        if (node.type === 'directory') {
          const filteredChildren = node.children ? filterNodes(node.children) : [];
          if (filteredChildren.length > 0) {
            acc.push({ ...node, children: filteredChildren });
          }
        } else if (node.name.toLowerCase().includes(searchQuery.toLowerCase())) {
          acc.push(node);
        }
        return acc;
      }, []);
    }

    return filterNodes(fileTree);
  }, [fileTree, searchQuery]);

  return (
    <div className="flex flex-col h-full bg-background">
      <IDEToolbar
        showExplorer={showExplorer}
        setShowExplorer={setShowExplorer}
        showTerminal={showTerminal}
        setShowTerminal={setShowTerminal}
        showChat={showChat}
        setShowChat={setShowChat}
        activeFilePath={activeFile?.path ?? null}
        activeFileIsDirty={activeFile?.isDirty ?? false}
        canSaveActiveFile={canSaveActiveFile}
        onSave={handleSave}
        isPathDialogOpen={isPathDialogOpen}
        setIsPathDialogOpen={setIsPathDialogOpen}
        pathInput={pathInput}
        setPathInput={setPathInput}
        onLoadFromPath={handleLoadFromPath}
        isLoadingFolder={fs.isLoading}
        isOpeningFolder={fs.isOpeningDirectory}
        rootName={fs.rootName}
        onRefreshFolder={fs.refresh}
        onCloseFolder={fs.closeDirectory}
        canUseProjectTools={Boolean(activeProject)}
      />

      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* File Explorer */}
        {showExplorer && (
          <>
            <ResizablePanel defaultSize={15} minSize={10} maxSize={30}>
              <div className="flex flex-col h-full bg-card/30">
                <div className="p-2 border-b border-border">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      className="pl-8 h-8 text-sm"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                      }}
                    />
                  </div>
                </div>
                <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between gap-2 min-w-0">
                  <span className="truncate">{fs.rootName ?? 'Explorer'}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {fs.isDirectoryOpen && filteredFileTree.length > 0 && !fs.isLoading && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs font-normal normal-case tracking-normal text-muted-foreground hover:text-foreground"
                        title="Collapse all folders in the tree"
                        aria-label="Collapse all folders"
                        onClick={() => {
                          setExplorerCollapseSignal((n) => n + 1);
                        }}
                      >
                        <ListCollapse className="h-3.5 w-3.5" aria-hidden />
                        <span className="hidden sm:inline">Collapse</span>
                      </Button>
                    )}
                    {fs.isLoading && (
                      <span className="text-xs animate-pulse normal-case tracking-normal">
                        Loading…
                      </span>
                    )}
                  </div>
                </div>
                <div
                  className="mx-2 mt-2 rounded-md border border-border bg-background px-3 py-2"
                  aria-label="Project binding"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Project
                    </span>
                    <ProjectBindingStatusBadge status={projectBindingStatus} />
                  </div>
                  {!fs.rootName && !activeProject && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="w-full gap-2"
                      onClick={() => {
                        handleOpenBackendProject().catch(() => {});
                      }}
                      disabled={isOpeningBackendProject || fs.isOpeningDirectory}
                    >
                      <FolderOpen className="h-4 w-4" />
                      {isOpeningBackendProject || fs.isOpeningDirectory
                        ? 'Opening...'
                        : 'Open Project'}
                    </Button>
                  )}
                  {activeProject && (
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <div className="truncate text-foreground">{activeProject.name}</div>
                      <div className="truncate">
                        Folder: {onboardingAssessment?.display.folderLabel ?? activeProject.name}
                      </div>
                      {activeProject.metadata.activeBranch && (
                        <div className="truncate">
                          Branch: {String(activeProject.metadata.activeBranch)}
                        </div>
                      )}
                      <div
                        className={cn(
                          'mt-2 flex items-start gap-2 rounded-md border px-2 py-2',
                          onboardingState === 'approved'
                            ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700'
                            : 'border-amber-500/35 bg-amber-500/10 text-foreground',
                        )}
                      >
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">
                            {projectOnboardingLabel(onboardingState)}
                          </div>
                          <div className="mt-1 leading-snug text-muted-foreground">
                            {projectOnboardingDescription(onboardingState)}
                          </div>
                          {canApproveProjectInstructions && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                className="h-7"
                                onClick={() => {
                                  handleApproveProjectInstructions().catch(() => {});
                                }}
                                disabled={isApprovingProjectInstructions}
                              >
                                {isApprovingProjectInstructions ? 'Approving...' : 'Approve setup'}
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                aria-label="Refresh project assessment"
                                title="Refresh project assessment"
                                onClick={() => {
                                  handleAssessProject().catch(() => {});
                                }}
                                disabled={isAssessingProject}
                              >
                                <RefreshCw
                                  className={cn(
                                    'h-3.5 w-3.5',
                                    isAssessingProject && 'animate-spin',
                                  )}
                                  aria-hidden
                                />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                      {onboardingAssessment && (
                        <ProjectOnboardingAssessmentPanel
                          assessment={onboardingAssessment}
                          isRefreshing={isAssessingProject}
                          onRefresh={() => {
                            handleAssessProject().catch(() => {});
                          }}
                        />
                      )}
                      {onboardingState !== 'approved' && onboardingAssessment && (
                        <ProjectOnboardingDraftPanel
                          draft={onboardingDraft}
                          dialogue={onboardingDialogue}
                          answer={onboardingAnswer}
                          isStarting={isStartingOnboardingDraft}
                          isSubmitting={isSubmittingOnboardingAnswer}
                          isReviewing={isReviewingOnboardingDraft}
                          reviewComment={onboardingReviewComment}
                          onStart={() => {
                            handleStartOnboardingDraft().catch(() => {});
                          }}
                          onAnswerChange={setOnboardingAnswer}
                          onSubmitAnswer={() => {
                            handleSubmitOnboardingAnswer().catch(() => {});
                          }}
                          onReviewCommentChange={setOnboardingReviewComment}
                          onApprove={() => {
                            handleReviewOnboardingDraft('approve').catch(() => {});
                          }}
                          onRequestChanges={() => {
                            handleReviewOnboardingDraft('request_changes').catch(() => {});
                          }}
                          onReject={() => {
                            handleReviewOnboardingDraft('reject').catch(() => {});
                          }}
                        />
                      )}
                      {showInstructionUpdatesPanel && (
                        <ProjectInstructionUpdatesPanel
                          candidates={instructionUpdateCandidates}
                          proposal={instructionUpdateProposal}
                          isPreparing={isPreparingInstructionUpdates}
                          isDeciding={isDecidingInstructionUpdate}
                          onPrepare={() => {
                            handlePrepareInstructionUpdates().catch(() => {});
                          }}
                          onApply={(candidateId) => {
                            handleInstructionUpdateDecision(candidateId, 'apply').catch(() => {});
                          }}
                          onReject={(candidateId) => {
                            handleInstructionUpdateDecision(candidateId, 'reject').catch(() => {});
                          }}
                        />
                      )}
                    </div>
                  )}
                  {!activeProject && fs.rootName && (
                    <div className="rounded-md border border-sky-500/35 bg-sky-500/10 px-2 py-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 truncate font-medium text-foreground">
                          {fs.rootName}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 shrink-0"
                          onClick={() => {
                            handleOpenBackendProject().catch(() => {});
                          }}
                          disabled={fs.isOpeningDirectory}
                        >
                          Change Folder
                        </Button>
                      </div>
                      <div className="mt-1 leading-snug text-muted-foreground">
                        Next: ask the agent to assess this project.
                      </div>
                    </div>
                  )}
                  <details className="mt-2 text-xs text-muted-foreground">
                    <summary className="cursor-pointer select-none">Use folder path</summary>
                    <div className="mt-2 flex gap-2">
                      <Input
                        aria-label="Project folder path"
                        aria-invalid={projectOpenError ? true : undefined}
                        aria-describedby={projectOpenError ? 'project-open-error' : undefined}
                        value={projectPathInput}
                        placeholder="Project folder path"
                        onChange={(event) => {
                          setProjectPathInput(event.target.value);
                          if (projectOpenError) setProjectOpenError(null);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            handleOpenBackendProject().catch(() => {});
                          }
                        }}
                        className="h-8 text-xs"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="shrink-0"
                        onClick={() => {
                          handleOpenBackendProject().catch(() => {});
                        }}
                        disabled={isOpeningBackendProject}
                      >
                        {isOpeningBackendProject ? 'Opening...' : 'Open Path'}
                      </Button>
                    </div>
                  </details>
                  {projectOpenError && (
                    <p id="project-open-error" className="mt-2 text-xs text-destructive">
                      {projectOpenError}
                    </p>
                  )}
                </div>
                {fs.needsFolderReconnect && (
                  <div className="mx-2 mt-2 rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-foreground">
                    <p className="mb-2 leading-snug">
                      Restore access to{' '}
                      <span className="font-medium">
                        {fs.pendingReconnectFolderName ?? 'your folder'}
                      </span>{' '}
                      after refresh (browser permission).
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      onClick={() => {
                        fs.reconnectFolder().catch(() => {});
                      }}
                    >
                      Restore folder…
                    </Button>
                  </div>
                )}
                {fs.error && <div className="px-3 py-2 text-xs text-destructive">{fs.error}</div>}
                <ScrollArea className="flex-1">
                  <div className="pb-4">
                    {filteredFileTree.length === 0 &&
                      !fs.isLoading &&
                      !fs.isDirectoryOpen &&
                      !fs.needsFolderReconnect && (
                        <div className="flex flex-col items-center justify-center gap-3 py-8 px-4 text-center">
                          <FolderOpen className="h-10 w-10 text-muted-foreground/50" />
                          <p className="text-sm text-muted-foreground">No folder open</p>
                          <p className="max-w-56 text-xs leading-snug text-muted-foreground">
                            Open a Project above to validate the folder and start setup.
                          </p>
                        </div>
                      )}
                    {filteredFileTree.length === 0 &&
                      !fs.isLoading &&
                      fs.isDirectoryOpen &&
                      !fs.error && (
                        <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                          {searchQuery.trim()
                            ? 'No files match your search.'
                            : 'This folder is empty, or everything here is hidden (ignored folders like node_modules).'}
                        </div>
                      )}
                    {filteredFileTree.map((node) => (
                      <FileTreeNode
                        key={node.path}
                        node={node}
                        onFileSelect={handleFileSelect}
                        onAddToContext={(n) => {
                          handleAddNodeToContext(n).catch(() => {
                            toast.error(`Failed to add ${n.name} to context`);
                          });
                        }}
                        selectedPath={activeTab}
                        contextPaths={contextFiles.map((f) => f.path)}
                        collapseTreeSignal={explorerCollapseSignal}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
          </>
        )}

        {/* Editor + Terminal */}
        <ResizablePanel defaultSize={showChat ? 50 : 85}>
          <ResizablePanelGroup direction="vertical">
            <ResizablePanel defaultSize={showTerminal ? 70 : 100} minSize={30}>
              <div className="flex flex-col h-full overflow-hidden">
                <EditorTabs
                  openTabs={openTabs}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  onCloseTab={handleCloseTab}
                />
                <EditorPanel
                  activeFile={activeFile}
                  editProposal={
                    editProposal && editProposal.path === activeFile?.path ? editProposal : null
                  }
                  onContentChange={handleContentChange}
                  onOpenPathDialog={() => {
                    setIsPathDialogOpen(true);
                  }}
                  onApplyProposal={handleApplyProposal}
                  onRejectProposal={handleRejectProposal}
                />
              </div>
            </ResizablePanel>

            {showTerminal && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={30} minSize={15} maxSize={60}>
                  <Terminal sessionId={sessionId} explorerFolderOpen={fs.isDirectoryOpen} />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </ResizablePanel>

        {/* Chat Panel */}
        {showChat && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={35} minSize={20} maxSize={50}>
              <ChatPanel
                messages={messages}
                isLoading={isLoading}
                chatInput={chatInput}
                setChatInput={setChatInput}
                onSendMessage={handleSendMessage}
                contextDraft={contextDraft}
                branchSummary={branchSummary}
                activeFile={activeFile}
                includeActiveFile={includeActiveFile}
                pinnedPaths={pinnedContextPaths}
                workspaceName={workspaceName}
                onToggleIncludeActiveFile={handleToggleIncludeActiveFile}
                onAddToContext={handleAddToContext}
                onRemoveFromContext={handleRemoveFromContext}
                onClearContext={handleClearContext}
                onApplyCode={handleApplyCode}
                onCreateFile={handleCreateFile}
                onShowDiff={handleApplyCode}
                getFileReferenceAction={getFileReferenceAction}
                agents={agents}
                selectedAgentId={selectedAgentId}
                onAgentChange={setSelectedAgentId}
                sessionReady={Boolean(sessionId)}
                criticEventsByMessage={criticEventsByMessage}
                thinkingByMessage={thinkingByMessage}
                toolEventsByMessage={toolEventsByMessage}
                approvalEventsByMessage={approvalEventsByMessage}
                onApprovalDecision={decideApproval}
              />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  );
}
