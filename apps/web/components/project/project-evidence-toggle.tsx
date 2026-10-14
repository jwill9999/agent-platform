'use client';

import { useId } from 'react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function ProjectEvidenceToggle({
  visible,
  onVisibleChange,
  unavailableReason,
}: Readonly<{
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  unavailableReason: string | null;
}>) {
  const descriptionId = useId();
  const label = unavailableReason
    ? 'Activity and Git panel unavailable'
    : visible
      ? 'Hide activity and Git panel'
      : 'Show activity and Git panel';
  const Icon = visible ? PanelRightClose : PanelRightOpen;

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={visible ? 'secondary' : 'outline'}
        aria-label={label}
        aria-expanded={visible}
        aria-controls={visible ? 'project-evidence-rail' : undefined}
        aria-describedby={unavailableReason ? descriptionId : undefined}
        aria-disabled={unavailableReason !== null}
        title={unavailableReason ?? label}
        onClick={() => {
          if (!unavailableReason) onVisibleChange(!visible);
        }}
      >
        <Icon className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">
          {unavailableReason ? 'Panel unavailable' : visible ? 'Hide panel' : 'Show panel'}
        </span>
      </Button>
      {unavailableReason && (
        <span id={descriptionId} className="sr-only">
          {unavailableReason}
        </span>
      )}
    </>
  );
}
