# Lazy Skill Loading — Original Design Reference

> **Status: IMPLEMENTED** — This was the original design document that guided our implementation. The actual implementation differs in key ways (DB-driven instead of file-based, no frontmatter parsing, callback injection instead of direct DB access). For the implementation doc, see **[architecture/lazy-skill-loading.md](../architecture/lazy-skill-loading.md)**.

> **What changed:** Our platform stores skills in SQLite (not markdown files), so we skipped all file-parsing code (Steps 1–2, 8), adapted the schema extension (Step 7) to add `description` and `hint` as optional columns, and used a `skillResolver` callback pattern to keep the harness independent of the DB layer. The core concept — stubs in the system prompt, full body on demand, governor for loop detection — is preserved exactly.

---

## Overview

This document describes the **reference pattern** for lazy skill loading in an agent harness. The pattern keeps the model context window lean by injecting only skill stubs (name, description, hint) into the system prompt upfront. The model requests full skill instructions on demand via a dedicated `get_skill_detail` tool when it decides to use a skill.

### Why This Matters

Without lazy loading, every selected skill's full body is injected into the system prompt on every turn — regardless of whether the skill is used. At 5 skills × 400 tokens each, that is 2,000 tokens of overhead per turn. With lazy loading, stubs cost approximately 30 tokens each. Full bodies are only loaded when the model explicitly requests them.

```
Before                              After
──────────────────────────          ────────────────────────────
System prompt: ~2,700 tokens        System prompt: ~1,050 tokens
All 5 skill bodies always injected  Only stubs injected
No way to update skills mid-session Skills fetched fresh at load time
```

---

## Files to Create or Modify

```
src/
  tools/
    handlers/
      get-skill-detail.ts        ← CREATE
    system-tools.ts               ← MODIFY (register new tool)
  skills/
    stub-formatter.ts             ← CREATE
    skill-loader.ts               ← CREATE
    skill-parser.ts               ← MODIFY (parse stub vs body sections)
  harness/
    turn-runner.ts                ← MODIFY (inject stubs not bodies)
    dispatcher.ts                 ← MODIFY (route get_skill_detail)

skills/
  github-cli/
    skill.md                      ← MODIFY (add stub/instructions sections)
  web-research/
    skill.md                      ← MODIFY
  (all existing skill files)      ← MODIFY
```

---

## Step 1 — Update the skill.md File Format

Every skill file needs to be restructured to separate stub content from full instructions. The frontmatter defines the stub. The body is split into named sections.

### New skill.md Structure

```markdown
---
name: github-cli
description: Interact with GitHub repos, PRs, issues and actions via the gh CLI
hint: PR management, issue tracking, repo operations, CI/CD workflows
required_tools: [bash]
categories: [devops, code]
version: 1.2.0
---

## instructions

<!-- Full body — returned by get_skill_detail only -->

You have access to the GitHub CLI (`gh`) via the bash tool.

### Authentication

gh is pre-authenticated via GH_TOKEN. Never run `gh auth login` — it hangs.

### Key Commands

**Pull Requests:**

- List: `gh pr list --state open --json number,title,author,createdAt`
- View: `gh pr view <number> --json title,body,reviews,checks`
- Create: `gh pr create --title "..." --body "..." --base main`
- Merge: `gh pr merge <number> --squash`

**Issues:**

- List: `gh issue list --state open --json number,title,label`
- Create: `gh issue create --title "..." --body "..." --label bug`

**Repos:**

- View: `gh repo view --json name,description,defaultBranch`

### Rules

- Always use `--json` flag for machine-readable output
- Always specify explicit fields: `--json field1,field2`
- Add `--limit 20` for large result sets
- Check stderr when exitCode is 1 — often "not found" not a hard failure

## examples

<!-- Optional — appended to instructions when loaded -->

User: "List my open PRs"
Tool: bash({ command: "gh pr list --state open --json number,title,createdAt --limit 10" })

User: "Create an issue for the memory leak"
Tool: bash({ command: "gh issue create --title 'Memory leak in useEffect' --body '...' --label bug" })

## cautions

<!-- Optional — safety notes appended to instructions -->

Never run `gh repo delete` without explicit user confirmation.
Never force-push to main: `git push --force origin main`.
```

### Frontmatter Fields (Required for Stubs)

| Field            | Type     | Purpose                                                |
| ---------------- | -------- | ------------------------------------------------------ |
| `name`           | string   | Unique identifier — used as key for `get_skill_detail` |
| `description`    | string   | One sentence — what the skill does                     |
| `hint`           | string   | When to use it — keywords, trigger phrases             |
| `required_tools` | string[] | Tools this skill uses — model needs to know upfront    |
| `categories`     | string[] | For semantic filtering                                 |
| `version`        | string   | Track skill versions                                   |

---

## Step 2 — Update the Skill Parser

Modify the existing skill parser to extract sections separately.

### `src/skills/skill-parser.ts`

```typescript
import matter from 'gray-matter';
import fs from 'fs/promises';

export interface SkillFrontmatter {
  name: string;
  description: string;
  hint: string;
  required_tools: string[];
  categories?: string[];
  version?: string;
}

export interface ParsedSkill {
  frontmatter: SkillFrontmatter;
  instructions: string; // ## instructions section
  examples?: string; // ## examples section (optional)
  cautions?: string; // ## cautions section (optional)
  sourceFile: string;
}

export interface SkillStub {
  name: string;
  description: string;
  hint: string;
  requiredTools: string[];
}

// Parse a skill.md file into structured parts
export async function parseSkillFile(filePath: string): Promise<ParsedSkill> {
  const raw = await fs.readFile(filePath, 'utf-8');
  const { data, content } = matter(raw);

  const frontmatter = data as SkillFrontmatter;

  // Extract named sections from the markdown body
  const instructions = extractSection(content, 'instructions');
  const examples = extractSection(content, 'examples');
  const cautions = extractSection(content, 'cautions');

  if (!instructions) {
    throw new Error(`Skill file "${filePath}" is missing ## instructions section`);
  }

  return {
    frontmatter,
    instructions: instructions.trim(),
    examples: examples?.trim(),
    cautions: cautions?.trim(),
    sourceFile: filePath,
  };
}

// Extract content between ## sectionName and the next ## heading
function extractSection(content: string, sectionName: string): string | undefined {
  const regex = new RegExp(`##\\s+${sectionName}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, 'i');
  const match = content.match(regex);
  return match ? match[1] : undefined;
}

// Build a stub from a parsed skill — what goes in the system prompt
export function buildStub(skill: ParsedSkill): SkillStub {
  return {
    name: skill.frontmatter.name,
    description: skill.frontmatter.description,
    hint: skill.frontmatter.hint,
    requiredTools: skill.frontmatter.required_tools ?? [],
  };
}
```

---

## Step 3 — Create the Stub Formatter

Formats selected skill stubs for injection into the system prompt.

### `src/skills/stub-formatter.ts`

```typescript
import { SkillStub } from './skill-parser';

// Formats skill stubs for system prompt injection
// Target: ~30 tokens per skill, scannable at a glance
export function formatSkillStubs(stubs: SkillStub[]): string {
  if (stubs.length === 0) return '';

  const skillList = stubs
    .map(
      (s) =>
        `### ${s.name}
${s.description}
When to use: ${s.hint}
Requires tools: ${s.requiredTools.join(', ')}`,
    )
    .join('\n\n');

  return `
## Available Skills

The following skills are available to you this turn.
Call \`get_skill_detail\` with the skill name to load full 
instructions before using a skill for the first time.

${skillList}
  `.trim();
}

// Token estimate for a set of stubs
// Useful for context budget planning
export function estimateStubTokens(stubs: SkillStub[]): number {
  const text = formatSkillStubs(stubs);
  return Math.ceil(text.length / 4);
}
```

---

## Step 4 — Create the Skill Loader

Handles runtime fetching of full skill bodies from the database.

### `src/skills/skill-loader.ts`

```typescript
import { db } from '../db';
import { ParsedSkill } from './skill-parser';

// In-memory cache for loaded skills — prevents repeated DB hits
// within a process lifetime
const skillCache = new Map<string, { body: string; loadedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface SkillDetail {
  name: string;
  instructions: string;
  examples?: string;
  cautions?: string;
  version?: string;
}

// Load full skill detail for a given agent + skill name
// Called when model invokes get_skill_detail tool
export async function loadSkillDetail(
  agentId: string,
  skillName: string,
): Promise<SkillDetail | null> {
  // Check agent has this skill assigned
  const skill = await db.get(
    `SELECT s.name, s.instructions, s.examples, s.cautions, s.version
     FROM skills s
     JOIN agent_skills as_ ON as_.skill_id = s.id
     WHERE as_.agent_id = ? 
     AND s.name = ?
     AND as_.enabled = true`,
    [agentId, skillName],
  );

  if (!skill) return null;

  return {
    name: skill.name,
    instructions: skill.instructions,
    examples: skill.examples ?? undefined,
    cautions: skill.cautions ?? undefined,
    version: skill.version ?? undefined,
  };
}

// Build the full content returned to the model
// Combines instructions + optional examples and cautions
export function buildSkillDetailResponse(detail: SkillDetail): string {
  const parts = [detail.instructions];

  if (detail.examples) {
    parts.push(`\n## Examples\n${detail.examples}`);
  }

  if (detail.cautions) {
    parts.push(`\n## Cautions\n${detail.cautions}`);
  }

  return parts.join('\n');
}

// Get stub list for an agent — used at turn start
export async function getAgentSkillStubs(agentId: string) {
  return db.all(
    `SELECT s.name, s.description, s.hint, s.required_tools
     FROM skills s
     JOIN agent_skills as_ ON as_.skill_id = s.id
     WHERE as_.agent_id = ?
     AND as_.enabled = true
     ORDER BY as_.priority DESC, s.name ASC`,
    [agentId],
  );
}
```

---

## Step 5 — Create the get_skill_detail Tool Handler

### `src/tools/handlers/get-skill-detail.ts`

```typescript
import { loadSkillDetail, buildSkillDetailResponse } from '../../skills/skill-loader';
import { TurnContext } from '../../harness/turn-context';

export async function handleGetSkillDetail(
  args: { skill_name: string },
  context: TurnContext,
): Promise<string> {
  const { skill_name } = args;

  if (!skill_name || typeof skill_name !== 'string') {
    return JSON.stringify({
      error: 'skill_name is required and must be a string',
    });
  }

  const detail = await loadSkillDetail(context.agentId, skill_name);

  if (!detail) {
    // Return available skill names to help the model recover
    const available = context.availableSkillNames;
    return JSON.stringify({
      error: `Skill "${skill_name}" not found or not assigned to this agent`,
      available,
      suggestion: `Check spelling. Available skills: ${available.join(', ')}`,
    });
  }

  // Track which skills were loaded this turn (for governor + logging)
  context.loadedSkills.add(skill_name);
  context.log?.info({
    event: 'skill.loaded',
    skill: skill_name,
    version: detail.version,
    loadCount: context.loadedSkills.size,
  });

  const content = buildSkillDetailResponse(detail);

  return JSON.stringify({
    name: detail.name,
    instructions: content,
    loaded: true,
  });
}
```

---

## Step 6 — Register the Tool

Add `get_skill_detail` to your system tool catalogue. It is zero-risk — read-only, no side effects.

### In `src/tools/system-tools.ts`

```typescript
// Add to BUNDLED_SYSTEM_TOOLS array
{
  name:        'get_skill_detail',
  description: `Load full instructions for a skill before using it.
                Call this once per skill at the start of a conversation
                when you intend to use that skill.
                Always call this before invoking a skill's tools for
                the first time. Returns complete instructions, examples
                and any cautions relevant to the skill.`,
  tier:        'system',
  risk:        ToolRisk.ZERO,
  input_schema: {
    type: 'object',
    properties: {
      skill_name: {
        type:        'string',
        description: 'The exact name of the skill to load as listed in Available Skills'
      }
    },
    required: ['skill_name']
  },
  config: { handler: 'get_skill_detail' }
}
```

### In `src/tools/dispatcher.ts`

```typescript
// Add to TOOL_HANDLERS map
import { handleGetSkillDetail } from './handlers/get-skill-detail';

const TOOL_HANDLERS: Record<string, ToolHandler> = {
  // ... existing handlers
  get_skill_detail: (args, context) => handleGetSkillDetail(args as any, context),
};
```

---

## Step 7 — Update the Database Schema

The skills table needs separate columns for stub content vs full body.

```sql
-- Run as a migration
ALTER TABLE skills ADD COLUMN hint         TEXT;
ALTER TABLE skills ADD COLUMN instructions TEXT;   -- replaces 'body' for full content
ALTER TABLE skills ADD COLUMN examples     TEXT;
ALTER TABLE skills ADD COLUMN cautions     TEXT;

-- Migrate existing body content to instructions
UPDATE skills SET instructions = body WHERE instructions IS NULL;

-- Keep body column for backwards compat but instructions is now source of truth
```

---

## Step 8 — Update the Boot-Time Skill Registry Sync

The registry sync needs to populate the new columns when parsing skill files.

### In `src/skills/registry.ts`

```typescript
import { parseSkillFile, buildStub } from './skill-parser';
import { db } from '../db';
import fs from 'fs/promises';
import path from 'path';

export async function syncSkillRegistry(skillsDir: string): Promise<void> {
  const entries = await fs.readdir(skillsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillFile = path.join(skillsDir, entry.name, 'skill.md');

    try {
      await fs.access(skillFile);
    } catch {
      continue; // No skill.md in this directory
    }

    const parsed = await parseSkillFile(skillFile);
    const fm = parsed.frontmatter;

    await db.run(
      `INSERT INTO skills
         (name, description, hint, required_tools, categories,
          version, instructions, examples, cautions, source_file)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET
         description   = excluded.description,
         hint          = excluded.hint,
         required_tools = excluded.required_tools,
         categories    = excluded.categories,
         version       = excluded.version,
         instructions  = excluded.instructions,
         examples      = excluded.examples,
         cautions      = excluded.cautions,
         source_file   = excluded.source_file,
         updated_at    = CURRENT_TIMESTAMP`,
      [
        fm.name,
        fm.description,
        fm.hint,
        JSON.stringify(fm.required_tools ?? []),
        JSON.stringify(fm.categories ?? []),
        fm.version ?? '1.0.0',
        parsed.instructions,
        parsed.examples ?? null,
        parsed.cautions ?? null,
        skillFile,
      ],
    );

    console.log(`[Registry] Synced skill: ${fm.name}`);
  }
}
```

---

## Step 9 — Update the Turn Runner

The turn runner must now inject stubs instead of full skill bodies.

### In `src/harness/turn-runner.ts`

```typescript
import { getAgentSkillStubs } from '../skills/skill-loader';
import { formatSkillStubs } from '../skills/stub-formatter';

export async function buildSystemPrompt(
  agentId: string,
  message: string,
  context: TurnContext,
): Promise<string> {
  const [
    identity,
    baseline,
    lessons,
    sessionContext,
    skillStubs, // ← stubs only, not full bodies
  ] = await Promise.all([
    loadAgentIdentity(agentId),
    loadBaseline(agentId),
    retrieveRelevantLessons(agentId, message),
    loadSessionContext(agentId),
    getAgentSkillStubs(agentId), // ← replaces selectSkillsForMessage
  ]);

  // Store available skill names on context for get_skill_detail handler
  context.availableSkillNames = skillStubs.map((s) => s.name);

  // Format stubs — lean system prompt injection
  const skillsBlock = formatSkillStubs(skillStubs);

  return `
${identity}

${baseline}

${skillsBlock}

## Lessons Learned
${formatLessons(lessons)}

## Session Context
${sessionContext}
  `.trim();
}
```

---

## Step 10 — Add get_skill_detail to Every Agent Turn

`get_skill_detail` must always be in the tools array passed to the model — even when no other tools are included. It is the mechanism by which the model accesses skill instructions.

```typescript
// In your model call — get_skill_detail is always present
async function runAgentTurn(agentId: string, userId: string, message: string): Promise<string> {
  const systemPrompt = await buildSystemPrompt(agentId, message, context);

  // Resolve tools from skill dependencies AS BEFORE
  // but also always include get_skill_detail
  const skillTools = await resolveToolsFromSkills(agentId);
  const getSkillDetailTool = getToolDefinition('get_skill_detail');

  const allTools = [
    getSkillDetailTool, // ← always first — model should know it exists
    ...skillTools,
  ];

  // Run the agentic loop as normal
  return runToolLoop(systemPrompt, allTools, message, context);
}
```

---

## Step 11 — Update the Governor for Skill Load Tracking

Add skill load awareness to the `AgentGovernor` to detect loops where the model repeatedly loads the same skill.

```typescript
// In src/security/agent-governor.ts — add to existing class

private skillLoadCounts = new Map<string, number>();

trackSkillLoad(skillName: string): void {
  const count = (this.skillLoadCounts.get(skillName) ?? 0) + 1;
  this.skillLoadCounts.set(skillName, count);

  // Warn if same skill loaded more than twice in one session
  if (count > 2) {
    this.log?.warn({
      event:   'skill_load_loop',
      skill:   skillName,
      count,
      message: 'Skill loaded repeatedly — possible reasoning loop'
    });
  }

  // Hard limit — something is very wrong if a skill is loaded 5+ times
  if (count >= 5) {
    throw new AgentLimitError(
      `Skill "${skillName}" has been loaded ${count} times. ` +
      `This indicates a reasoning loop. Turn terminated.`
    );
  }
}

getSkillLoadSummary(): Record<string, number> {
  return Object.fromEntries(this.skillLoadCounts);
}
```

---

## Conversation Flow — What to Expect

Once implemented, a typical multi-skill turn looks like this in the conversation history:

```
[system]    Agent identity + skill stubs + session context

[user]      "Find the memory leak in our React app and create a GitHub issue"

[assistant] get_skill_detail("web-research")

[tool]      { name: "web-research", instructions: "You have access to web_search..." }

[assistant] get_skill_detail("github-cli")

[tool]      { name: "github-cli", instructions: "You have access to gh via bash..." }

[assistant] web_search({ query: "React useEffect memory leak patterns 2025" })

[tool]      { results: [...] }

[assistant] bash({ command: "gh issue create --title 'Memory leak: useEffect cleanup missing' ..." })

[tool]      { stdout: "https://github.com/org/repo/issues/42" }

[assistant] "Done. Created issue #42 with the memory leak analysis.
             The issue links to three relevant articles on cleanup patterns."
```

The two `get_skill_detail` calls at the start cost approximately 2 extra turns but save injecting ~800 tokens of skill bodies that were never going to be used anyway.

---

## Testing the Implementation

After wiring everything together, verify with these manual checks:

**Check 1 — Stubs are lean:**
Print the system prompt at the start of a turn. Each skill should appear as 3-4 lines, not a full block of instructions.

**Check 2 — Detail loads correctly:**
Trigger a turn that requires a specific skill. Check the conversation history in Langfuse — you should see a `get_skill_detail` call immediately before the first tool call of that skill.

**Check 3 — Unavailable skill is handled:**
Call `get_skill_detail` with an invalid skill name. The handler should return the error message and the list of available skills, not throw.

**Check 4 — Loop detection fires:**
Manually call `get_skill_detail` for the same skill 3+ times in one session. The governor should emit a warning log.

**Check 5 — Skills update live:**
Edit a `skill.md` instructions section. Trigger the registry sync. Start a new turn and call `get_skill_detail` for that skill — you should see the updated instructions without restarting the harness.

---

## Token Budget Comparison

For reference, here are approximate token counts before and after for a 5-skill agent:

| Component                           | Before (full bodies) | After (stubs + lazy load)        |
| ----------------------------------- | -------------------- | -------------------------------- |
| 5 skill bodies in system prompt     | ~2,000 tokens        | 0 tokens                         |
| 5 skill stubs in system prompt      | —                    | ~150 tokens                      |
| get_skill_detail call (per skill)   | —                    | ~20 tokens                       |
| Skill detail in turn history        | —                    | ~400 tokens (loaded skills only) |
| **Turn overhead for 2 skills used** | **~2,000 tokens**    | **~590 tokens**                  |
| **Saving**                          | —                    | **~1,410 tokens (~70%)**         |

The saving compounds across long sessions and agents with large skill libraries.

---

## Further Reference

The following conversations cover the design decisions behind this implementation:

- Skill selection and semantic retrieval — why skills are pre-filtered before stubs are built
- Tool loop and the `tool_use` / `tool_result` cycle — how `get_skill_detail` fits into the standard loop
- Agent governor — turn limits, token budgets and loop detection
- Langfuse tracing — how skill loads appear as spans in the observability dashboard
