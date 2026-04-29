'use client';

import type { WorkspaceAreaListing, WorkspaceFilesResponse } from '@agent-platform/contracts';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Download, FileText, Folder, Loader2, RefreshCw } from 'lucide-react';

import { apiGet, apiPath, ApiRequestError } from '@/lib/apiClient';
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

export function WorkspaceDashboard() {
  const [data, setData] = useState<WorkspaceFilesResponse | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await apiGet<WorkspaceFilesResponse>(apiPath('workspace', 'files')));
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
