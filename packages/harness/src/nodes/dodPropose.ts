import { generateText } from 'ai';
import { createLanguageModel, type SupportedProvider } from '@agent-platform/model-router';
import { DodContractSchema, type DodContract } from '@agent-platform/contracts';

import type { HarnessStateType } from '../graphState.js';
import { extractFirstJsonObject } from './jsonUtils.js';

const DEFAULT_DOD_CRITERIA = "Answer the user's question.";

export type DodCriteriaProposer = (state: HarnessStateType) => Promise<string[]>;

export type DodProposeNodeOptions = {
  propose?: DodCriteriaProposer;
};

function parseCriteria(json: string): string[] | null {
  try {
    const parsed = JSON.parse(json) as { criteria?: unknown };
    if (
      Array.isArray(parsed.criteria) &&
      parsed.criteria.length > 0 &&
      parsed.criteria.every((criterion) => typeof criterion === 'string')
    ) {
      return parsed.criteria;
    }
  } catch {
    /* fall through to null */
  }
  return null;
}

async function defaultPropose(state: HarnessStateType): Promise<string[]> {
  const firstUser = state.messages?.find((message) => message.role === 'user');
  const { modelConfig } = state;
  if (!firstUser?.content || !modelConfig) {
    return [DEFAULT_DOD_CRITERIA];
  }

  const model = createLanguageModel({
    provider: (modelConfig.provider ?? 'openai') as SupportedProvider,
    model: modelConfig.model,
    apiKey: modelConfig.apiKey,
  });
  const result = await generateText({
    model,
    messages: [
      {
        role: 'system',
        content:
          'Return JSON only with shape {"criteria":["..."]}. Produce 1-3 concise, testable Definition-of-Done criteria for the assistant response.',
      },
      {
        role: 'user',
        content: `User request:\n${firstUser.content}`,
      },
    ],
  });
  const json = extractFirstJsonObject(result.text);
  if (!json) {
    return [DEFAULT_DOD_CRITERIA];
  }
  return parseCriteria(json) ?? [DEFAULT_DOD_CRITERIA];
}

function buildInitialDodContract(criteria: string[]): DodContract {
  return DodContractSchema.parse({
    criteria,
    evidence: [],
    passed: false,
    failedCriteria: [],
  });
}

export function createDodProposeNode(options: DodProposeNodeOptions = {}) {
  const propose = options.propose ?? defaultPropose;

  return async (state: HarnessStateType) => {
    if (state.dodContract?.criteria.length) {
      return {};
    }

    const criteria = await propose(state);
    return {
      dodContract: buildInitialDodContract(criteria),
    };
  };
}
