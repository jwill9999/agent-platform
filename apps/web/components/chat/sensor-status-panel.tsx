'use client';

import type {
  SensorDashboardResponse,
  SensorFinding,
  SensorProviderAvailability,
  SensorResult,
} from '@agent-platform/contracts';
import {
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  PanelRightClose,
  PlugZap,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';

type Props = Readonly<{
  dashboard: SensorDashboardResponse | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}>;

function statusTone(status: SensorResult['status']) {
  if (status === 'passed') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (status === 'failed' || status === 'error') return 'text-red-700 bg-red-50 border-red-200';
  if (status === 'unavailable') return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-muted-foreground bg-muted border-border';
}

function providerTone(state: SensorProviderAvailability['state']) {
  if (state === 'available') return 'secondary';
  if (state === 'auth_required' || state === 'permission_denied') return 'destructive';
  return 'outline';
}

function severityTone(severity: SensorFinding['severity']) {
  if (severity === 'critical' || severity === 'high') return 'destructive';
  if (severity === 'medium') return 'outline';
  return 'secondary';
}

function compactProfile(profile: string): string {
  return profile.replaceAll('_', ' ');
}

function resultLabel(result: SensorResult): string {
  const label = result.sensorId.replace(/^quality_gate:/, '').replace(/^collector:/, '');
  return label.replaceAll('_', ' ');
}

function latestResults(results: readonly SensorResult[]): SensorResult[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    if (seen.has(result.sensorId)) return false;
    seen.add(result.sensorId);
    return true;
  });
}

export function SensorStatusPanel({ dashboard, loading, error, onRetry }: Props) {
  const [open, setOpen] = useState(false);

  if (!dashboard && !loading && !error) return null;

  const results = latestResults(dashboard?.recentResults ?? []);
  const summary = dashboard?.statusSummary;
  const hasIssues =
    (summary?.failed ?? 0) > 0 ||
    (summary?.unavailable ?? 0) > 0 ||
    (summary?.openFindings ?? 0) > 0;
  const codingDisabled = dashboard && !dashboard.codingSensorsRequired;
  const failed = summary?.failed ?? 0;
  const openFindings = summary?.openFindings ?? 0;
  const unavailable = summary?.unavailable ?? 0;
  const alertCount = failed + openFindings + unavailable;

  return (
    <aside
      className={cn(
        'hidden shrink-0 border-l border-border bg-background/95 md:flex',
        open ? 'w-[360px] max-w-[34vw]' : 'w-14',
      )}
      aria-label="Sensor feedback"
    >
      {!open ? (
        <button
          type="button"
          className="flex h-full w-full flex-col items-center gap-3 px-2 py-4 text-xs text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
          onClick={() => setOpen(true)}
          aria-label="Open sensors drawer"
          title="Open sensors drawer"
        >
          {hasIssues ? (
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          ) : (
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          )}
          <span className="[writing-mode:vertical-rl] rotate-180 font-medium tracking-wide">
            Sensors
          </span>
          {alertCount > 0 && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
              {alertCount}
            </span>
          )}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-w-0 items-center gap-2 border-b border-border px-3 py-3">
            <button
              type="button"
              className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              onClick={() => setOpen(false)}
              aria-label="Close sensors drawer"
              title="Close sensors drawer"
            >
              <PanelRightClose className="h-4 w-4" />
            </button>
            {hasIssues ? (
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            ) : (
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="font-medium">Sensors</span>
                {dashboard && (
                  <Badge variant={dashboard.codingSensorsRequired ? 'default' : 'outline'}>
                    {compactProfile(dashboard.activeAgentProfile)}
                  </Badge>
                )}
              </div>
              {dashboard && (
                <div className="truncate text-xs text-muted-foreground">
                  {dashboard.selectedSensorProfile}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs text-muted-foreground">
            {loading ? (
              <span>Refreshing</span>
            ) : (
              <>
                <span>{summary?.passed ?? 0} passed</span>
                <span>·</span>
                <span>{failed} failed</span>
                <span>·</span>
                <span>{openFindings} open</span>
              </>
            )}
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 text-sm">
            {error && (
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {error}
              </div>
            )}

            {codingDisabled && (
              <div className="flex items-start gap-2 rounded border border-border bg-muted/40 px-3 py-2">
                <CircleSlash className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 text-xs text-muted-foreground">
                  Coding sensors are disabled for this agent profile. Manual feedback imports remain
                  available when a repository or UI task needs them.
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {[
                ['Passed', summary?.passed ?? 0],
                ['Repaired', summary?.failedAndRepaired ?? 0],
                ['Unavailable', unavailable],
                ['Escalated', summary?.escalated ?? 0],
              ].map(([label, value]) => (
                <div key={label} className="rounded border border-border bg-muted/20 px-3 py-2">
                  <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
                  <div className="text-lg font-semibold">{value}</div>
                </div>
              ))}
            </div>

            {results.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Recent outcomes</div>
                <div className="flex flex-wrap gap-1.5">
                  {results.slice(0, 8).map((result) => (
                    <span
                      key={result.sensorId}
                      className={cn(
                        'inline-flex max-w-full items-center gap-1 rounded border px-2 py-1 text-xs',
                        statusTone(result.status),
                      )}
                      title={result.summary}
                    >
                      {result.status === 'passed' ? (
                        <CheckCircle2 className="h-3 w-3 shrink-0" />
                      ) : (
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                      )}
                      <span className="truncate">{resultLabel(result)}</span>
                      <span className="shrink-0 opacity-80">{result.status}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {dashboard && dashboard.providerAvailability.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-medium text-muted-foreground">Providers</div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={onRetry}
                    disabled={loading}
                  >
                    <RefreshCw className={cn('mr-1 h-3 w-3', loading && 'animate-spin')} />
                    Retry
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {dashboard.providerAvailability.map((provider) => (
                    <Badge
                      key={`${provider.provider}:${provider.capability}`}
                      variant={providerTone(provider.state)}
                      className="max-w-full gap-1 truncate"
                      title={provider.message}
                    >
                      <PlugZap className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {provider.provider}/{provider.capability}
                      </span>
                      <span className="shrink-0 opacity-80">{provider.state}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {dashboard && dashboard.findings.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Open findings</div>
                <ol className="space-y-1">
                  {dashboard.findings.slice(0, 5).map((finding) => (
                    <li
                      key={`${finding.sensorId}:${finding.dedupeKey ?? finding.message}`}
                      className="rounded border border-border bg-background px-2 py-1.5 text-xs"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Badge variant={severityTone(finding.severity)}>{finding.severity}</Badge>
                        <span className="truncate font-medium">{finding.message}</span>
                      </div>
                      {(finding.file || finding.ruleId) && (
                        <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                          {[finding.ruleId, finding.file, finding.line].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {dashboard && dashboard.runtimeLimitations.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">
                  Docker, sandbox, and runtime limits
                </div>
                {dashboard.runtimeLimitations.slice(0, 4).map((limitation) => (
                  <div
                    key={`${limitation.kind}:${limitation.message}`}
                    className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900"
                  >
                    <span className="font-medium">{limitation.kind.replaceAll('_', ' ')}</span>
                    <span className="ml-2">{limitation.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
