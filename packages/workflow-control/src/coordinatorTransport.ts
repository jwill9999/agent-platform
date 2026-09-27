import { executeCoordinatorProcess } from './coordinatorProcess.js';
import { z } from 'zod';
import { isAbsolute } from 'node:path';
import { assertBootstrapExecutablePin } from './bootstrapAdapterRuntime.js';
export const coordinatorTransportSchema = z
  .object({
    path: z.string().refine(isAbsolute),
    digest: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  })
  .strict();
/** Trusted operator service adapter, not a worker-selected command or inherited MCP connection. */
export class CoordinatorTransport {
  readonly #abort = new AbortController();
  abort(): void {
    this.#abort.abort();
  }
  constructor(readonly pin: z.infer<typeof coordinatorTransportSchema>) {
    coordinatorTransportSchema.parse(pin);
    assertBootstrapExecutablePin(pin);
  }
  async call<T>(method: string, arguments_: unknown, assertAuthority: () => void): Promise<T> {
    if (this.#abort.signal.aborted) throw new Error('coordinator_service_stopped');
    assertBootstrapExecutablePin(this.pin);
    assertAuthority();
    const result = await executeCoordinatorProcess({
      executable: this.pin.path,
      args: ['workflow-coordinator-v1', method],
      env: {},
      timeout: 30000,
      maxBuffer: 2 * 1024 * 1024,
      signal: this.#abort.signal,
      stdin: JSON.stringify(arguments_),
    });
    try {
      assertAuthority();
      return JSON.parse(result.stdout) as T;
    } catch {
      throw new Error('coordinator_service_reply_or_authority_invalid');
    }
  }
}
