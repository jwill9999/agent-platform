'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ProjectBranchListResult, ProjectDesktopRecord } from '@agent-platform/contracts';
import { GitBranch, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiGet, apiPath, apiPost, ApiRequestError } from '@/lib/apiClient';

type ProjectBranchSelectorProps = Readonly<{
  projectId: string | null;
  activeBranch?: string;
  disabled?: boolean;
  onProjectChanged: (project: ProjectDesktopRecord) => void;
  onError?: (message: string) => void;
}>;

export function ProjectBranchSelector({
  projectId,
  activeBranch,
  disabled,
  onProjectChanged,
  onError,
}: ProjectBranchSelectorProps) {
  const [branches, setBranches] = useState<ProjectBranchListResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);

  const loadBranches = useCallback(async () => {
    if (!projectId) {
      setBranches(null);
      setUnavailableReason(null);
      return;
    }
    setLoading(true);
    try {
      const result = await apiGet<ProjectBranchListResult>(apiPath('projects', projectId, 'branches'));
      setBranches(result ?? null);
      setUnavailableReason(null);
    } catch (error) {
      setBranches(null);
      setUnavailableReason(
        error instanceof ApiRequestError ? error.message : 'Branch information is unavailable.',
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadBranches();
  }, [loadBranches]);

  const currentBranch = branches?.currentBranch ?? activeBranch;
  const branchItems = useMemo(() => branches?.branches ?? [], [branches?.branches]);
  const branchSwitchDisabled = disabled || loading || switching || !branches?.clean;
  const dirtyWorktreeMessage =
    branches && !branches.clean
      ? 'Branch switching is disabled because this Project has uncommitted changes. Commit or stash them first, or use the terminal to handle the switch manually.'
      : null;

  const handleBranchChange = useCallback(
    async (branch: string) => {
      if (!projectId || branch === currentBranch) return;
      setSwitching(true);
      try {
        const project = await apiPost<ProjectDesktopRecord>(
          apiPath('projects', projectId, 'branches', 'checkout'),
          { branch },
        );
        if (project) {
          onProjectChanged(project);
        }
        await loadBranches();
      } catch (error) {
        const message =
          error instanceof ApiRequestError ? error.message : 'Failed to switch Project branch.';
        onError?.(message);
      } finally {
        setSwitching(false);
      }
    },
    [currentBranch, loadBranches, onError, onProjectChanged, projectId],
  );

  if (!projectId || (!currentBranch && !loading && !unavailableReason)) return null;

  return (
    <div
      className="inline-flex min-w-0 items-center gap-1.5"
      title={unavailableReason ?? dirtyWorktreeMessage ?? undefined}
    >
      {switching || loading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
      ) : (
        <GitBranch className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      )}
      <Select
        value={currentBranch ?? '__unavailable__'}
        onValueChange={handleBranchChange}
        disabled={branchSwitchDisabled || branchItems.length === 0}
      >
        <SelectTrigger
          aria-label={
            dirtyWorktreeMessage ? `Active branch. ${dirtyWorktreeMessage}` : 'Active branch'
          }
          className="h-8 max-w-[190px] text-sm sm:max-w-[240px]"
        >
          <SelectValue placeholder="No branch" />
        </SelectTrigger>
        <SelectContent>
          {branchItems.length > 0 ? (
            branchItems.map((branch) => (
              <SelectItem key={branch.name} value={branch.name}>
                {branch.name}
              </SelectItem>
            ))
          ) : (
            <SelectItem value="__unavailable__" disabled>
              {unavailableReason ?? 'No branches available'}
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
