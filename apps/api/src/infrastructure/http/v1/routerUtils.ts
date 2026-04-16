import { z } from 'zod';

import { HttpError } from '../httpError.js';

export function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown): z.output<T> {
  const r = schema.safeParse(body);
  if (!r.success) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid request body', r.error.flatten());
  }
  return r.data as z.output<T>;
}

/** Extract a required route param with runtime validation. */
export function requireParam(params: Record<string, string | undefined>, name: string): string {
  const value = params[name];
  if (value === undefined) {
    throw new HttpError(400, 'VALIDATION_ERROR', `Missing required param: ${name}`);
  }
  return value;
}
