/**
 * Critic event parsing helpers.
 *
 * The harness `critic` node emits `thinking` NDJSON events whose `content`
 * follows one of these shapes (see `packages/harness/src/nodes/critic.ts`):
 *
 *   "Critic: revise (<n>/<cap>) - <reasons>"
 *   "Critic: accept after <n> revision(s) - <reasons>"
 *   "Critic: accept on first pass - <reasons>"
 *
 * It also emits an `error` NDJSON event with code `CRITIC_CAP_REACHED` when
 * the critic loop bails out without acceptance.
 *
 * The frontend parses these into structured `CriticEvent`s so the UI can
 * render them as distinct badges and surface a live status label.
 */

export type CriticEventKind = 'accept' | 'revise' | 'cap_reached';

export interface CriticEvent {
  kind: CriticEventKind;
  /** Iteration index emitted with revise (1-based) or final accept count. */
  iteration?: number;
  /** Iteration cap (denominator). */
  total?: number;
  /** Human-readable reasons summary (may be empty). */
  reasons: string;
}

const CRITIC_PREFIX = 'Critic:';

/** Returns true when the raw thinking content looks like a critic message. */
export function isCriticContent(content: string): boolean {
  return content.startsWith(CRITIC_PREFIX);
}

/** Strip the prefix and trim. */
function stripPrefix(content: string): string {
  return content.slice(CRITIC_PREFIX.length).trim();
}

/** Extract the trailing reasons after a " - " separator (if present). */
function extractReasons(rest: string): string {
  const idx = rest.indexOf(' - ');
  return idx >= 0 ? rest.slice(idx + 3).trim() : '';
}

function parseRevise(rest: string): CriticEvent | null {
  const m = /^revise\s*\((\d+)\/(\d+)\)/i.exec(rest);
  if (!m) return null;
  return {
    kind: 'revise',
    iteration: Number(m[1]),
    total: Number(m[2]),
    reasons: extractReasons(rest),
  };
}

function parseAccept(rest: string): CriticEvent | null {
  if (!/^accept\b/i.test(rest)) return null;
  const after = /^accept\s+after\s+(\d+)\s+revision/i.exec(rest);
  if (after) {
    return {
      kind: 'accept',
      iteration: Number(after[1]),
      reasons: extractReasons(rest),
    };
  }
  // "accept on first pass" or any other accept variant.
  return {
    kind: 'accept',
    iteration: 0,
    reasons: extractReasons(rest),
  };
}

/**
 * Parse a `thinking` event content string into a structured `CriticEvent`.
 * Returns `null` when the content is not a critic message.
 */
export function parseCriticContent(content: string): CriticEvent | null {
  if (!isCriticContent(content)) return null;
  const rest = stripPrefix(content);
  return parseRevise(rest) ?? parseAccept(rest);
}

/**
 * Format the "in-progress" / status-bar text for the most recent critic event
 * on the active assistant turn. Used by `StatusLabel` instead of the generic
 * `Thinking…` loader.
 */
export function formatCriticStatus(event: CriticEvent): string {
  switch (event.kind) {
    case 'revise':
      return formatReviseLabel(event);
    case 'accept':
      return 'Finalising';
    case 'cap_reached':
      return 'Critic cap reached';
  }
}

/**
 * Format the badge text for an individual critic event in the chat history.
 * Differs from `formatCriticStatus` only for `accept`, which surfaces the
 * final revision count once the loop has settled.
 */
export function formatCriticBadgeLabel(event: CriticEvent): string {
  if (event.kind !== 'accept') return formatCriticStatus(event);
  const n = event.iteration ?? 0;
  if (n <= 0) return 'Accepted';
  const suffix = n === 1 ? '' : 's';
  return `Accepted after ${n} revision${suffix}`;
}

function formatReviseLabel(event: CriticEvent): string {
  const denom = event.total ? `/${event.total}` : '';
  return `Revising (${event.iteration ?? '?'}${denom})`;
}
