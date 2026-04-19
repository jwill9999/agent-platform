import express, { type Application } from 'express';
import type { DrizzleDb } from '@agent-platform/db';

import { correlationMiddleware } from './correlationMiddleware.js';
import { errorMiddleware } from './errorMiddleware.js';
import { createHealthRouter } from './healthRouter.js';
import { mountOpenApiValidation, openApiValidationErrorHandler } from './openApiValidation.js';
import { mountSwaggerUI } from './swagger.js';
import { createV1Router } from './v1/v1Router.js';

export function createApp(options: { db: DrizzleDb | null }): Application {
  const app = express();

  // Trust first proxy hop (Next.js BFF / Docker network) so express-rate-limit
  // can read X-Forwarded-For without ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
  app.set('trust proxy', 1);

  app.use(correlationMiddleware);
  app.use(express.json({ limit: '1mb' }));

  app.use(createHealthRouter({ db: options.db, sqlitePath: process.env['SQLITE_PATH'] }));

  mountSwaggerUI(app);
  mountOpenApiValidation(app);

  if (options.db) {
    app.use('/v1', createV1Router(options.db));
  }

  app.use(openApiValidationErrorHandler);
  app.use(errorMiddleware);

  return app;
}
