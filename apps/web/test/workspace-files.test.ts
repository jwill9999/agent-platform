import { describe, expect, it } from 'vitest';
import type { WorkspaceFilesResponse } from '@agent-platform/contracts';

import { flattenWorkspaceFiles, formatFileSize } from '../lib/workspace-files';

describe('workspace file helpers', () => {
  it('flattens files in workspace area order with useful labels', () => {
    const data: WorkspaceFilesResponse = {
      totalFiles: 3,
      areas: [
        {
          area: 'generated',
          label: 'Generated',
          path: 'generated',
          files: [
            {
              name: 'summary.txt',
              path: 'generated/summary.txt',
              area: 'generated',
              kind: 'file',
              size: 42,
              modifiedAt: '2026-04-29T12:00:00.000Z',
            },
          ],
        },
        {
          area: 'uploads',
          label: 'Uploads',
          path: 'uploads',
          files: [
            {
              name: 'input.csv',
              path: 'uploads/input.csv',
              area: 'uploads',
              kind: 'file',
              size: 5,
              modifiedAt: '2026-04-29T12:00:00.000Z',
            },
          ],
        },
        { area: 'scratch', label: 'Scratch', path: 'scratch', files: [] },
        { area: 'exports', label: 'Exports', path: 'exports', files: [] },
      ],
    };

    expect(flattenWorkspaceFiles(data).map((file) => `${file.areaLabel}:${file.path}`)).toEqual([
      'Uploads:uploads/input.csv',
      'Generated:generated/summary.txt',
    ]);
  });

  it('formats file sizes for table display', () => {
    expect(formatFileSize(9)).toBe('9 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});
