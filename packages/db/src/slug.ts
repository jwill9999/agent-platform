/**
 * Slug generation utilities for human-readable resource identifiers.
 */

const MAX_SLUG_LENGTH = 128;

/**
 * Convert a human-readable name to a URL-safe slug.
 *
 * Rules: lowercase, hyphens replace spaces/underscores, strip
 * non-alphanumeric, collapse consecutive hyphens, trim leading/trailing
 * hyphens, cap at 128 characters.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replaceAll(/[^a-z0-9\s-]/g, '')
    .replaceAll(/[\s_]+/g, '-')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^-|-$/g, '')
    .slice(0, MAX_SLUG_LENGTH);
}

/**
 * Return a slug that does not collide with `existing`.
 *
 * Appends `-2`, `-3`, … up to `maxAttempts` if the base slug is taken.
 * Used for in-memory collision resolution (e.g. seed scripts).
 * Production writes rely on the DB UNIQUE constraint + retry loop.
 */
export function uniqueSlug(
  base: string,
  existing: Set<string> | string[],
  maxAttempts = 10,
): string {
  const lookup = existing instanceof Set ? existing : new Set(existing);
  if (!lookup.has(base)) return base;
  for (let i = 2; i <= maxAttempts + 1; i++) {
    const candidate = `${base}-${i}`;
    if (!lookup.has(candidate)) return candidate;
  }
  throw new Error(
    `Slug collision: could not find unique slug for "${base}" after ${maxAttempts} attempts`,
  );
}
