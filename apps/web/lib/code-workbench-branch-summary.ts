export type WorkbenchChangedFileState = 'modified' | 'pending_review';

export type WorkbenchChangedFile = {
  path: string;
  name: string;
  state: WorkbenchChangedFileState;
};

export type WorkbenchBranchProviderState = {
  label: string;
  status: 'unavailable';
  description: string;
};

export type WorkbenchBranchSummary = {
  workspaceName: string;
  branchLabel: string;
  stateLabel: 'Clean' | 'Dirty' | 'Review pending' | 'Unavailable';
  changedFiles: WorkbenchChangedFile[];
  providers: WorkbenchBranchProviderState[];
};

export type WorkbenchBranchTab = {
  path: string;
  name: string;
  isDirty: boolean;
};

const UNAVAILABLE_PROVIDERS: WorkbenchBranchProviderState[] = [
  {
    label: 'Git branch',
    status: 'unavailable',
    description: 'Repository and branch discovery is not connected in this workbench yet.',
  },
  {
    label: 'Remote checks',
    status: 'unavailable',
    description: 'GitHub, CodeQL, SonarQube, and review feedback belong to branch feedback status.',
  },
];

export function buildWorkbenchBranchSummary({
  workspaceName,
  openTabs,
  pendingProposalPath,
}: {
  workspaceName: string | null;
  openTabs: readonly WorkbenchBranchTab[];
  pendingProposalPath?: string | null;
}): WorkbenchBranchSummary {
  const changedFiles = new Map<string, WorkbenchChangedFile>();

  for (const tab of openTabs) {
    if (!tab.isDirty) continue;
    changedFiles.set(tab.path, { path: tab.path, name: tab.name, state: 'modified' });
  }

  if (pendingProposalPath) {
    const existing = openTabs.find((tab) => tab.path === pendingProposalPath);
    changedFiles.set(pendingProposalPath, {
      path: pendingProposalPath,
      name: existing?.name ?? pendingProposalPath.split('/').pop() ?? pendingProposalPath,
      state: 'pending_review',
    });
  }

  const files = [...changedFiles.values()];
  const stateLabel =
    files.length === 0
      ? 'Clean'
      : files.some((file) => file.state === 'pending_review')
        ? 'Review pending'
        : 'Dirty';

  return {
    workspaceName: workspaceName ?? 'No folder open',
    branchLabel: 'Branch not connected',
    stateLabel,
    changedFiles: files,
    providers: UNAVAILABLE_PROVIDERS,
  };
}
