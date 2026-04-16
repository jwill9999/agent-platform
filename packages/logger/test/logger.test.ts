import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, runWithCorrelation } from '../src/index.js';
import type { LogLevel } from '../src/index.js';

describe('createLogger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it.each<LogLevel>(['info', 'warn', 'error'])('emits structured JSON for %s level', (level) => {
    const log = createLogger('test-svc');
    log[level]('hello');

    expect(consoleSpy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(consoleSpy.mock.calls[0]![0] as string);
    expect(parsed).toMatchObject({ level, service: 'test-svc', msg: 'hello' });
    expect(parsed.ts).toBeDefined();
  });

  it('includes extra fields in output', () => {
    const log = createLogger('svc');
    log.warn('oops', { serverId: 'mcp-1', transport: 'stdio' });

    const parsed = JSON.parse(consoleSpy.mock.calls[0]![0] as string);
    expect(parsed).toMatchObject({
      level: 'warn',
      service: 'svc',
      msg: 'oops',
      serverId: 'mcp-1',
      transport: 'stdio',
    });
  });

  it('includes correlationId when running inside correlation context', () => {
    const log = createLogger('svc');
    runWithCorrelation('req-123', () => {
      log.info('inside context');
    });

    const parsed = JSON.parse(consoleSpy.mock.calls[0]![0] as string);
    expect(parsed).toMatchObject({
      level: 'info',
      service: 'svc',
      msg: 'inside context',
      correlationId: 'req-123',
    });
  });

  it('omits correlationId when no context is active', () => {
    const log = createLogger('svc');
    log.info('no context');

    const parsed = JSON.parse(consoleSpy.mock.calls[0]![0] as string);
    expect(parsed.correlationId).toBeUndefined();
  });
});
