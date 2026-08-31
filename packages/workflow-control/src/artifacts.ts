import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { WorkflowStore } from './storage.js';

export interface StoredArtifact {
  digest: string;
  path: string;
  sizeBytes: number;
}

export class ContentAddressedArtifactStore {
  readonly #root: string;

  constructor(root: string) {
    this.#root = root;
  }

  async put(content: Uint8Array): Promise<StoredArtifact> {
    const hash = createHash('sha256').update(content).digest('hex');
    const digest = `sha256:${hash}`;
    const directory = join(this.#root, hash.slice(0, 2));
    const path = join(directory, hash);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    try {
      const existing = await stat(path);
      if (existing.size !== content.byteLength) throw new Error('artifact digest collision');
      const existingContent = await readFile(path);
      const existingHash = createHash('sha256').update(existingContent).digest('hex');
      if (existingHash !== hash) throw new Error('artifact digest collision');
      return { digest, path, sizeBytes: existing.size };
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
    }
    const temporary = join(directory, `.${hash}.${randomUUID()}.tmp`);
    await writeFile(temporary, content, { flag: 'wx', mode: 0o600 });
    try {
      await rename(temporary, path);
    } catch (error) {
      const existing = await stat(path).catch(() => undefined);
      if (existing?.size !== content.byteLength) throw error;
    }
    return { digest, path, sizeBytes: content.byteLength };
  }

  async get(digest: string): Promise<Uint8Array> {
    const match = /^sha256:([a-f0-9]{64})$/u.exec(digest);
    if (match === null) throw new Error('invalid artifact digest');
    const hash = match[1]!;
    const content = await readFile(join(this.#root, hash.slice(0, 2), hash));
    const actual = createHash('sha256').update(content).digest('hex');
    if (actual !== hash) throw new Error('artifact integrity check failed');
    return content;
  }
}

export type ArtifactFaultBoundary =
  | 'before_artifact_put'
  | 'after_artifact_put'
  | 'before_evidence_record'
  | 'after_evidence_record';

export class JournaledArtifactRecorder {
  readonly #artifacts: ContentAddressedArtifactStore;
  readonly #store: WorkflowStore;
  readonly #fault: (boundary: ArtifactFaultBoundary) => void;

  constructor(
    artifacts: ContentAddressedArtifactStore,
    store: WorkflowStore,
    fault: (boundary: ArtifactFaultBoundary) => void = () => undefined,
  ) {
    this.#artifacts = artifacts;
    this.#store = store;
    this.#fault = fault;
  }

  async record(
    content: Uint8Array,
    metadata: Omit<Parameters<WorkflowStore['recordEvidence']>[0], 'digest' | 'sizeBytes'>,
  ): Promise<StoredArtifact> {
    this.#fault('before_artifact_put');
    const artifact = await this.#artifacts.put(content);
    this.#fault('after_artifact_put');
    this.#fault('before_evidence_record');
    this.#store.recordEvidence({
      ...metadata,
      digest: artifact.digest,
      sizeBytes: artifact.sizeBytes,
    });
    this.#fault('after_evidence_record');
    return artifact;
  }
}
