import { dockerFixtureBinary } from './docker-command.js';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

const boundary = '/home/appuser/.agent-platform-git-delivery-boundary';
/** External gh/SSH fixtures only; real API, SQLite, Git and bare remote remain in use. */
export function createDockerGitBoundary(apiURL: string, branch: string) {
  const container =
    process.env.GIT_DELIVERY_API_CONTAINER ??
    (process.env.CI
      ? execFileSync(dockerFixtureBinary(), ['compose', 'ps', '-q', 'api'], {
          encoding: 'utf8',
        }).trim()
      : '');
  if (!container) throw new Error('Select an isolated GIT_DELIVERY_API_CONTAINER');
  const inspect = (format: string) =>
    execFileSync(dockerFixtureBinary(), ['inspect', '--format', format, container], {
      encoding: 'utf8',
    }).trim();
  const url = new URL(apiURL);
  const ports = JSON.parse(inspect('{{json .NetworkSettings.Ports}}')) as Record<
    string,
    { HostPort: string }[]
  >;
  if (
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    !ports['3000/tcp']?.some(({ HostPort }) => HostPort === (url.port || '80')) ||
    inspect('{{index .Config.Labels "com.docker.compose.service"}}') !== 'api'
  ) {
    throw new Error('API URL does not match the selected owned Compose API container');
  }
  const exec = (args: string[]) =>
    execFileSync(dockerFixtureBinary(), ['exec', container, ...args], {
      encoding: 'utf8',
      timeout: 15_000,
    });
  const actual = exec([
    'node',
    '-e',
    'process.stdout.write(JSON.stringify([process.env.AGENT_PLATFORM_GH_BINARY,process.env.GIT_DELIVERY_GH_FIXTURE_DIR]))',
  ]);
  if (actual !== JSON.stringify([`${boundary}/gh`, `${boundary}/state`]))
    throw new Error('Start the owned test stack with e2e/support/git-delivery/compose.yml');
  const owner = randomUUID();
  // Project registration retains identity/history for a path after archival.
  // Each execution therefore needs its own path, not just new fixture contents.
  const directory = `${boundary}/project-${owner}`;
  const bare = `${boundary}/remote.git`;
  const write = (path: string, value: string, mode = 0o600) =>
    exec([
      'node',
      '-e',
      'const f=require("node:fs"),p=require("node:path");f.mkdirSync(p.dirname(process.argv[1]),{recursive:true});f.writeFileSync(process.argv[1],process.argv[2],{mode:Number(process.argv[3])});',
      path,
      value,
      String(mode),
    ]);
  // Exclusive directory acquisition avoids replacing a live or unexplained old fixture.
  exec([
    'node',
    '-e',
    `const f=require('node:fs');
for (const [path,uid] of [['/',0],['/home',0],['/home/appuser',process.getuid()]]) {
  const stat=f.lstatSync(path);
  if(!stat.isDirectory()||stat.isSymbolicLink()||stat.uid!==uid||(stat.mode&0o022)!==0)
    throw Error('Untrusted fixture parent');
}
if(process.getuid()!==10001)throw Error('Expected isolated appuser');
f.mkdirSync(process.argv[1],{mode:0o700});`,
    boundary,
  ]);
  write(`${boundary}/owner`, owner);
  const git = (...args: string[]) => exec(['/usr/bin/git', '-C', directory, ...args]).trim();
  const remote = (...args: string[]) => exec(['/usr/bin/git', '--git-dir', bare, ...args]).trim();
  const close = () =>
    exec([
      'node',
      '-e',
      'const f=require("node:fs");if(f.readFileSync(process.argv[1]+"/owner","utf8")!==process.argv[2])throw Error("Ownership changed");if(f.existsSync(process.argv[1]+"/state/active.lock"))throw Error("Fixture child active");f.rmSync(process.argv[1],{recursive:true});',
      boundary,
      owner,
    ]);
  try {
    write(
      `${boundary}/gh`,
      readFileSync(new URL('./gh-executable.mjs', import.meta.url), 'utf8'),
      0o700,
    );
    write(
      `${boundary}/ssh`,
      readFileSync(new URL('./git-ssh-executable.mjs', import.meta.url), 'utf8'),
      0o700,
    );
    write(
      `${boundary}/state/config.json`,
      JSON.stringify({ version: 1, repository: 'fixture/project', currentBranch: branch }),
    );
    write(
      `${boundary}/state/ledger.json`,
      JSON.stringify({ pullRequests: [], calls: [], lostResponseConsumed: false }),
    );
    write(
      `${boundary}/transport.json`,
      JSON.stringify({ version: 1, repository: 'fixture/project', bareRoot: bare }),
    );
    write(`${boundary}/transport.jsonl`, '');
    exec(['/usr/bin/git', 'init', '--bare', bare]);
    exec(['/usr/bin/git', 'init', '-b', 'staging', directory]);
    git('config', 'user.name', 'Git delivery browser fixture');
    git('config', 'user.email', 'delivery@example.invalid');
    git('config', 'core.sshCommand', `${boundary}/ssh`);
    git('config', 'ssh.variant', 'ssh');
    git('remote', 'add', 'origin', 'git@github.com:fixture/project.git');
    write(`${directory}/README.md`, '# Remote delivery fixture\n');
    git('add', '--', 'README.md');
    git('commit', '-m', 'fixture base');
    // Fixture setup only: seed the real remote base before the app's reviewed feature push.
    git('push', 'origin', 'HEAD:refs/heads/staging');
    git('switch', '-c', branch);
    return {
      directory,
      bare,
      git,
      remote,
      write: (path: string, value: string) => write(`${directory}/${path}`, value),
      ledger: () => JSON.parse(exec(['cat', `${boundary}/state/ledger.json`])),
      loseNextCreateResponse: () =>
        write(
          `${boundary}/state/config.json`,
          JSON.stringify({
            version: 1,
            repository: 'fixture/project',
            currentBranch: branch,
            loseCreateResponseOnce: true,
          }),
        ),
      close,
    };
  } catch (error) {
    try {
      close();
    } catch (cleanup) {
      throw new AggregateError([error, cleanup], 'Git fixture setup and cleanup failed');
    }
    throw error;
  }
}
