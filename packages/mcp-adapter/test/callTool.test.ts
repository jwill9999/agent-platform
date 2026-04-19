import { describe, expect, it } from 'vitest';
import {
  callToolResultToOutput,
  callToolResultToOutputs,
  summarizeToolContent,
  extractImageOutputs,
} from '../src/callTool.js';

describe('callToolResultToOutput', () => {
  it('maps success to tool_result', () => {
    const o = callToolResultToOutput('srv', 'add', {
      structuredContent: { sum: 3 },
    });
    expect(o).toEqual({ type: 'tool_result', toolId: 'srv:add', data: { sum: 3 } });
  });

  it('maps isError to error output', () => {
    const o = callToolResultToOutput('srv', 'bad', {
      isError: true,
      content: [{ type: 'text', text: 'nope' }],
    });
    expect(o).toEqual({ type: 'error', code: 'MCP_TOOL_ERROR', message: 'nope' });
  });
});

describe('summarizeToolContent', () => {
  it('joins text blocks', () => {
    const result = summarizeToolContent([
      { type: 'text', text: 'hello' },
      { type: 'text', text: 'world' },
    ]);
    expect(result).toBe('hello\nworld');
  });

  it('produces placeholder for image blocks and filters file paths', () => {
    const base64 = 'A'.repeat(4000); // ~3KB
    const result = summarizeToolContent([
      { type: 'image', data: base64, mimeType: 'image/png' },
      { type: 'text', text: 'Screenshot taken' },
    ]);
    expect(result).toContain('[Screenshot captured and displayed inline to the user: image/png');
    expect(result).toContain('Screenshot taken');
    // Must NOT contain the raw base64
    expect(result).not.toContain(base64);
  });

  it('filters local file paths when images are present', () => {
    const result = summarizeToolContent([
      { type: 'image', data: 'abc', mimeType: 'image/png' },
      { type: 'text', text: '/.playwright-mcp/page-2026-04-18T23-57-05-696Z.yml' },
    ]);
    expect(result).not.toContain('.playwright-mcp');
  });

  it('filters .playwright-mcp paths even without images', () => {
    const result = summarizeToolContent([
      { type: 'text', text: 'Page navigated successfully' },
      { type: 'text', text: '/.playwright-mcp/page-2026-04-18T23-57-05-696Z.yml' },
    ]);
    expect(result).toBe('Page navigated successfully');
    expect(result).not.toContain('.playwright-mcp');
  });

  it('returns raw content when no recognized blocks', () => {
    const raw = [{ type: 'unknown', foo: 'bar' }];
    expect(summarizeToolContent(raw)).toBe(raw);
  });
});

describe('extractImageOutputs', () => {
  it('extracts image blocks as Output events', () => {
    const images = extractImageOutputs('srv:snap', [
      { type: 'text', text: 'done' },
      { type: 'image', data: 'base64data', mimeType: 'image/png' },
    ]);
    expect(images).toHaveLength(1);
    expect(images[0]).toEqual({
      type: 'image',
      toolId: 'srv:snap',
      mimeType: 'image/png',
      data: 'base64data',
    });
  });

  it('returns empty for non-array content', () => {
    expect(extractImageOutputs('srv:snap', 'just text')).toEqual([]);
  });

  it('defaults mimeType to image/png', () => {
    const images = extractImageOutputs('srv:snap', [{ type: 'image', data: 'abc' }]);
    expect(images[0]!.type === 'image' && images[0]!.mimeType).toBe('image/png');
  });
});

describe('callToolResultToOutputs', () => {
  it('returns images alongside tool_result', () => {
    const { output, images } = callToolResultToOutputs('srv', 'screenshot', {
      content: [
        { type: 'image', data: 'imgdata', mimeType: 'image/jpeg' },
        { type: 'text', text: 'Screenshot saved' },
      ],
    });
    expect(output.type).toBe('tool_result');
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({ type: 'image', data: 'imgdata' });
  });

  it('returns empty images for text-only result', () => {
    const { output, images } = callToolResultToOutputs('srv', 'ls', {
      content: [{ type: 'text', text: 'file.txt' }],
    });
    expect(output).toEqual({ type: 'tool_result', toolId: 'srv:ls', data: 'file.txt' });
    expect(images).toEqual([]);
  });

  it('returns empty images for error result', () => {
    const { output, images } = callToolResultToOutputs('srv', 'bad', {
      isError: true,
      content: [{ type: 'text', text: 'failed' }],
    });
    expect(output.type).toBe('error');
    expect(images).toEqual([]);
  });
});
