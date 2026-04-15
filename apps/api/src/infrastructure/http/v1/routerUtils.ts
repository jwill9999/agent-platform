import { z } from 'zod';

import { HttpError } from '../httpError.js';

export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid request body', r.error.flatten());
  }
  return r.data;
}

export function isSqliteConstraint(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  if (!('code' in e)) return false;
  const code = String((e as { code: unknown }).code);
  return code.includes('SQLITE_CONSTRAINT');
}
