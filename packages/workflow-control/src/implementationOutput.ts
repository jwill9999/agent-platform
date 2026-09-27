import { createHash } from 'node:crypto';
import { z } from 'zod';
import { agentResultSchema, relativePathSchema } from './contracts.js';
import { specialistInputEnvelopeSchema } from './specialistInput.js';

const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
const returnedFile = z
  .object({
    path: relativePathSchema,
    beforeDigest: digest.nullable(),
    afterDigest: digest.nullable(),
    content: z
      .string()
      .max(1024 * 1024)
      .nullable(),
  })
  .strict();

/** Immutable transport format. Parsing is not authority to apply it. */
export const implementationOutputSchema = z
  .object({
    kind: z.literal('implementation_output'),
    version: z.literal(1),
    executionId: z.string().min(1),
    attempt: z.number().int().positive(),
    input: specialistInputEnvelopeSchema,
    baselineDigest: digest,
    outputTreeDigest: digest,
    files: z.array(returnedFile).max(256),
    terminal: agentResultSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const fail = (message: string) => context.addIssue({ code: z.ZodIssueCode.custom, message });
    if (value.input.task.assignedRole !== 'implementation_worker')
      fail('implementation role required');
    let total = 0;
    const aliases = new Set<string>();
    const forbidden = new Set([
      '.git',
      '.beads',
      '.codex',
      '.agents',
      '.ssh',
      '.aws',
      '.azure',
      '.gnupg',
      '.gitconfig',
      '.gitattributes',
      '.gitmodules',
      '.git-credentials',
      '.npmrc',
      '.netrc',
      'auth.json',
    ]);
    for (const file of value.files) {
      if (
        /[\\:]/u.test(file.path) ||
        [...file.path].some(
          (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
        ) ||
        file.path
          .split('/')
          .some(
            (part) => part === '' || part === '.' || part.endsWith('.') || part.endsWith(' '),
          ) ||
        file.path.normalize('NFC') !== file.path
      )
        fail('noncanonical returned path');
      const alias = file.path.normalize('NFC').toLowerCase();
      if (aliases.has(alias)) fail('duplicate or aliased returned path');
      aliases.add(alias);
      if (
        file.path
          .split('/')
          .some(
            (part) => forbidden.has(part.toLowerCase()) || part.toLowerCase().startsWith('.env'),
          )
      )
        fail('prohibited returned path');
      if (
        !value.input.task.allowedPaths.some(
          (path) => file.path === path || file.path.startsWith(`${path}/`),
        )
      )
        fail('returned path outside task');
      if (file.content === null) {
        if (file.afterDigest !== null || file.beforeDigest === null) fail('invalid deletion');
      } else {
        const bytes = Buffer.from(file.content, 'utf8');
        total += bytes.length;
        if (
          bytes.length > 1024 * 1024 ||
          bytes.toString('utf8') !== file.content ||
          file.content.includes('\0')
        )
          fail('returned content is not bounded UTF-8 text');
        if (`sha256:${createHash('sha256').update(bytes).digest('hex')}` !== file.afterDigest)
          fail('returned content digest mismatch');
        if (file.beforeDigest === file.afterDigest) fail('unchanged returned file');
      }
    }
    if (total > 16 * 1024 * 1024) fail('returned byte limit exceeded');
    const reported = [...value.terminal.changedFiles].sort();
    const observed = value.files.map((file) => file.path).sort();
    if (JSON.stringify(reported) !== JSON.stringify(observed))
      fail('reported changes differ from returned bytes');
    const deleted = new Set(
      value.files.filter((file) => file.content === null).map((file) => file.beforeDigest),
    );
    if (value.files.some((file) => file.beforeDigest === null && deleted.has(file.afterDigest)))
      fail('rename-shaped output rejected');
  });
export type ImplementationOutput = z.infer<typeof implementationOutputSchema>;
