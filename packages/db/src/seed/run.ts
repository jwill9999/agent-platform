import { closeDatabase, openDatabase } from '../database.js';
import { runSeed } from './runSeed.js';

const sqlitePath = process.env.SQLITE_PATH?.trim();
if (!sqlitePath) {
  console.error('SQLITE_PATH is required (e.g. /data/agent.sqlite)');
  process.exit(1);
}

const { db, sqlite } = openDatabase(sqlitePath);
try {
  runSeed(db);
} finally {
  closeDatabase(sqlite);
}
