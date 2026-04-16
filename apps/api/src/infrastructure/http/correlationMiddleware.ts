import type { RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { runWithCorrelation } from '@agent-platform/logger';

const HEADER = 'x-correlation-id';

/**
 * Express middleware that establishes a request-scoped correlation ID.
 * Reads from the incoming `x-correlation-id` header or generates a new UUID.
 * Echoes the ID back on the response and propagates it via AsyncLocalStorage
 * so all downstream logger calls automatically include it.
 */
export const correlationMiddleware: RequestHandler = (req, res, next) => {
  const correlationId = req.header(HEADER) || randomUUID();
  res.setHeader(HEADER, correlationId);
  runWithCorrelation(correlationId, next);
};
