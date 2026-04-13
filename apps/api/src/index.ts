import { closeDatabase, openDatabase } from '@agent-platform/db';

import { createApp } from './infrastructure/http/createApp.js';
import { createLogger } from './infrastructure/logging/logger.js';

const log = createLogger('api');

const sqlitePath = process.env.SQLITE_PATH;
if (sqlitePath) {
  const { sqlite } = openDatabase(sqlitePath);
  closeDatabase(sqlite);
  log.info('db.migrations_applied', { sqlitePath });
}

const app = createApp();
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

app.listen(port, host, () => {
  log.info('api.listen', { host, port });
});
