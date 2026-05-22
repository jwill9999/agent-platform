'use client';

import type {
  ExecutionPolicyMode,
  ExecutionPolicySettings,
  PlatformSettings,
  WorkspaceAreaListing,
  WorkspaceFilesResponse,
} from '@agent-platform/contracts';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Download,
  FileText,
  Folder,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

import { apiGet, apiPath, apiPut, ApiRequestError } from '@/lib/apiClient';
import {
  flattenWorkspaceFiles,
  formatFileSize,
  formatWorkspaceTimestamp,
} from '@/lib/workspace-files';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

function downloadPath(path: string): string {
  return `${apiPath('workspace', 'files', 'download')}?path=${encodeURIComponent(path)}`;
}

function areaCount(area: WorkspaceAreaListing): number {
  return area.files.filter((file) => file.kind === 'file').length;
}

const DEFAULT_EXECUTION_POLICY: ExecutionPolicySettings = {
  unknownToolPolicy: 'ask',
  unknownCommandPolicy: 'ask',
  workspaceWrite: 'ask',
  packageInstall: 'ask',
  network: 'ask',
  gitMutation: 'ask',
  container: 'ask',
};

const POLICY_OPTIONS: Array<{ value: ExecutionPolicyMode | 'ask' | 'block'; label: string }> = [
  { value: 'ask', label: 'Ask approval' },
  { value: 'block', label: 'Block' },
  { value: 'auto', label: 'Auto-run' },
];

function policyLabel(value: string): string {
  if (value === 'auto') return 'Auto-run';
  if (value === 'block') return 'Block';
  return 'Ask approval';
}

export function WorkspaceDashboard() {
  const [data, setData] = useState<WorkspaceFilesResponse | undefined>();
  const [executionPolicy, setExecutionPolicy] =
    useState<ExecutionPolicySettings>(DEFAULT_EXECUTION_POLICY);
  const [loading, setLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [files, settings] = await Promise.all([
        apiGet<WorkspaceFilesResponse>(apiPath('workspace', 'files')),
        apiGet<PlatformSettings>(apiPath('settings')),
      ]);
      setData(files);
      setExecutionPolicy(settings?.executionPolicy ?? DEFAULT_EXECUTION_POLICY);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const rows = useMemo(() => flattenWorkspaceFiles(data), [data]);

  const updateExecutionPolicy = useCallback(
    async (patch: Partial<ExecutionPolicySettings>) => {
      const next = { ...executionPolicy, ...patch };
      setExecutionPolicy(next);
      setSettingsSaving(true);
      setError(null);
      try {
        const updated = await apiPut<PlatformSettings>(apiPath('settings'), {
          executionPolicy: patch,
        });
        setExecutionPolicy(updated?.executionPolicy ?? next);
      } catch (err) {
        setExecutionPolicy(executionPolicy);
        setError(err instanceof ApiRequestError ? err.message : String(err));
      } finally {
        setSettingsSaving(false);
      }
    },
    [executionPolicy],
  );

  const policyRows = [
    {
      id: 'unknownCommandPolicy',
      label: 'Unknown commands',
      description: 'Commands that are not clearly read-only or destructive.',
      value: executionPolicy.unknownCommandPolicy,
      values: POLICY_OPTIONS.filter((option) => option.value !== 'auto'),
    },
    {
      id: 'unknownToolPolicy',
      label: 'Unknown tools',
      description: 'Registered tools that are not auto-approved by the agent allowlist.',
      value: executionPolicy.unknownToolPolicy,
      values: POLICY_OPTIONS.filter((option) => option.value !== 'auto'),
    },
    {
      id: 'workspaceWrite',
      label: 'Workspace writes',
      description: 'Commands that create, edit, move, or remove Project files.',
      value: executionPolicy.workspaceWrite,
      values: POLICY_OPTIONS,
    },
    {
      id: 'packageInstall',
      label: 'Package and script commands',
      description: 'Package managers and project script execution.',
      value: executionPolicy.packageInstall,
      values: POLICY_OPTIONS,
    },
    {
      id: 'network',
      label: 'Network commands',
      description: 'Commands that access external hosts or services.',
      value: executionPolicy.network,
      values: POLICY_OPTIONS,
    },
    {
      id: 'gitMutation',
      label: 'Git mutations',
      description: 'Git commands that modify local or remote repository state.',
      value: executionPolicy.gitMutation,
      values: POLICY_OPTIONS,
    },
    {
      id: 'container',
      label: 'Container commands',
      description: 'Docker, container, and runtime orchestration commands.',
      value: executionPolicy.container,
      values: POLICY_OPTIONS,
    },
  ] as const;

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Workspace</h1>
          <p className="text-sm text-muted-foreground">
            Files available inside the agent workspace
          </p>
        </div>
        <Button variant="outline" onClick={() => load()} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </Button>
      </header>

      {error && (
        <div className="flex items-center gap-2 px-6 py-3 bg-destructive/10 border-b border-destructive/20 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <section className="border border-border rounded-lg bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <h2 className="font-medium text-foreground">Execution policy</h2>
            </div>
            <Badge variant="outline">{settingsSaving ? 'Saving' : 'Workspace'}</Badge>
          </div>
          <div className="divide-y divide-border">
            {policyRows.map((row) => (
              <label
                key={row.id}
                className="grid gap-3 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_12rem]"
              >
                <span>
                  <span className="font-medium text-foreground">{row.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {row.description}
                  </span>
                </span>
                <select
                  className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                  value={row.value}
                  disabled={settingsSaving}
                  onChange={(event) => {
                    const value = event.target.value as ExecutionPolicySettings[typeof row.id];
                    updateExecutionPolicy({
                      [row.id]: value,
                    } as Partial<ExecutionPolicySettings>).catch(() => {});
                  }}
                >
                  {row.values.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
            Destructive host actions are always blocked. Current default:{' '}
            {policyLabel(executionPolicy.unknownCommandPolicy)} for unknown commands.
          </p>
        </section>

        {data && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {data.areas.map((area) => (
              <div key={area.area} className="border border-border rounded-lg bg-card p-4">
                <div className="flex items-center gap-2">
                  <Folder className="h-4 w-4 text-primary" />
                  <span className="font-medium text-foreground">{area.label}</span>
                </div>
                <p className="mt-2 text-2xl font-semibold text-foreground">{areaCount(area)}</p>
                <p className="text-xs text-muted-foreground">{area.path}</p>
              </div>
            ))}
          </div>
        )}

        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="font-medium text-foreground">Files</h2>
            <Badge variant="outline">
              {rows.filter((row) => row.kind === 'file').length} files
            </Badge>
          </div>

          {loading && (
            <div className="flex items-center justify-center h-56">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && rows.length === 0 && (
            <div className="flex flex-col items-center justify-center h-56 text-center">
              <Folder className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-foreground mb-1">No workspace files yet</h3>
              <p className="text-sm text-muted-foreground">
                Generated outputs and exports will appear here.
              </p>
            </div>
          )}

          {!loading && rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60 text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-4 py-2">Name</th>
                    <th className="text-left font-medium px-4 py-2">Area</th>
                    <th className="text-left font-medium px-4 py-2">Size</th>
                    <th className="text-left font-medium px-4 py-2">Modified</th>
                    <th className="text-right font-medium px-4 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((file) => (
                    <tr key={file.path} className="border-t border-border">
                      <td className="px-4 py-3 min-w-64">
                        <div className="flex items-start gap-2">
                          {file.kind === 'directory' ? (
                            <Folder className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          ) : (
                            <FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          )}
                          <div>
                            <p className="font-medium text-foreground">{file.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{file.path}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">{file.areaLabel}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {file.kind === 'file' ? formatFileSize(file.size) : 'Directory'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatWorkspaceTimestamp(file.modifiedAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {file.kind === 'file' ? (
                          <Button asChild variant="outline" size="sm">
                            <a href={downloadPath(file.path)}>
                              <Download className="h-4 w-4" />
                              Download
                            </a>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
