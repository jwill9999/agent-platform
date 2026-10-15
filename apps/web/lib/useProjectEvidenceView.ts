'use client';

import { useState } from 'react';

export type ProjectEvidenceView = 'activity' | 'git';

export function useProjectEvidenceView(projectId: string | null) {
  const [selection, setSelection] = useState({
    projectId,
    generation: 0,
    view: 'activity' as ProjectEvidenceView,
  });
  let current = selection;
  if (current.projectId !== projectId) {
    current = { projectId, generation: current.generation + 1, view: 'activity' };
    setSelection(current);
  }
  const generation = current.generation;

  return {
    view: current.view,
    setView: (view: ProjectEvidenceView) => {
      setSelection((latest) =>
        projectId !== null && latest.projectId === projectId && latest.generation === generation
          ? { ...latest, view }
          : latest,
      );
    },
  };
}
