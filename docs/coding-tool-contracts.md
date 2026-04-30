# Coding Tool Contracts

This document defines the contract surface for the structured coding tool pack. It is the implementation reference for:

- `agent-platform-code-tools.3` structured edit tool
- `agent-platform-code-tools.4` read-only git tools
- `agent-platform-code-tools.5` governed test runner
- `agent-platform-code-tools.6` repository map and code search helpers
- `agent-platform-code-tools.7` UI/API visibility, audit trails, and end-to-end validation

The contracts use the existing `packages/contracts` conventions: Zod schemas are exported as `*Schema`, TypeScript types are inferred from those schemas, tool risk uses `RiskTierSchema`, and stream output uses the existing `tool_result` output variant with structured `data`.

## Tool Catalog

All coding tools are first-class harness tools. Their names are stable because audit logs, approval requests, UI rendering, and critic/Definition-of-Done evidence use them as source identifiers.

| Tool name            | Kind       | Risk tier | Approval | Purpose                                                 |
| -------------------- | ---------- | --------- | -------- | ------------------------------------------------------- |
| `coding_apply_patch` | `edit`     | `medium`  | No       | Apply deterministic workspace-bounded patches           |
| `git_status`         | `git`      | `low`     | No       | Return porcelain status and branch metadata             |
| `git_diff`           | `git`      | `low`     | No       | Return bounded diffs for workspace/repo paths           |
| `git_log`            | `git`      | `low`     | No       | Return bounded commit history                           |
| `run_quality_gate`   | `test`     | `medium`  | No       | Run allowlisted quality/test profiles with timeouts     |
| `repo_map`           | `repo_map` | `low`     | No       | Return bounded repository structure and package signals |
| `code_search`        | `search`   | `low`     | No       | Search code with bounded matches and context            |
| `find_related_tests` | `search`   | `low`     | No       | Find likely tests for a source file                     |

The tool pack intentionally excludes `git commit`, `git push`, dependency installation, and deployment. Those remain high or critical risk shell operations that require human approval under [Coding Runtime Baseline](coding-runtime.md).

## Shared Types

These schemas should live in `packages/contracts` when implementation begins. File placement can be either a new `codingTool.ts` module or split modules if later tasks need smaller ownership boundaries.

```ts
import { z } from 'zod';
import { RiskTierSchema } from './tool.js';

export const CodingToolKindSchema = z.enum(['edit', 'git', 'test', 'repo_map', 'search']);
export type CodingToolKind = z.infer<typeof CodingToolKindSchema>;

export const CodingToolStatusSchema = z.enum(['succeeded', 'failed', 'denied']);
export type CodingToolStatus = z.infer<typeof CodingToolStatusSchema>;

export const CodingArtifactKindSchema = z.enum([
  'diff',
  'stdout',
  'stderr',
  'file_list',
  'repo_map',
  'search_matches',
  'test_summary',
  'failure_summary',
  'audit_summary',
]);
export type CodingArtifactKind = z.infer<typeof CodingArtifactKindSchema>;

export const CodingArtifactStorageSchema = z.enum(['inline', 'workspace_file', 'database']);
export type CodingArtifactStorage = z.infer<typeof CodingArtifactStorageSchema>;

export const CodingArtifactSchema = z.object({
  kind: CodingArtifactKindSchema,
  label: z.string().min(1),
  storage: CodingArtifactStorageSchema,
  mimeType: z.string().min(1).default('text/plain'),
  content: z.string().optional(),
  uri: z.string().min(1).optional(),
  sizeBytes: z.number().int().min(0),
  truncated: z.boolean().default(false),
  sha256: z.string().min(64).max(64).optional(),
});
export type CodingArtifact = z.infer<typeof CodingArtifactSchema>;

export const CodingEvidenceSchema = z.object({
  kind: CodingToolKindSchema,
  summary: z.string().min(1),
  artifacts: z.array(CodingArtifactSchema).default([]),
  riskTier: RiskTierSchema,
  status: CodingToolStatusSchema,
  sourceTool: z.string().min(1),
  startedAtMs: z.number().int().nonnegative(),
  completedAtMs: z.number().int().nonnegative().optional(),
  durationMs: z.number().int().nonnegative().optional(),
});
export type CodingEvidence = z.infer<typeof CodingEvidenceSchema>;
```

`CodingEvidenceSchema` is the common `tool_result.data.evidence` payload. Each tool can add tool-specific result fields, but it must always include this evidence object so critic and DoD checks can consume coding activity without understanding every individual tool schema.

## Result Envelope

Every coding tool returns the same top-level result envelope through the existing NDJSON stream shape:

```json
{
  "type": "tool_result",
  "toolId": "coding_run_tests",
  "data": {
    "ok": false,
    "evidence": {
      "kind": "test",
      "summary": "pnpm typecheck failed with 2 TypeScript errors in packages/harness/src/example.ts.",
      "artifacts": [],
      "riskTier": "medium",
      "status": "failed",
      "sourceTool": "coding_run_tests",
      "startedAtMs": 1777464000000,
      "completedAtMs": 1777464002123,
      "durationMs": 2123
    },
    "result": {}
  }
}
```

Envelope fields:

| Field      | Required | Description                                                               |
| ---------- | -------- | ------------------------------------------------------------------------- |
| `ok`       | Yes      | `true` when the requested operation completed successfully                |
| `evidence` | Yes      | Shared `CodingEvidenceSchema` instance                                    |
| `result`   | Yes      | Tool-specific structured payload; use `{}` when no extra data is required |
| `message`  | No       | Human-readable failure or denial message safe to display to the user      |
| `error`    | No       | Machine-readable error object for failed or denied calls                  |

`ok: false` is used for both failed and denied operations. Callers distinguish those states through `evidence.status` and optional `error.code`.

## Error Shape

Coding tool errors follow the API error convention while staying inside `tool_result.data`:

```ts
export const CodingToolErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.unknown().optional(),
});
```

Reserved error codes:

| Code                      | Applies to | Meaning                                             |
| ------------------------- | ---------- | --------------------------------------------------- |
| `PATH_OUTSIDE_WORKSPACE`  | All        | Input path failed PathJail or repo-bound checks     |
| `COMMAND_NOT_ALLOWLISTED` | Test       | Requested test/build profile is not permitted       |
| `OUTPUT_TRUNCATED`        | All        | Output exceeded inline limits; artifact has details |
| `PATCH_DOES_NOT_APPLY`    | Edit       | Patch failed clean application                      |
| `PATCH_CONFLICT`          | Edit       | Patch conflicts with current file contents          |
| `GIT_NOT_REPOSITORY`      | Git        | Workspace is not inside a Git repository            |
| `SEARCH_PATTERN_REJECTED` | Search     | Pattern exceeded length or safety constraints       |
| `TOOL_DENIED_BY_POLICY`   | All        | Policy or approval layer denied execution           |
| `TOOL_TIMEOUT`            | Test       | Command exceeded configured timeout                 |

## Structured Edit Contract

### Input

```ts
export const CodingPatchOperationSchema = z.object({
  path: z.string().min(1),
  oldText: z.string().optional(),
  newText: z.string(),
});

export const CodingApplyPatchInputSchema = z.object({
  operations: z.array(CodingPatchOperationSchema).min(1),
  reason: z.string().min(1),
  dryRun: z.boolean().default(false),
});
```

Rules:

- `path` is workspace-relative and must pass PathJail.
- Absolute paths, traversal, symlink escape, and writes outside the repository are denied.
- `oldText` means replace this exact text; omitted `oldText` means create or append according to implementation task rules.
- The tool must emit a diff artifact for successful changes and for dry-run previews.
- The tool must not stage, commit, push, install dependencies, or run formatters as side effects.

### Result

```ts
export const CodingApplyPatchResultSchema = z.object({
  dryRun: z.boolean(),
  changedFiles: z.array(z.string()),
  createdFiles: z.array(z.string()).default([]),
  deletedFiles: z.array(z.string()).default([]),
  diffStat: z
    .object({
      filesChanged: z.number().int().min(0),
      insertions: z.number().int().min(0),
      deletions: z.number().int().min(0),
    })
    .optional(),
});
```

Evidence requirements:

- `kind`: `edit`
- `riskTier`: `medium`
- Required artifact: `diff`
- Summary includes file count and whether the run was a dry run.

## Git Inspection Contracts

Git tools are read-only and low risk. They must never change refs, the index, remotes, hooks, config, or working tree state.

### `coding_git_status`

```ts
export const CodingGitStatusInputSchema = z.object({
  includeIgnored: z.boolean().default(false),
  maxFiles: z.number().int().min(1).max(1000).default(200),
});

export const CodingGitStatusResultSchema = z.object({
  branch: z.string().optional(),
  upstream: z.string().optional(),
  ahead: z.number().int().min(0).default(0),
  behind: z.number().int().min(0).default(0),
  clean: z.boolean(),
  files: z.array(
    z.object({
      path: z.string(),
      indexStatus: z.string(),
      worktreeStatus: z.string(),
      renamedFrom: z.string().optional(),
    }),
  ),
  truncated: z.boolean().default(false),
});
```

### `coding_git_diff`

```ts
export const CodingGitDiffInputSchema = z.object({
  paths: z.array(z.string()).default([]),
  staged: z.boolean().default(false),
  baseRef: z.string().optional(),
  maxBytes: z.number().int().min(1).max(200000).default(60000),
});

export const CodingGitDiffResultSchema = z.object({
  paths: z.array(z.string()),
  staged: z.boolean(),
  baseRef: z.string().optional(),
  diffStat: z.object({
    filesChanged: z.number().int().min(0),
    insertions: z.number().int().min(0),
    deletions: z.number().int().min(0),
  }),
  truncated: z.boolean().default(false),
});
```

### `coding_git_log`

```ts
export const CodingGitLogInputSchema = z.object({
  maxCommits: z.number().int().min(1).max(100).default(20),
  paths: z.array(z.string()).default([]),
});

export const CodingGitLogResultSchema = z.object({
  commits: z.array(
    z.object({
      sha: z.string().min(7),
      authorName: z.string(),
      authorEmail: z.string().optional(),
      committedAt: z.string(),
      subject: z.string(),
    }),
  ),
  truncated: z.boolean().default(false),
});
```

Evidence requirements:

- `kind`: `git`
- `riskTier`: `low`
- Artifact kinds: `file_list` for status/log summaries; `diff` for diffs
- Summary includes branch/ref context and truncation state.

## Governed Test Runner Contract

The test runner executes allowlisted project commands, not arbitrary shell strings.

### Input

```ts
export const CodingTestProfileSchema = z.enum([
  'typecheck',
  'lint',
  'format_check',
  'unit',
  'e2e',
  'docs_lint',
  'build',
]);

export const CodingRunTestsInputSchema = z.object({
  profile: CodingTestProfileSchema,
  packageName: z
    .string()
    .regex(/^(@agent-platform\/[a-z0-9-]+|(?:apps|packages)\/[a-z0-9-]+)$/)
    .optional(),
  path: z.string().optional(),
  timeoutMs: z.number().int().min(1000).max(600000).optional(),
});
```

Profile mapping for this repo:

| Profile        | Command family                                               |
| -------------- | ------------------------------------------------------------ |
| `typecheck`    | `pnpm typecheck`                                             |
| `lint`         | `pnpm lint`                                                  |
| `format_check` | `pnpm format:check`                                          |
| `unit`         | `pnpm test` or `pnpm --filter <packageName> run test -- ...` |
| `e2e`          | `pnpm test:e2e`                                              |
| `docs_lint`    | `pnpm docs:lint`                                             |
| `build`        | `pnpm build`                                                 |

The implementation may support repo-specific profile configuration later, but task `.5` must start with a hardcoded allowlist matching this table.

### Result

```ts
export const CodingRunTestsResultSchema = z.object({
  profile: CodingTestProfileSchema,
  command: z.array(z.string()),
  exitCode: z.number().int().nullable(),
  timedOut: z.boolean().default(false),
  stdoutPreview: z.string().default(''),
  stderrPreview: z.string().default(''),
  failures: z.array(
    z.object({
      file: z.string().optional(),
      line: z.number().int().min(1).optional(),
      title: z.string().optional(),
      message: z.string(),
    }),
  ),
});
```

Evidence requirements:

- `kind`: `test`
- `riskTier`: `medium`
- Required artifacts: `stdout` and `stderr` when non-empty
- Required artifact on failure: `failure_summary`
- Summary includes profile, exit code or timeout, and top failure count.

## Repository Map Contract

### Input

```ts
export const CodingRepoMapInputSchema = z.object({
  repoPath: z.string().min(1).default('.'),
  maxDepth: z.number().int().positive().max(10).default(4),
  maxFiles: z.number().int().positive().max(1000).default(200),
});
```

### Result

```ts
export const CodingRepoMapResultSchema = z.object({
  repoPath: z.string(),
  totalFiles: z.number().int().min(0),
  totalDirectories: z.number().int().min(0),
  files: z.array(
    z.object({
      path: z.string(),
      kind: z.enum(['file', 'directory']),
      sizeBytes: z.number().int().min(0).optional(),
    }),
  ),
  packageBoundaries: z.array(
    z.object({
      path: z.string(),
      name: z.string().optional(),
      kind: z.enum(['app', 'package', 'workspace', 'unknown']),
    }),
  ),
  testDirectories: z.array(z.string()),
  ignoredDirectories: z.array(z.string()),
  truncated: z.boolean(),
});
```

Evidence requirements:

- `kind`: `repo_map`
- `riskTier`: `low`
- Required artifact: `repo_map`
- Summary includes entry count, depth, language/package-manager signals, and truncation state.

## Code Search Contract

### Input

```ts
export const CodingCodeSearchInputSchema = z.object({
  repoPath: z.string().min(1).default('.'),
  query: z.string().min(1).max(500),
  regex: z.boolean().default(false),
  caseSensitive: z.boolean().default(false),
  maxResults: z.number().int().positive().max(200).default(50),
  maxFileBytes: z.number().int().positive().max(1000000).default(250000),
});
```

### Result

```ts
export const CodingCodeSearchResultSchema = z.object({
  repoPath: z.string(),
  query: z.string(),
  regex: z.boolean(),
  matches: z.array(
    z.object({
      path: z.string(),
      line: z.number().int().positive(),
      column: z.number().int().positive(),
      snippet: z.string(),
    }),
  ),
  searchedFiles: z.number().int().min(0),
  truncated: z.boolean(),
});
```

## Related Test Discovery Contract

### Input

```ts
export const CodingFindRelatedTestsInputSchema = z.object({
  repoPath: z.string().min(1).default('.'),
  path: z.string().min(1),
  maxResults: z.number().int().positive().max(100).default(20),
});
```

### Result

```ts
export const CodingFindRelatedTestsResultSchema = z.object({
  repoPath: z.string(),
  path: z.string(),
  tests: z.array(
    z.object({
      path: z.string(),
      reason: z.string(),
    }),
  ),
  searchedFiles: z.number().int().min(0),
  truncated: z.boolean(),
});
```

Evidence requirements:

- `kind`: `search`
- `riskTier`: `low`
- Required artifact: `search_matches`
- Summary includes pattern mode, match count, and truncation state.

## Audit Events

Coding tools use the existing `tool_executions` audit table and status vocabulary from `ToolExecutionStatusSchema`: `pending`, `success`, `error`, and `denied`.

Each tool call should create exactly one audit record for non-zero-risk tools. Low and medium coding tools are auditable because the evidence is valuable for DoD and user review.

| Tool outcome      | Audit status | Evidence status | Required audit fields                                      |
| ----------------- | ------------ | --------------- | ---------------------------------------------------------- |
| Started           | `pending`    | Not emitted     | `toolName`, `agentId`, `sessionId`, `argsJson`, `riskTier` |
| Completed         | `success`    | `succeeded`     | `resultJson`, `completedAtMs`, `durationMs`                |
| Runtime failure   | `error`      | `failed`        | `resultJson.error`, `completedAtMs`, `durationMs`          |
| Policy denial     | `denied`     | `denied`        | Denial reason in `resultJson.error`                        |
| Approval required | `pending`    | Not emitted     | Approval request ID when HITL pauses execution             |

`argsJson` and `resultJson` must follow existing redaction rules. Never write secret values, environment variables with secret-like keys, API keys, tokens, encrypted values, or decrypted secret material into audit rows or evidence artifacts.

## Output Truncation And Artifact Storage

Inline tool results are for model and UI consumption, not unbounded logs. Implementations must preserve small previews inline and move larger payloads to artifacts.

Default limits:

| Payload                      | Inline limit | Storage rule                                                   |
| ---------------------------- | ------------ | -------------------------------------------------------------- |
| `stdout` / `stderr`          | 60 KiB each  | Larger output becomes `stdout` / `stderr` artifact             |
| Diff text                    | 100 KiB      | Larger diff becomes `diff` artifact                            |
| Search matches               | 200 matches  | Larger result sets set `truncated: true`                       |
| Repository map               | 500 entries  | Larger maps set `truncated: true` and include omitted count    |
| Failure summary              | 100 failures | Larger failure lists set `truncated: true`                     |
| `tool_result.data.result`    | 128 KiB      | Large payloads must be summarized and linked through artifacts |
| `tool_executions.resultJson` | 256 KiB      | Store summary envelope only; keep large artifacts out of DB    |

Artifact storage modes:

- `inline`: Small content included directly in `CodingArtifactSchema.content`.
- `workspace_file`: Large artifacts written under a managed workspace path such as `scratch/tool-artifacts/<run-id>/...`.
- `database`: Small audit-oriented summaries stored inside `tool_executions.resultJson`.

Every non-inline artifact must include `uri`, `sizeBytes`, and `sha256`. Workspace artifact URIs are workspace-relative and must be downloadable only through existing workspace file safety checks.

## Critic And DoD Evidence Consumption

Critic and DoD checks should treat `CodingEvidenceSchema` as the normalized source of coding work performed during a session.

Consumption rules:

- For edits, critic/DoD should verify `status: succeeded`, changed file list, and diff artifact presence before accepting claims that code changed.
- For tests, critic/DoD should use `profile`, `exitCode`, `timedOut`, and failure artifacts to decide whether quality gates passed.
- For git inspection, critic/DoD should use `coding_git_status` evidence to identify uncommitted changes and branch state.
- For search and repo map, critic/DoD should treat evidence as supporting context, not proof that implementation or verification occurred.
- Denied evidence is useful context and must not be counted as completed work.

Recommended future `DodContractSchema` extension:

```ts
export const DodContractSchema = z.object({
  criteria: z.array(z.string()).min(1),
  evidence: z.array(z.string()),
  structuredEvidence: z.array(CodingEvidenceSchema).default([]),
  passed: z.boolean(),
  failedCriteria: z.array(z.string()).default([]),
});
```

Until that extension is implemented, the harness can convert each coding evidence object into a compact evidence string:

```text
coding_run_tests(test, failed, medium): pnpm typecheck failed with 2 TypeScript errors in packages/harness/src/example.ts.
```

## Migration Impact

Implementation tasks should make these changes in order:

1. Add coding schemas to `packages/contracts` and export them from `packages/contracts/src/index.ts`.
2. Add unit tests that parse valid and invalid examples for every input/result/evidence schema.
3. Add harness tool implementations one task at a time, always returning the shared result envelope.
4. Extend audit logging only where current `tool_executions` fields cannot represent coding evidence summaries.
5. Add UI rendering for coding evidence after all tool kinds exist.

No database migration is required for the initial implementation if large artifacts are stored as workspace files and `resultJson` stores only the summary envelope. A future migration can add a dedicated `tool_artifacts` table if artifact lifecycle, retention, or cross-session querying becomes necessary.
