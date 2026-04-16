import { createLanguageModel } from '@agent-platform/model-router';
import { generateText } from 'ai';
import type { Agent } from '@agent-platform/contracts';
import { runPlannerRepairLoop, type PlannerResult } from '@agent-platform/planner';

import type { HarnessStateType } from '../graphState.js';
import type { TraceEvent } from '../trace.js';
import type { OutputEmitter, ToolDefinition } from '../types.js';

// ---------------------------------------------------------------------------
// Planning prompt builder
// ---------------------------------------------------------------------------

function buildPlanningPrompt(
  systemPrompt: string,
  userMessage: string,
  toolDefs: ToolDefinition[],
): string {
  const toolManifest = toolDefs.map((t) => `- **${t.name}**: ${t.description}`).join('\n');

  return `${systemPrompt}

## Available Tools
${toolManifest || '(none)'}

## Planning Instructions
You are in PLANNING mode. Analyze the user's request and produce a step-by-step execution plan as JSON.

The JSON must match this exact schema:
\`\`\`json
{
  "id": "<unique plan id>",
  "tasks": [
    {
      "id": "<unique task id>",
      "description": "<what this step does>",
      "toolIds": ["<tool name to use>"]
    }
  ]
}
\`\`\`

Rules:
- Each task should use one or more of the available tools listed above.
- Tasks are executed sequentially in order.
- Be specific in descriptions so each task can be executed independently.
- Return ONLY the JSON object, no markdown fences or extra text.

## User Request
${userMessage}`;
}

// ---------------------------------------------------------------------------
// Plan generate node options
// ---------------------------------------------------------------------------

export type PlanGenerateNodeOptions = {
  agent: Agent;
  emitter?: OutputEmitter;
};

// ---------------------------------------------------------------------------
// Plan generate node factory
// ---------------------------------------------------------------------------

const MAX_REPAIR_ATTEMPTS = 3;

/**
 * Creates a graph node that generates a plan from the user's message using the LLM.
 * Uses runPlannerRepairLoop for automatic repair on malformed output.
 */
export function createPlanGenerateNode(options: PlanGenerateNodeOptions) {
  return async function planGenerateNode(
    state: HarnessStateType,
  ): Promise<Partial<HarnessStateType>> {
    const { messages, toolDefinitions, modelConfig } = state;

    if (!modelConfig) {
      throw new Error('plan_generate: modelConfig is required in state');
    }

    // Extract user message (last user message in conversation)
    const userMsg = [...messages].reverse().find((m) => m.role === 'user');
    const systemMsg = messages.find((m) => m.role === 'system');

    if (!userMsg) {
      return {
        halted: true,
        trace: [{ type: 'plan_failed', reason: 'No user message found' }],
      };
    }

    const planningPrompt = buildPlanningPrompt(
      systemMsg?.content ?? options.agent.systemPrompt,
      userMsg.content,
      toolDefinitions,
    );

    const model = createLanguageModel({
      provider: modelConfig.provider ?? 'openai',
      model: modelConfig.model,
      apiKey: modelConfig.apiKey,
    });

    async function generatePlan(): Promise<string> {
      const result = await generateText({
        model,
        messages: [{ role: 'user', content: planningPrompt }],
      });
      return result.text;
    }

    const planResult: PlannerResult = await runPlannerRepairLoop({
      agent: options.agent,
      generate: generatePlan,
      maxAttempts: MAX_REPAIR_ATTEMPTS,
    });

    if (planResult.ok) {
      const trace: TraceEvent[] = [
        {
          type: 'plan_ready',
          planId: planResult.plan.id,
          taskCount: planResult.plan.tasks.length,
        },
      ];

      return {
        plan: planResult.plan,
        trace,
      };
    }

    // Plan generation failed after all repair attempts
    let reason: string;
    if (planResult.phase === 'json') {
      reason = `JSON parse error: ${planResult.error}`;
    } else if (planResult.phase === 'schema') {
      reason = `Schema validation: ${planResult.message}`;
    } else {
      reason = `Policy violation: disallowed tools ${planResult.disallowedToolIds.join(', ')}`;
    }

    if (options.emitter) {
      options.emitter.emit({
        type: 'error',
        code: 'PLAN_FAILED',
        message: `Plan generation failed: ${reason}`,
      });
    }

    return {
      halted: true,
      trace: [{ type: 'plan_failed', reason }],
    };
  };
}
