import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Application, Request, Response, NextFunction } from 'express';
import * as OpenApiValidator from 'express-openapi-validator';
import { parse } from 'yaml';

import { HttpError } from './httpError.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Load the OpenAPI spec as a plain object for the validator. */
function loadApiSpec(): string {
  return resolve(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    '..',
    'contracts',
    'openapi',
    'agent-platform.yaml',
  );
}

/**
 * Mount OpenAPI request/response validation middleware.
 *
 * - Requests are always validated (fail-fast on schema mismatch).
 * - Response validation is enabled only outside production.
 * - Paths like /health and /api-docs are excluded.
 *
 * Validation errors are caught by the error handler and converted
 * to the standard `{ error: { code, message, details? } }` shape.
 */
export function mountOpenApiValidation(app: Application): void {
  const specPath = loadApiSpec();

  // Parse YAML to JSON object for the validator
  const spec = parse(readFileSync(specPath, 'utf-8'));

  const validateResponses = process.env.NODE_ENV !== 'production';

  app.use(
    OpenApiValidator.middleware({
      apiSpec: spec,
      validateRequests: true,
      validateResponses,
      ignorePaths: /^\/(health|api-docs)/,
      ignoreUndocumented: true,
    }),
  );
}

/**
 * Error handler that converts express-openapi-validator errors
 * to the standard API error shape.
 */
export function openApiValidationErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (isOpenApiError(err)) {
    const status = err.status ?? 400;
    res.status(status).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message,
        details: err.errors ?? undefined,
      },
    });
    return;
  }
  next(err);
}

type OpenApiError = {
  status?: number;
  message: string;
  errors?: unknown[];
};

function isOpenApiError(err: unknown): err is OpenApiError {
  if (err instanceof HttpError) return false;
  return (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    'message' in err &&
    'errors' in err
  );
}
