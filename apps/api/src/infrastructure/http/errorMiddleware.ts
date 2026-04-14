import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

import { HttpError } from './httpError.js';

export const errorMiddleware: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.flatten(),
      },
    });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = String((err as { code: unknown }).code);
    if (code.includes('SQLITE_CONSTRAINT')) {
      res.status(400).json({
        error: {
          code: 'CONSTRAINT_VIOLATION',
          message: 'Database constraint failed',
        },
      });
      return;
    }
  }
  const message = err instanceof Error ? err.message : 'Internal error';
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message,
    },
  });
};
