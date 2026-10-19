import { constants } from 'node:fs';
import { lstat, mkdir, open, rename, unlink, type FileHandle } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  CaptureFailureSchema,
  CaptureStoreKindSchema,
  type CaptureFailure,
  type CaptureFailureArtifacts,
  type CaptureFailureRetention,
  type CaptureStoreKind,
} from '@agent-platform/contracts';

const maximumBytes = 2048;
const kinds = ['diagnostics', 'monitoring'] as const;
type Identity = { dev: number; ino: number };
type OwnedFile = Identity & { path: string; handle: FileHandle; closed: boolean; token?: string };
type Previous = {
  state: CaptureFailureRetention['previousFailureState'];
  failure?: CaptureFailure;
  identity?: Identity;
};
type PrivateStat = Identity & {
  mode: number;
  uid: number;
  size: number;
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
};
const initialStatus = (): CaptureFailureRetention => ({
  previousFailureState: 'loading',
  publication: 'idle',
});
const sameIdentity = (left: Identity, right: Identity) =>
  left.dev === right.dev && left.ino === right.ino;
function privatelyOwned(stat: PrivateStat): boolean {
  return (
    (process.platform === 'win32' || (stat.mode & 0o077) === 0) &&
    (typeof process.getuid !== 'function' || stat.uid === process.getuid())
  );
}
function missing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
function unavailable(): Error {
  return new Error('capture_failure_artifact_unavailable');
}

async function privateDirectory(root: string): Promise<{ path: string; identity: Identity }> {
  const parent = await lstat(root);
  if (
    !parent.isDirectory() ||
    parent.isSymbolicLink() ||
    (typeof process.getuid === 'function' && parent.uid !== process.getuid())
  )
    throw unavailable();
  const path = join(root, '.capture-failures');
  try {
    await mkdir(path, { mode: 0o700 });
  } catch (error) {
    if (
      !(typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST')
    )
      throw error;
  }
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink() || !privatelyOwned(stat)) throw unavailable();
  return { path, identity: stat };
}
async function requireDirectory(path: string, identity: Identity): Promise<void> {
  const stat = await lstat(path);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    !privatelyOwned(stat) ||
    !sameIdentity(stat, identity)
  )
    throw unavailable();
}
async function readPrevious(path: string, kind: CaptureStoreKind): Promise<Previous> {
  let handle: FileHandle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  } catch (error) {
    return { state: missing(error) ? 'missing' : 'unavailable' };
  }
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || !privatelyOwned(stat)) return { state: 'unavailable' };
    const identity = { dev: stat.dev, ino: stat.ino };
    if (stat.size > maximumBytes) return { state: 'invalid', identity };
    const buffer = Buffer.alloc(maximumBytes + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > maximumBytes) return { state: 'invalid', identity };
    try {
      const parsed = CaptureFailureSchema.safeParse(
        JSON.parse(buffer.subarray(0, bytesRead).toString('utf8')),
      );
      if (!parsed.success || parsed.data.store !== kind) return { state: 'invalid', identity };
      return { state: 'available', failure: parsed.data, identity };
    } catch {
      return { state: 'invalid', identity };
    }
  } finally {
    await handle.close();
  }
}
async function createOwned(path: string): Promise<OwnedFile> {
  const handle = await open(
    path,
    constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    0o600,
  );
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || !privatelyOwned(stat)) throw unavailable();
    return { handle, path, dev: stat.dev, ino: stat.ino, closed: false };
  } catch (error) {
    await handle.close();
    throw error;
  }
}
async function closeOwned(file: OwnedFile): Promise<void> {
  if (file.closed) return;
  await file.handle.close();
  file.closed = true;
}
async function claimTokenMatches(file: OwnedFile): Promise<boolean> {
  if (file.token === undefined) return true;
  const handle = await open(
    file.path,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || !sameIdentity(stat, file) || stat.size !== Buffer.byteLength(file.token))
      return false;
    const buffer = Buffer.alloc(64);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead).toString('utf8') === file.token;
  } finally {
    await handle.close();
  }
}
async function removeOwned(file: OwnedFile | undefined): Promise<void> {
  if (!file) return;
  await closeOwned(file);
  const stat = await lstat(file.path);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    !sameIdentity(stat, file) ||
    !(await claimTokenMatches(file))
  )
    throw unavailable();
  await unlink(file.path);
}
async function targetUnchanged(path: string, previous: Previous): Promise<void> {
  try {
    const stat = await lstat(path);
    if (
      !previous.identity ||
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      !privatelyOwned(stat) ||
      !sameIdentity(stat, previous.identity)
    )
      throw unavailable();
  } catch (error) {
    if (missing(error) && !previous.identity) return;
    throw error;
  }
}
async function publish(
  directory: { path: string; identity: Identity },
  failure: CaptureFailure,
): Promise<void> {
  let claim: OwnedFile | undefined;
  let temporary: OwnedFile | undefined;
  try {
    await requireDirectory(directory.path, directory.identity);
    claim = await createOwned(join(directory.path, `${failure.store}.claim`));
    const token = `${randomUUID()}\n`;
    await claim.handle.writeFile(token, 'utf8');
    claim.token = token;
    await closeOwned(claim);
    const target = join(directory.path, `${failure.store}.json`);
    const previous = await readPrevious(target, failure.store);
    if (previous.state === 'unavailable') throw unavailable();
    if (previous.failure?.processInstanceId === failure.processInstanceId) {
      if (JSON.stringify(previous.failure) !== JSON.stringify(failure)) throw unavailable();
      return;
    }
    const bytes = JSON.stringify(failure);
    if (Buffer.byteLength(bytes) > maximumBytes) throw unavailable();
    temporary = await createOwned(join(directory.path, `${failure.store}.tmp`));
    await temporary.handle.writeFile(bytes, 'utf8');
    await closeOwned(temporary);
    await requireDirectory(directory.path, directory.identity);
    await targetUnchanged(target, previous);
    const temporaryStat = await lstat(temporary.path);
    if (
      !temporaryStat.isFile() ||
      temporaryStat.isSymbolicLink() ||
      !privatelyOwned(temporaryStat) ||
      !sameIdentity(temporaryStat, temporary)
    )
      throw unavailable();
    await rename(temporary.path, target);
    temporary = undefined;
  } finally {
    // Cleanup never removes a foreign inode or token and never extends capture/shutdown waits.
    try {
      await removeOwned(temporary);
    } finally {
      await removeOwned(claim);
    }
  }
}

/** Independent private artifacts: no database, logger, capture queue, retry or shutdown dependency. */
export function createCaptureFailureRecorder(options: {
  appDataPath: string;
  processInstanceId: string;
}) {
  const status: CaptureFailureArtifacts = {
    diagnostics: initialStatus(),
    monitoring: initialStatus(),
  };
  const observed = new Set<CaptureStoreKind>();
  let directory: { path: string; identity: Identity } | undefined;
  const ready = (async () => {
    try {
      directory = await privateDirectory(options.appDataPath);
      await Promise.all(
        kinds.map(async (kind) => {
          try {
            const previous = await readPrevious(join(directory!.path, `${kind}.json`), kind);
            status[kind].previousFailureState = previous.state;
            if (previous.failure) status[kind].previousFailure = previous.failure;
          } catch {
            status[kind].previousFailureState = 'unavailable';
          }
        }),
      );
    } catch {
      directory = undefined;
      for (const kind of kinds) status[kind].previousFailureState = 'unavailable';
    }
  })();
  function observe(kind: CaptureStoreKind, input: CaptureFailure | undefined): void {
    if (!CaptureStoreKindSchema.safeParse(kind).success || observed.has(kind)) return;
    observed.add(kind);
    try {
      const parsed = CaptureFailureSchema.safeParse(input);
      if (
        !parsed.success ||
        parsed.data.store !== kind ||
        parsed.data.processInstanceId !== options.processInstanceId
      )
        throw unavailable();
      const failure = parsed.data;
      status[kind].publication = 'pending';
      void ready
        .then(async () => {
          if (!directory) throw unavailable();
          await publish(directory, failure);
          status[kind].publication = 'stored';
        })
        .catch(() => {
          status[kind].publication = 'unavailable';
        });
    } catch {
      status[kind].publication = 'unavailable';
    }
  }
  return {
    ready,
    observe,
    status(): CaptureFailureArtifacts {
      const copy = (kind: CaptureStoreKind) => ({
        ...status[kind],
        ...(status[kind].previousFailure
          ? { previousFailure: { ...status[kind].previousFailure } }
          : {}),
      });
      return { diagnostics: copy('diagnostics'), monitoring: copy('monitoring') };
    },
  };
}
export type CaptureFailureRecorder = ReturnType<typeof createCaptureFailureRecorder>;
