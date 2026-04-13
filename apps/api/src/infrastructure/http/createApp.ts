import express, { type Application } from 'express';

import { getHealth } from '../../application/health/getHealth.js';

export function createApp(): Application {
  const app = express();

  app.get('/health', (_req, res) => {
    res.status(200).json(getHealth());
  });

  return app;
}
