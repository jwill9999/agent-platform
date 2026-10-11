import express, { type Application } from 'express';
import type { DiagnosticStore } from '@agent-platform/contracts';
import { diagnosticIngress } from '../diagnostics/observations.js';
import type { DiagnosticAccess } from '../diagnostics/localAccess.js';
import { createDiagnosticsRouter } from './v1/diagnosticsRouter.js';
import type { DrizzleDb } from '@agent-platform/db';

import { correlationMiddleware } from './correlationMiddleware.js';
import { errorMiddleware } from './errorMiddleware.js';
import { createHealthRouter } from './healthRouter.js';
import { mountOpenApiValidation, openApiValidationErrorHandler } from './openApiValidation.js';
import { mountSwaggerUI } from './swagger.js';
import { createV1Router, type V1RouterOptions } from './v1/v1Router.js';

export function createApp(options: {
  db: DrizzleDb | null;
  v1?: V1RouterOptions;
  diagnostics?: { store: DiagnosticStore; access: DiagnosticAccess; appVersion?: string };
}): Application {
  const app = express();

  // Trust first proxy hop (Next.js BFF / Docker network) so express-rate-limit
  // can read X-Forwarded-For without ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
  app.set('trust proxy', 1);

  app.use(correlationMiddleware);
  if (options.diagnostics)
    app.use(diagnosticIngress(options.diagnostics.store, options.diagnostics.access));
  app.use(express.json({ limit: '1mb' }));

  app.use(createHealthRouter({ db: options.db, sqlitePath: process.env['SQLITE_PATH'] }));

  if (options.db && options.diagnostics) {
    app.use(
      '/v1/diagnostics',
      createDiagnosticsRouter(
        options.db,
        options.diagnostics.store,
        options.diagnostics.access,
        options.diagnostics.appVersion,
      ),
    );
  }

  mountSwaggerUI(app);
  mountOpenApiValidation(app);

  if (options.db) {
    app.use('/v1', createV1Router(options.db, options.v1));
  }

  app.use(openApiValidationErrorHandler);
  app.use(errorMiddleware);

  return app;
}
