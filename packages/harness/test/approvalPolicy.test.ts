import { describe, expect, it } from 'vitest';
import { requiresHumanApproval } from '../src/security/approvalPolicy.js';

describe('requiresHumanApproval', () => {
  it('requires approval when explicitly configured', () => {
    expect(requiresHumanApproval({ requiresApproval: true, riskTier: 'low' })).toMatchObject({
      required: true,
      riskTier: 'low',
    });
  });

  it('requires approval for high and critical risk tiers', () => {
    expect(requiresHumanApproval({ riskTier: 'high' }).required).toBe(true);
    expect(requiresHumanApproval({ riskTier: 'critical' }).required).toBe(true);
  });

  it('allows lower-risk tools by default', () => {
    expect(requiresHumanApproval({ riskTier: 'zero' }).required).toBe(false);
    expect(requiresHumanApproval({ riskTier: 'low' }).required).toBe(false);
    expect(requiresHumanApproval({ riskTier: 'medium' }).required).toBe(false);
  });
});
