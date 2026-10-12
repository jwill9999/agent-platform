import type { RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { runWithCorrelation } from '@agent-platform/logger';

const HEADER = 'x-correlation-id';
const SAFE_CORRELATION = /^[a-zA-Z0-9._:-]{1,128}$/;

/**
 * Express middleware that establishes a request-scoped correlation ID.
 * Always generates a trusted request UUID before parsing. Bounded caller correlation is metadata.
 * Echoes the ID back on the response and propagates it via AsyncLocalStorage
 * so all downstream logger calls automatically include it.
 */
export const correlationMiddleware: RequestHandler = (req, res, next) => {
  const requestId = randomUUID();
  const supplied = req.header(HEADER);
  const callerCorrelation = supplied && SAFE_CORRELATION.test(supplied) ? supplied : undefined;
  res.locals.requestId = requestId;
  res.locals.callerCorrelation = callerCorrelation;
  res.setHeader('x-request-id', requestId);
  // Compatibility echo is metadata, never the diagnostic lookup key or log identity.
  res.setHeader(HEADER, callerCorrelation ?? requestId);
  runWithCorrelation(requestId, next);
};
