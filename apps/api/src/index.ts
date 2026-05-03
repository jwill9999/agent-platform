import { createServer } from 'node:http';

import { closeDatabase, openDatabase } from '@agent-platform/db';

import { createApp } from './infrastructure/http/createApp.js';
import { attachTerminalWs } from './infrastructure/terminal/attachTerminalWs.js';
import { createLogger } from '@agent-platform/logger';
import { createSchedulerService } from './application/scheduler/schedulerService.js';

const log = createLogger('api');

const sqlitePath = process.env.SQLITE_PATH?.trim();
let dbHandle: ReturnType<typeof openDatabase> | null = null;

if (sqlitePath) {
  dbHandle = openDatabase(sqlitePath);
  log.info('db.ready', { sqlitePath });
}

const app = createApp({ db: dbHandle?.db ?? null });
const server = createServer(app);
attachTerminalWs(server);
const scheduler =
  dbHandle && process.env.SCHEDULER_ENABLED !== 'false'
    ? createSchedulerService(dbHandle.db)
    : null;

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

server.listen(port, host, () => {
  log.info('api.listen', { host, port });
  scheduler?.start();
});

function shutdown() {
  scheduler?.stop();
  server.close(() => {
    if (dbHandle) {
      closeDatabase(dbHandle.sqlite);
      log.info('db.closed');
    }
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
