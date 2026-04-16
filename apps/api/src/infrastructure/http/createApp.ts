import express, { type Application } from 'express';
import type { DrizzleDb } from '@agent-platform/db';

import { getHealth } from '../../application/health/getHealth.js';
import { correlationMiddleware } from './correlationMiddleware.js';
import { errorMiddleware } from './errorMiddleware.js';
import { mountOpenApiValidation, openApiValidationErrorHandler } from './openApiValidation.js';
import { mountSwaggerUI } from './swagger.js';
import { createV1Router } from './v1/v1Router.js';

export function createApp(options: { db: DrizzleDb | null }): Application {
  const app = express();

  app.use(correlationMiddleware);
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.status(200).json(getHealth());
  });

  mountSwaggerUI(app);
  mountOpenApiValidation(app);

  if (options.db) {
    app.use('/v1', createV1Router(options.db));
  }

  app.use(openApiValidationErrorHandler);
  app.use(errorMiddleware);

  return app;
}
