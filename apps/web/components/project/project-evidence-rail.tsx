'use client';

import type { ProjectProfile, WorkspaceEvent } from '@agent-platform/contracts';
import React, { useState } from 'react';

import type { ApprovalCardState, ToolTraceEvent } from '@/hooks/use-harness-chat';
import { cn } from '@/lib/cn';
import { ProjectActivityPanel } from './project-activity-panel';
import { ProjectGitHubPanel } from './project-git-github-panel';

type EvidenceView = 'activity' | 'git';

export function ProjectEvidenceRail({
  projectId,
  sessionId,
  profile,
  workspaceEventsByMessage,
  approvalEventsByMessage,
  toolEventsByMessage,
  refreshKey,
  projectInstructionsStatus,
  isStartingProjectInstructions,
  onStartProjectInstructions,
}: Readonly<{
  projectId: string | null;
  sessionId: string | null;
  profile: ProjectProfile;
  workspaceEventsByMessage?: Readonly<Record<string, readonly WorkspaceEvent[]>>;
  approvalEventsByMessage?: Readonly<Record<string, readonly ApprovalCardState[]>>;
  toolEventsByMessage?: Readonly<Record<string, readonly ToolTraceEvent[]>>;
  refreshKey?: number;
  projectInstructionsStatus?: 'approved' | 'draft_ready' | 'missing';
  isStartingProjectInstructions?: boolean;
  onStartProjectInstructions?: () => void;
}>) {
  const [view, setView] = useState<EvidenceView>('activity');
  if (!projectId) return null;

  return (
    <div
      className="flex h-full min-h-0 w-[360px] max-w-[30vw] shrink-0 flex-col overflow-hidden border-l border-border bg-background/95"
      aria-label="Project evidence"
    >
      <div
        role="tablist"
        aria-label="Project evidence views"
        className="flex border-b border-border p-1"
      >
        {(['activity', 'git'] as const).map((candidate) => (
          <button
            key={candidate}
            type="button"
            role="tab"
            id={`project-evidence-${candidate}-tab`}
            aria-controls={`project-evidence-${candidate}-panel`}
            aria-selected={view === candidate}
            className={cn(
              'flex-1 rounded px-2 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              view === candidate
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-accent',
            )}
            onClick={() => setView(candidate)}
          >
            {candidate === 'activity' ? 'Activity' : 'Git & GitHub'}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="project-evidence-activity-panel"
        aria-labelledby="project-evidence-activity-tab"
        hidden={view !== 'activity'}
        className="min-h-0 flex-1"
      >
        {view === 'activity' && (
          <ProjectActivityPanel
            embedded
            projectId={projectId}
            sessionId={sessionId}
            profile={profile}
            workspaceEventsByMessage={workspaceEventsByMessage}
            approvalEventsByMessage={approvalEventsByMessage}
            toolEventsByMessage={toolEventsByMessage}
            refreshKey={refreshKey}
          />
        )}
      </div>
      <div
        role="tabpanel"
        id="project-evidence-git-panel"
        aria-labelledby="project-evidence-git-tab"
        hidden={view !== 'git'}
        className="min-h-0 flex-1"
      >
        {view === 'git' && (
          <ProjectGitHubPanel
            embedded
            projectId={projectId}
            refreshKey={refreshKey}
            projectInstructionsStatus={projectInstructionsStatus}
            isStartingProjectInstructions={isStartingProjectInstructions}
            onStartProjectInstructions={onStartProjectInstructions}
          />
        )}
      </div>
    </div>
  );
}
