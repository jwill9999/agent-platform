import type {
  WorkspaceArea,
  WorkspaceFile,
  WorkspaceFilesResponse,
} from '@agent-platform/contracts';

export type WorkspaceFileRow = WorkspaceFile & {
  areaLabel: string;
};

const AREA_ORDER: readonly WorkspaceArea[] = ['uploads', 'generated', 'scratch', 'exports'];

export function flattenWorkspaceFiles(
  data: WorkspaceFilesResponse | undefined,
): WorkspaceFileRow[] {
  if (!data) return [];

  const rows = data.areas.flatMap((area) =>
    area.files.map((file) => ({
      ...file,
      areaLabel: area.label,
    })),
  );

  return rows.sort((a, b) => {
    const areaDelta = AREA_ORDER.indexOf(a.area) - AREA_ORDER.indexOf(b.area);
    if (areaDelta !== 0) return areaDelta;
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
    return a.path.localeCompare(b.path);
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${kib.toFixed(kib >= 10 ? 0 : 1)} KB`;
  const mib = kib / 1024;
  return `${mib.toFixed(mib >= 10 ? 0 : 1)} MB`;
}

export function formatWorkspaceTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
