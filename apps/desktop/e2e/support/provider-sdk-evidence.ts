import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contextTokenRepoRoot, type ContextTokenFixture } from './contextTokenFixture.js';

/** Return booleans/counts only; the private payload and encryption envelope never leave SQLite. */
export function providerSdkStorageProof(fixture: ContextTokenFixture, sessionId: string) {
  const script = `
import Database from './packages/db/node_modules/better-sqlite3/lib/index.js';
import {readFileSync,existsSync} from 'node:fs';
const [path,id]=process.argv.slice(1);
const db=new Database(path,{readonly:true,fileMustExist:true});
try {
 const required=db.prepare('SELECT count(*) AS count FROM messages WHERE session_id=? AND provider_continuation_format=1').get(id).count;
 const rows=db.prepare('SELECT count(*) AS count FROM provider_continuations WHERE session_id=?').get(id).count;
 const invalid=db.prepare("SELECT count(*) AS count FROM provider_continuations WHERE session_id=? AND (algorithm!='aes-256-gcm-v1' OR length(ciphertext_b64)=0 OR plaintext_bytes<=0)").get(id).count;
 const marker=Buffer.from('PRIVATE_SDK_REASONING_CANARY');
 const plaintextPresent=[path,path+'-wal'].some(file=>existsSync(file)&&readFileSync(file).includes(marker));
 console.log(JSON.stringify({required,rows,invalid,plaintextPresent}));
} finally {db.close();}
`;
  return JSON.parse(
    execFileSync(
      process.execPath,
      ['--input-type=module', '-e', script, fixture.sqlitePath, sessionId],
      { cwd: contextTokenRepoRoot, encoding: 'utf8', timeout: 10_000 },
    ),
  ) as { required: number; rows: number; invalid: number; plaintextPresent: boolean };
}

export function providerSdkSourceHashes() {
  return Object.fromEntries(
    [
      'apps/desktop/e2e/provider-sdk.e2e.ts',
      'apps/desktop/e2e/support/provider-sdk-evidence.ts',
      'e2e/support/provider-sdk.mjs',
      'e2e/support/provider-sdk-ui.ts',
      'packages/model-router/src/providers.ts',
      'packages/model-router/src/testConnection.ts',
      'packages/harness/src/nodes/llmReason.ts',
      'packages/harness/src/providerContinuation.ts',
      'packages/db/src/repositories/providerContinuation.ts',
      'apps/api/src/infrastructure/http/v1/chatRouter.ts',
      'packages/model-router/dist/providers.js',
      'packages/harness/dist/nodes/llmReason.js',
      'packages/db/dist/repositories/providerContinuation.js',
      'apps/api/dist/infrastructure/http/v1/chatRouter.js',
    ].map((path) => [
      path,
      createHash('sha256')
        .update(readFileSync(join(contextTokenRepoRoot, path)))
        .digest('hex'),
    ]),
  );
}
