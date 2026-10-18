import { writeFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import process from 'node:process';
import { pathToFileURL, URL } from 'node:url';
import { TextDecoder } from 'node:util';
import { createHash } from 'node:crypto';

const { fetch: defaultFetch, AbortSignal } = globalThis;

const API = 'https://api.github.com';
const SNAPSHOT_WARNINGS = 'x-github-dependency-graph-snapshot-warnings';
const SHA = /^[a-f0-9]{40}$/;

function reject(reason) {
  throw new Error(`Dependency review incomplete: ${reason}`);
}

function requireNoWarnings(value) {
  const encoded = (value ?? '').trim();
  if (!encoded) return;
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.toString('base64') !== encoded) reject('malformed snapshot warning');
  let warning;
  try {
    warning = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    reject('malformed snapshot warning');
  }
  if (warning.trim()) reject('snapshot warning');
}

function skipSpace(cursor) {
  while (cursor.text[cursor.offset] === ' ' || cursor.text[cursor.offset] === '\t') cursor.offset++;
}

function linkParameters(cursor) {
  const pattern =
    /;\s*([!#$%&'*+.^_\x60|~0-9A-Za-z-]+)\s*=\s*("(?:[^"\\\r\n]|\\[\t\x20-\x7e])*"|[!#$%&'*+.^_\x60|~0-9A-Za-z-]+)/y;
  const parameters = new Map();
  while (cursor.text[cursor.offset] === ';') {
    pattern.lastIndex = cursor.offset;
    const entry = pattern.exec(cursor.text);
    if (!entry) reject('malformed pagination parameter');
    const name = entry[1].toLowerCase();
    if (parameters.has(name)) reject('ambiguous pagination parameter');
    const value = entry[2].startsWith('"')
      ? entry[2].slice(1, -1).replace(/\\(.)/g, '$1')
      : entry[2];
    parameters.set(name, value);
    cursor.offset = pattern.lastIndex;
    skipSpace(cursor);
  }
  return parameters;
}

function linkRelations(parameters) {
  const rel = parameters.get('rel');
  if (!rel?.trim() || parameters.has('anchor')) reject('ambiguous pagination relation');
  const relations = rel
    .toLowerCase()
    .trim()
    .split(/[ \t]+/);
  if (new Set(relations).size !== relations.length) reject('ambiguous pagination relation');
  return relations;
}

function parseLinks(text) {
  if (text.length > 16_384 || /[\r\n]/.test(text)) reject('malformed pagination header');
  const cursor = { text, offset: 0 };
  const target = /<([^<>\s]+)>/y;
  const links = [];
  // Consume every link/parameter; commas in targets or quoted titles are not separators.
  while (cursor.offset < text.length) {
    skipSpace(cursor);
    target.lastIndex = cursor.offset;
    const match = target.exec(text);
    if (!match) reject('malformed pagination header');
    cursor.offset = target.lastIndex;
    skipSpace(cursor);
    links.push({ target: match[1], relations: linkRelations(linkParameters(cursor)) });
    if (cursor.offset === text.length) break;
    if (text[cursor.offset++] !== ',') reject('malformed pagination header');
    skipSpace(cursor);
    if (cursor.offset === text.length) reject('malformed pagination header');
  }
  return links;
}

function singleRelation(links, relation, expectedPath) {
  const matches = links.filter((link) => link.relations.includes(relation));
  if (matches.length > 1) reject('ambiguous pagination relation');
  return matches.length ? paginationTarget(matches[0].target, expectedPath) : null;
}

function nextPage(link, current, expectedPath) {
  if (!link?.trim()) return null;
  const links = parseLinks(link);
  const next = singleRelation(links, 'next', expectedPath);
  const last = singleRelation(links, 'last', expectedPath);
  if (next && next.searchParams.get('page') !== String(current + 1))
    reject('unexpected pagination target');
  if (!next && last && Number(last.searchParams.get('page')) > current)
    reject('missing next pagination link');
  return next;
}

function paginationTarget(target, expectedPath) {
  let url;
  try {
    url = new URL(target);
  } catch {
    reject('unexpected pagination target');
  }
  const page = Number(url.searchParams.get('page'));
  if (
    url.origin !== API ||
    url.pathname !== expectedPath ||
    url.username ||
    url.password ||
    url.hash ||
    url.searchParams.get('per_page') !== '100' ||
    url.searchParams.size !== 2 ||
    [...url.searchParams.keys()].some((key) => !['page', 'per_page'].includes(key)) ||
    url.searchParams.getAll('page').length !== 1 ||
    url.searchParams.getAll('per_page').length !== 1 ||
    !Number.isSafeInteger(page) ||
    page < 1 ||
    url.searchParams.get('page') !== String(page)
  ) {
    reject('unexpected pagination target');
  }
  return url;
}

// Provenance schema is bound to this pinned official action, not a second advisory policy.
const VENDOR_REVISION = 'a1d282b36b6f3519aa1f3fc636f609c47dddb294';
const VENDOR_SCHEMA_SHA256 = '357af1da7161524295c6656ee57f9157eedf629f83e5ee1256339f25bc641c66';
function requireRecord(row, reason) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) reject(reason);
}

function stringFields(row, names, nullable = false) {
  const fields = {};
  for (const name of names) {
    if (typeof row[name] !== 'string' && !(nullable && row[name] === null))
      reject('invalid inventory field');
    fields[name] = row[name];
  }
  return fields;
}

function canonicalAdvisory(advisory) {
  requireRecord(advisory, 'invalid inventory advisory');
  const severity = advisory.severity === undefined ? 'low' : advisory.severity;
  if (!['critical', 'high', 'moderate', 'low'].includes(severity))
    reject('invalid inventory severity');
  const fields = stringFields(advisory, ['advisory_ghsa_id', 'advisory_summary', 'advisory_url']);
  return JSON.stringify({ severity, ...fields });
}

function canonicalChange(row) {
  requireRecord(row, 'invalid inventory row');
  if (!['added', 'removed'].includes(row.change_type)) reject('invalid inventory change type');
  if (row.scope !== undefined && !['unknown', 'runtime', 'development'].includes(row.scope))
    reject('invalid inventory scope');
  const vulnerabilities = row.vulnerabilities === undefined ? [] : row.vulnerabilities;
  if (!Array.isArray(vulnerabilities)) reject('invalid inventory vulnerabilities');
  return JSON.stringify({
    change_type: row.change_type,
    ...stringFields(row, ['manifest', 'ecosystem', 'name', 'version', 'package_url']),
    ...stringFields(row, ['license', 'source_repository_url'], true),
    ...(row.scope === undefined ? {} : { scope: row.scope }),
    vulnerabilities: vulnerabilities.map(canonicalAdvisory).sort(),
  });
}

/** Compare complete inventories, including metadata and duplicate counts, after vendor analysis. */
export function verifyVendorInventory({
  outcome,
  vendorChanges,
  comparison,
  expectedOutcome = 'success',
}) {
  if (!['success', 'failure'].includes(expectedOutcome) || outcome !== expectedOutcome)
    reject('vendor analysis did not complete with the required outcome');
  let changes;
  try {
    changes = JSON.parse(vendorChanges);
  } catch {
    reject('vendor inventory missing or malformed');
  }
  if (!Array.isArray(changes) || !Array.isArray(comparison?.changes))
    reject('invalid inventory data');
  const vendor = changes.map(canonicalChange).sort();
  const raw = comparison.changes.map(canonicalChange).sort();
  if (JSON.stringify(vendor) !== JSON.stringify(raw)) reject('vendor inventory mismatch');
  return {
    actionRevision: VENDOR_REVISION,
    schemaSha256: VENDOR_SCHEMA_SHA256,
    changes: raw.length,
    inventorySha256: createHash('sha256').update(JSON.stringify(raw)).digest('hex'),
  };
}

/** Completeness/provenance only: GitHub's official action makes vulnerability decisions. */
export async function readComparison({ repository, base, head, token, fetchImpl = defaultFetch }) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository ?? '')) reject('repository');
  if (!SHA.test(base ?? '') || !SHA.test(head ?? '')) reject('immutable revision required');
  if (!token) reject('token unavailable');
  const pathname = `/repos/${repository}/dependency-graph/compare/${base}...${head}`;
  let url = new URL(`${API}${pathname}?per_page=100&page=1`);
  const changes = [];
  const requestIds = [];
  let pages = 0;
  while (url) {
    if (++pages > 25) reject('pagination limit exceeded');
    const response = await fetchImpl(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status !== 200) reject(`HTTP ${response.status}`);
    requireNoWarnings(response.headers.get(SNAPSHOT_WARNINGS));
    const text = await response.text();
    if (Buffer.byteLength(text) > 8 * 1024 * 1024) reject('response size limit exceeded');
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      reject('invalid JSON');
    }
    if (
      !Array.isArray(data) ||
      data.some((item) => !item || typeof item !== 'object' || Array.isArray(item))
    ) {
      reject('invalid comparison data');
    }
    changes.push(...data);
    requestIds.push(response.headers.get('x-github-request-id'));
    url = nextPage(response.headers.get('link'), pages, pathname);
  }
  return {
    repository,
    base,
    head,
    pages,
    requestIds,
    changes,
    checkedAt: new Date().toISOString(),
  };
}

/** A reverse control is valid only after the vendor identified these exact real changes. */
export function verifyNegativeControl({ outcome, vendorChanges, comparison, expected }) {
  if (outcome !== 'failure') reject('negative control did not fail');
  let changes;
  try {
    changes = JSON.parse(vendorChanges);
  } catch {
    reject('negative control output missing or malformed');
  }
  if (!Array.isArray(changes) || !changes.length || !expected.length) {
    reject('negative control output empty');
  }
  for (const target of expected) {
    const matches = (item) =>
      item?.change_type === 'added' &&
      item.name === target.name &&
      item.version === target.version &&
      item.scope === target.scope &&
      item.vulnerabilities?.some(
        (vulnerability) =>
          vulnerability.advisory_ghsa_id === target.ghsa &&
          vulnerability.severity === target.severity,
      );
    if (!changes.some(matches) || !comparison.changes.some(matches)) {
      reject('negative control advisory not established');
    }
  }
}

async function main() {
  const comparison = await readComparison({
    repository: process.env.GITHUB_REPOSITORY,
    base: process.env.DEPENDENCY_BASE_SHA,
    head: process.env.DEPENDENCY_HEAD_SHA,
    token: process.env.GH_TOKEN,
  });
  const negative = process.env.DEPENDENCY_NEGATIVE_CONTROL === 'true';
  const vendor = verifyVendorInventory({
    outcome: process.env.VENDOR_OUTCOME,
    vendorChanges: process.env.VENDOR_CHANGES,
    comparison,
    expectedOutcome: negative ? 'failure' : 'success',
  });
  if (negative) {
    verifyNegativeControl({
      outcome: process.env.VENDOR_OUTCOME,
      vendorChanges: process.env.VENDOR_VULNERABLE_CHANGES,
      comparison,
      expected: JSON.parse(process.env.EXPECTED_ADVISORIES ?? '[]'),
    });
  }
  if (!process.env.DEPENDENCY_RECEIPT) reject('receipt destination unavailable');
  writeFileSync(
    process.env.DEPENDENCY_RECEIPT,
    JSON.stringify(
      {
        ...comparison,
        vendor,
        runId: process.env.GITHUB_RUN_ID,
        attempt: process.env.GITHUB_RUN_ATTEMPT,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log(
    `Complete dependency comparison: ${comparison.changes.length} changes, ${comparison.pages} pages`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      error instanceof Error && error.message.startsWith('Dependency review incomplete:')
        ? error.message
        : 'Dependency comparison/control failed during transport or configuration.',
    );
    process.exitCode = 1;
  });
}
