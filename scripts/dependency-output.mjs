import { Buffer } from 'node:buffer';
import {
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  openSync,
  readSync,
  writeFileSync,
} from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import process from 'node:process';
import { TextDecoder } from 'node:util';

// Fail rather than truncate: the observed complete vendor inventory contains 171,440 characters.
export const MAX_VENDOR_OUTPUT_BYTES = 2 * 1024 * 1024;
const FILENAMES = new Map([
  ['dependency-changes', 'dependency-vendor-changes.json'],
  ['vulnerable-changes', 'dependency-vendor-vulnerable-changes.json'],
]);

function reject(reason) {
  throw new Error(`Dependency review incomplete: ${reason}`);
}

function outputPath(directory, kind) {
  if (typeof directory !== 'string' || !isAbsolute(directory) || !FILENAMES.has(kind))
    reject('vendor output destination unavailable');
  return join(resolve(directory), FILENAMES.get(kind));
}

function validateOutput(data) {
  if (typeof data !== 'string') reject('vendor output missing or malformed');
  if (Buffer.byteLength(data, 'utf8') > MAX_VENDOR_OUTPUT_BYTES)
    reject('vendor output size limit exceeded');
  const bytes = Buffer.from(data, 'utf8');
  if (bytes.toString('utf8') !== data) reject('vendor output invalid UTF-8');
  let parsed;
  try {
    parsed = JSON.parse(data);
  } catch {
    reject('vendor output missing or malformed');
  }
  if (!Array.isArray(parsed)) reject('vendor output is not an array');
  return bytes;
}

/** Preserve the evaluated action output as data, never as an environment/argv value or shell code. */
export function writeVendorOutput({ directory, kind, data }) {
  const bytes = validateOutput(data);
  const path = outputPath(directory, kind);
  const descriptor = openSync(path, 'wx', 0o600);
  try {
    fchmodSync(descriptor, 0o600);
    writeFileSync(descriptor, bytes);
  } finally {
    closeSync(descriptor);
  }
  return path;
}

/** Only the fixed private regular file is accepted; reads remain bounded even if its size changes. */
export function readVendorOutput({ directory, kind, path }) {
  if (typeof path !== 'string' || path !== outputPath(directory, kind))
    reject('vendor output file unavailable');
  const descriptor = openSync(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const stat = fstatSync(descriptor);
    if (
      !stat.isFile() ||
      stat.nlink !== 1 ||
      (stat.mode & 0o7777) !== 0o600 ||
      stat.uid !== process.getuid()
    )
      reject('vendor output file is not private and regular');
    if (stat.size > MAX_VENDOR_OUTPUT_BYTES) reject('vendor output size limit exceeded');
    const bytes = Buffer.alloc(MAX_VENDOR_OUTPUT_BYTES + 1);
    let length = 0;
    while (length < bytes.length) {
      const count = readSync(descriptor, bytes, length, bytes.length - length, null);
      if (count === 0) break;
      length += count;
    }
    if (length > MAX_VENDOR_OUTPUT_BYTES) reject('vendor output size limit exceeded');
    if (length !== stat.size) reject('vendor output changed during read');
    let data;
    try {
      data = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
        bytes.subarray(0, length),
      );
    } catch {
      reject('vendor output invalid UTF-8');
    }
    validateOutput(data);
    return data;
  } finally {
    closeSync(descriptor);
  }
}
