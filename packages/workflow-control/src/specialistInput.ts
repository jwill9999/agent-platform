import { createHash } from 'node:crypto';

import { z } from 'zod';

import { taskPacketSchema } from './contracts.js';

const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
/** The persisted scheduler packet, input evidence, and actual phase prompt share this envelope. */
export const specialistInputEnvelopeSchema = z
  .object({
    kind: z.literal('specialist_input'),
    binding: z
      .object({
        executionDigest: digest,
        ownerDigest: digest,
        callbackId: digest,
        headSha: z.string().regex(/^[a-f0-9]{40}$/u),
        runVersion: z.number().int().positive(),
        phaseLeaseEpoch: z.number().int().positive(),
        workspaceLeaseEpoch: z.number().int().positive(),
        runLeaseEpoch: z.number().int().positive(),
        taskLeaseEpoch: z.number().int().positive(),
      })
      .strict(),
    task: taskPacketSchema,
  })
  .strict();
export type SpecialistInputEnvelope = z.infer<typeof specialistInputEnvelopeSchema>;

export function specialistExecutionDigest(executionId: string): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(executionId)).digest('hex')}`;
}
