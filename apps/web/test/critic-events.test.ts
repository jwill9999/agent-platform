import { describe, expect, it } from 'vitest';

import {
  formatCriticBadgeLabel,
  formatCriticStatus,
  isCriticContent,
  parseCriticContent,
} from '../lib/critic-events';

describe('parseCriticContent', () => {
  it('returns null for plain thinking content', () => {
    expect(parseCriticContent('Considering options for the user…')).toBeNull();
    expect(parseCriticContent('')).toBeNull();
  });

  it('parses revise iterations with cap', () => {
    const ev = parseCriticContent('Critic: revise (2/3) - missing edge case for null');
    expect(ev).toEqual({
      kind: 'revise',
      iteration: 2,
      total: 3,
      reasons: 'missing edge case for null',
    });
  });

  it('parses accept on first pass', () => {
    const ev = parseCriticContent('Critic: accept on first pass - looks good');
    expect(ev?.kind).toBe('accept');
    expect(ev?.iteration).toBe(0);
    expect(ev?.reasons).toBe('looks good');
  });

  it('parses accept after N revisions', () => {
    const ev = parseCriticContent('Critic: accept after 2 revision(s) - addressed all concerns');
    expect(ev).toEqual({
      kind: 'accept',
      iteration: 2,
      reasons: 'addressed all concerns',
    });
  });

  it('handles missing reasons gracefully', () => {
    expect(parseCriticContent('Critic: revise (1/3)')?.reasons).toBe('');
  });

  it('discriminates non-critic thinking content', () => {
    expect(isCriticContent('Critic: revise (1/3) - x')).toBe(true);
    expect(isCriticContent('Thinking about Critic: prefix')).toBe(false);
    expect(isCriticContent('A general thought')).toBe(false);
  });
});

describe('formatCriticStatus', () => {
  it('renders revise with iteration/cap', () => {
    expect(formatCriticStatus({ kind: 'revise', iteration: 2, total: 3, reasons: '' })).toBe(
      'Revising (2/3)',
    );
  });

  it('renders accept as Finalising', () => {
    expect(formatCriticStatus({ kind: 'accept', iteration: 1, reasons: '' })).toBe('Finalising');
  });

  it('renders cap reached', () => {
    expect(formatCriticStatus({ kind: 'cap_reached', reasons: 'cap' })).toBe('Critic cap reached');
  });
});

describe('formatCriticBadgeLabel', () => {
  it('reuses the status text for revise and cap_reached', () => {
    expect(formatCriticBadgeLabel({ kind: 'revise', iteration: 1, total: 3, reasons: '' })).toBe(
      'Revising (1/3)',
    );
    expect(formatCriticBadgeLabel({ kind: 'cap_reached', reasons: '' })).toBe('Critic cap reached');
  });

  it('renders accept on first pass without revision count', () => {
    expect(formatCriticBadgeLabel({ kind: 'accept', iteration: 0, reasons: '' })).toBe('Accepted');
  });

  it('renders accept after one revision (singular)', () => {
    expect(formatCriticBadgeLabel({ kind: 'accept', iteration: 1, reasons: '' })).toBe(
      'Accepted after 1 revision',
    );
  });

  it('renders accept after multiple revisions (plural)', () => {
    expect(formatCriticBadgeLabel({ kind: 'accept', iteration: 3, reasons: '' })).toBe(
      'Accepted after 3 revisions',
    );
  });
});
