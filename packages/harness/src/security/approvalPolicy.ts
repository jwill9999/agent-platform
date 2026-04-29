import type { RiskTier, Tool as ContractTool } from '@agent-platform/contracts';

export type ApprovalRequirement = {
  required: boolean;
  riskTier?: RiskTier;
  reason?: string;
};

export function requiresHumanApproval(
  tool: Pick<ContractTool, 'requiresApproval' | 'riskTier'>,
): ApprovalRequirement {
  if (tool.requiresApproval) {
    return {
      required: true,
      riskTier: tool.riskTier,
      reason: 'Tool is marked as requiring human approval.',
    };
  }

  if (tool.riskTier === 'critical') {
    return {
      required: true,
      riskTier: tool.riskTier,
      reason: 'Critical-risk tools require human approval.',
    };
  }

  if (tool.riskTier === 'high') {
    return {
      required: true,
      riskTier: tool.riskTier,
      reason: 'High-risk tools require human approval.',
    };
  }

  return {
    required: false,
    riskTier: tool.riskTier,
  };
}
