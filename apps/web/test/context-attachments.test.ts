import { describe, expect, it } from 'vitest';

import {
  classifyAttachmentFile,
  formatImageAttachmentContext,
  unsupportedAttachmentWarnings,
  type AttachmentEntry,
} from '../hooks/use-context-attachments';

describe('context attachments', () => {
  it('classifies common image formats as image attachments', () => {
    expect(classifyAttachmentFile({ name: 'screenshot.png', type: 'image/png', size: 24 })).toBe(
      'image',
    );
    expect(classifyAttachmentFile({ name: 'profile.JPG', type: '', size: 24 })).toBe('image');
    expect(classifyAttachmentFile({ name: 'preview.webp', type: 'image/webp', size: 24 })).toBe(
      'image',
    );
  });

  it('keeps common text documents in the text attachment path', () => {
    expect(classifyAttachmentFile({ name: 'README.md', type: 'text/markdown', size: 24 })).toBe(
      'text',
    );
    expect(classifyAttachmentFile({ name: 'data.json', type: 'application/json', size: 24 })).toBe(
      'text',
    );
  });

  it('does not convert image attachments into text-file warnings', () => {
    const context = formatImageAttachmentContext([
      {
        name: 'Screenshot 2026-05-14.png',
        kind: 'image',
        mimeType: 'image/png',
        sizeBytes: 2048,
      },
    ]);

    expect(context).toContain('<attachment_context>');
    expect(context).toContain('Screenshot 2026-05-14.png');
    expect(context).toContain('image/png, 2 KB');
    expect(context).not.toContain('not an allowed text format');
  });

  it('reports unsupported binary attachments without exposing host paths', () => {
    const warnings = unsupportedAttachmentWarnings([
      {
        name: 'archive.zip',
        kind: 'unsupported',
        mimeType: 'application/zip',
        sizeBytes: 1024,
      },
    ] satisfies AttachmentEntry[]);

    expect(warnings).toEqual([
      '"archive.zip" is attached but cannot be sent as chat context in this version.',
    ]);
    expect(warnings.join('\n')).not.toContain('/Users/');
  });
});
