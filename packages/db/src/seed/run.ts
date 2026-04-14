import { closeDatabase, openDatabase } from '../database.js';
import { runE2eSeed } from './e2eSeed.js';
import { runSeed } from './runSeed.js';

const sqlitePath = process.env.SQLITE_PATH?.trim();
if (!sqlitePath) {
  console.error('SQLITE_PATH is required (e.g. /data/agent.sqlite)');
  process.exit(1);
}

const { db, sqlite } = openDatabase(sqlitePath);
try {
  runSeed(db);
  if (process.env.E2E_SEED === '1') {
    runE2eSeed(db);
  }
} finally {
  closeDatabase(sqlite);
}
