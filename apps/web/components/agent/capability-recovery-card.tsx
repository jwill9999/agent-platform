'use client';

import { CheckCircle2, Hand, Plug, ShieldAlert, SquareTerminal, X } from 'lucide-react';
import type { CapabilityRecovery, CapabilityRecoveryOption } from '@agent-platform/contracts';

import { cn } from '@/lib/cn';

function optionIcon(action: CapabilityRecoveryOption['action']) {
  if (action === 'approve') return <Hand className="h-3.5 w-3.5" />;
  if (action === 'connect') return <Plug className="h-3.5 w-3.5" />;
  if (action === 'sandbox') return <ShieldAlert className="h-3.5 w-3.5" />;
  if (action === 'manual') return <SquareTerminal className="h-3.5 w-3.5" />;
  return <X className="h-3.5 w-3.5" />;
}

function statusLabel(status: CapabilityRecovery['status']): string {
  if (status === 'capability_missing') return 'Capability missing';
  if (status === 'provider_required') return 'Provider required';
  if (status === 'approval_escalation') return 'Approval escalation';
  return 'Sandbox available';
}

type Props = Readonly<{
  recovery: CapabilityRecovery;
  className?: string;
}>;

export function CapabilityRecoveryCard({ recovery, className }: Props) {
  return (
    <div className={cn('mt-2 rounded border border-amber-200 bg-amber-50/60 p-2', className)}>
      <div className="flex min-w-0 items-center gap-2 text-[11px] font-medium text-amber-900">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        <span>{statusLabel(recovery.status)}</span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-amber-900/90">{recovery.summary}</p>
      {recovery.options.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {recovery.options.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled
              className="inline-flex h-7 items-center gap-1.5 rounded border border-amber-300 bg-background px-2 text-[11px] font-medium text-amber-900 disabled:opacity-80"
              title={option.label}
            >
              {optionIcon(option.action)}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
