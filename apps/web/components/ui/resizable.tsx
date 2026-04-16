'use client';

import * as React from 'react';
import { GripVerticalIcon } from 'lucide-react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import type { GroupProps, PanelProps, SeparatorProps } from 'react-resizable-panels';

import { cn } from '@/lib/cn';

function ResizablePanelGroup({ className, ...props }: Readonly<GroupProps>) {
  return <Group data-slot="resizable-panel-group" className={className} {...props} />;
}

function ResizablePanel({ ...props }: Readonly<PanelProps>) {
  return <Panel data-slot="resizable-panel" {...props} />;
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: Readonly<SeparatorProps & { withHandle?: boolean }>) {
  return (
    <Separator
      data-slot="resizable-handle"
      className={cn(
        'bg-border focus-visible:ring-ring relative flex items-center justify-center focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden',
        // Horizontal groups → vertical separator line
        'aria-[orientation=horizontal]:w-px aria-[orientation=horizontal]:after:absolute aria-[orientation=horizontal]:after:inset-y-0 aria-[orientation=horizontal]:after:left-1/2 aria-[orientation=horizontal]:after:w-1 aria-[orientation=horizontal]:after:-translate-x-1/2',
        // Vertical groups → horizontal separator line
        'aria-[orientation=vertical]:h-px aria-[orientation=vertical]:w-full aria-[orientation=vertical]:after:absolute aria-[orientation=vertical]:after:left-0 aria-[orientation=vertical]:after:h-1 aria-[orientation=vertical]:after:w-full aria-[orientation=vertical]:after:-translate-y-1/2',
        className,
      )}
      {...props}
    >
      {withHandle && (
        <div className="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-xs border">
          <GripVerticalIcon className="size-2.5" />
        </div>
      )}
    </Separator>
  );
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
