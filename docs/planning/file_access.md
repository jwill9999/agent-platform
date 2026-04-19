# File path restrictions

## Yes — But Only If You Enforce It

Right now in your harness it is **not restricted by default**. The `assertSafePath` constraint in Phase 3 only applies to medium risk write operations. Read operations and bash have no path restriction unless you explicitly add them.

This needs to be fixed. Path restriction should be a **harness-level concern**, not a per-handler concern.

---

### The Problem With the Current Approach

```typescript
// What you have in medium risk handlers
const WORKSPACE_ROOT = '/app/workspace';

function assertSafePath(filePath: string): void {
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(WORKSPACE_ROOT)) {
    throw new Error(`Path outside workspace`);
  }
}

// Problems:
// 1. Only called in write_file, not read_file
// 2. Not called in bash at all
// 3. Every new handler must remember to call it
// 4. One missed call = full filesystem access
```

This is defence-in-depth done wrong — it relies on every developer remembering to add the check.

---

### Path Jail: Enforce at the Dispatcher Level

The constraint should live in **one place** and apply to **every tool call automatically**:

```typescript
// src/tools/security/path-jail.ts

export class PathJail {
  private allowedRoots: string[];

  constructor(roots: string[]) {
    this.allowedRoots = roots.map((r) => path.resolve(r));
  }

  // Call this once on every tool invocation
  // before the handler ever runs
  validate(args: Record<string, unknown>): void {
    const pathArgs = this.extractPathArgs(args);

    for (const [argName, filePath] of pathArgs) {
      const resolved = path.resolve(filePath);
      const allowed = this.allowedRoots.some((root) => resolved.startsWith(root));

      if (!allowed) {
        throw new PathJailError(
          `Argument "${argName}" with path "${filePath}" ` +
            `resolves to "${resolved}" which is outside ` +
            `allowed roots: ${this.allowedRoots.join(', ')}`,
        );
      }
    }
  }

  // Automatically detect path-like arguments by name
  private extractPathArgs(args: Record<string, unknown>): Array<[string, string]> {
    const PATH_ARG_NAMES = [
      'path',
      'filePath',
      'file_path',
      'source',
      'destination',
      'directory',
      'dir',
      'target',
      'output',
      'input',
      'from',
      'to',
      'src',
      'dest',
      'location',
      'file',
    ];

    return Object.entries(args).filter(
      ([key, value]) =>
        PATH_ARG_NAMES.includes(key) &&
        typeof value === 'string' &&
        (value.startsWith('/') || value.startsWith('.')),
    ) as Array<[string, string]>;
  }
}

export class PathJailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PathJailError';
  }
}
```

---

### Mount Points: Explicit and Intentional

Define exactly what paths the agent is allowed to touch, with different permissions per mount:

```typescript
// src/tools/security/mounts.ts

export enum MountPermission {
  READ_ONLY = 'read_only', // can read, never write
  READ_WRITE = 'read_write', // full access within this path
  WRITE_ONLY = 'write_only', // can write/create, not read (e.g. output only)
}

export interface Mount {
  name: string; // human label
  path: string; // absolute path
  permission: MountPermission;
  description: string; // shown in FE and agent context
}

// Configured per agent or globally
export const DEFAULT_MOUNTS: Mount[] = [
  {
    name: 'workspace',
    path: '/app/workspace',
    permission: MountPermission.READ_WRITE,
    description: 'Agent working directory — full read/write',
  },
  {
    name: 'skills',
    path: '/app/skills',
    permission: MountPermission.READ_ONLY,
    description: 'Skill definitions — read only',
  },
  {
    name: 'uploads',
    path: '/app/uploads',
    permission: MountPermission.READ_ONLY,
    description: 'User uploaded files — read only',
  },
  {
    name: 'output',
    path: '/app/output',
    permission: MountPermission.READ_WRITE,
    description: 'Generated output files',
  },
];

// Paths that are always blocked regardless of mounts
export const ALWAYS_BLOCKED: string[] = [
  '/etc',
  '/root',
  '/home',
  '/var',
  '/usr',
  '/bin',
  '/sbin',
  '/sys',
  '/proc',
  '/dev',
  '/boot',
];
```

---

### Enhanced Path Jail With Permissions

```typescript
export class PathJail {
  constructor(private mounts: Mount[]) {}

  validate(args: Record<string, unknown>, operation: 'read' | 'write' | 'execute'): void {
    const pathArgs = this.extractPathArgs(args);

    for (const [argName, filePath] of pathArgs) {
      const resolved = path.resolve(filePath);

      // Hard block — never accessible
      const isHardBlocked = ALWAYS_BLOCKED.some((blocked) => resolved.startsWith(blocked));

      if (isHardBlocked) {
        throw new PathJailError(
          `Path "${resolved}" is in a system directory ` + `and can never be accessed by agents`,
        );
      }

      // Find matching mount
      const mount = this.mounts.find((m) => resolved.startsWith(path.resolve(m.path)));

      if (!mount) {
        throw new PathJailError(
          `Path "${resolved}" is not within any configured mount. ` +
            `Allowed mounts: ${this.mounts.map((m) => m.path).join(', ')}`,
        );
      }

      // Check permission for operation
      if (operation === 'write' && mount.permission === MountPermission.READ_ONLY) {
        throw new PathJailError(
          `Mount "${mount.name}" (${mount.path}) is read-only. ` + `Cannot write to "${resolved}"`,
        );
      }

      if (operation === 'read' && mount.permission === MountPermission.WRITE_ONLY) {
        throw new PathJailError(
          `Mount "${mount.name}" (${mount.path}) is write-only. ` +
            `Cannot read from "${resolved}"`,
        );
      }
    }
  }
}
```

---

### Wired Into the Dispatcher

Path validation runs on **every single tool call** before the handler:

```typescript
// src/tools/dispatcher.ts

const pathJail = new PathJail(DEFAULT_MOUNTS);

// Map tools to their operation type
const TOOL_OPERATIONS: Record<string, 'read' | 'write' | 'execute'> = {
  read_file: 'read',
  list_directory: 'read',
  find_files: 'read',
  file_exists: 'read',
  file_info: 'read',
  extract_pdf_text: 'read',

  write_file: 'write',
  append_file: 'write',
  copy_file: 'write', // validates both source and destination
  create_directory: 'write',
  download_file: 'write',
  delete_file: 'write',
  move_file: 'write',

  bash: 'execute', // special handling
};

async function dispatchTool(
  toolName: string,
  args: Record<string, unknown>,
  context: TurnContext,
): Promise<string> {
  const operation = TOOL_OPERATIONS[toolName];

  // Validate paths BEFORE any risk-tier check
  if (operation) {
    try {
      pathJail.validate(args, operation);
    } catch (err) {
      if (err instanceof PathJailError) {
        // Log the attempt — path violations are security events
        await logSecurityEvent('path_jail_violation', toolName, args, context);
        return JSON.stringify({
          error: 'Path access denied',
          reason: err.message,
        });
      }
      throw err;
    }
  }

  // Continue with risk-tier dispatch...
  // risk check, HITL if needed, execute handler
}
```

---

### Bash Is a Special Case

Bash can access any path via string interpolation — the path jail can't catch:

```bash
cat /etc/passwd                    # direct path
cd /etc && cat passwd              # navigation then access
EVIL=/etc && cat ${EVIL}/passwd    # variable interpolation
```

For bash you need an additional layer — **command allowlist + argument scanning**:

```typescript
async function validateBashCommand(command: string): Promise<void> {
  // 1. Allowlisted command prefixes
  const ALLOWED_PREFIXES = [
    'gh ',
    'git ',
    'npm ',
    'npx ',
    'node ',
    'pnpm ',
    'ls ',
    'cat ',
    'echo ',
    'grep ',
    'find ',
    'wc ',
    'head ',
    'tail ',
    'sort ',
    'uniq ',
    'mkdir ',
    'touch ',
    'cp ',
    'mv ',
    'pwd',
    'which ',
    'env',
  ];

  const isAllowed = ALLOWED_PREFIXES.some((prefix) => command.trim().startsWith(prefix));

  if (!isAllowed) {
    throw new Error(`Command "${command.split(' ')[0]}" is not in the allowed list`);
  }

  // 2. Block dangerous patterns
  const BLOCKED_PATTERNS = [
    /rm\s+-rf/, // recursive delete
    />\s*\/(?!app\/workspace)/, // redirect outside workspace
    /\|\s*sh/, // pipe to shell
    /curl.+\|\s*(bash|sh)/, // curl pipe execute
    /wget.+\|\s*(bash|sh)/,
    /\/etc\//, // system config
    /\/root\//, // root home
    /\/home\//, // user homes
    /sudo/, // privilege escalation
    /chmod\s+[0-7]*7/, // making things executable
  ];

  const blocked = BLOCKED_PATTERNS.find((p) => p.test(command));
  if (blocked) {
    throw new Error(`Command contains blocked pattern: ${blocked}`);
  }

  // 3. Check any explicit paths in command are within workspace
  const pathsInCommand = command.match(/\/[^\s;|&]+/g) ?? [];
  for (const p of pathsInCommand) {
    const resolved = path.resolve(p);
    if (!resolved.startsWith('/app/workspace')) {
      throw new Error(`Command references path "${p}" outside workspace`);
    }
  }
}
```

---

### Per-Agent Mount Configuration

Different agents can have different file access:

```sql
CREATE TABLE agent_mounts (
  agent_id    TEXT NOT NULL,
  name        TEXT NOT NULL,
  path        TEXT NOT NULL,
  permission  TEXT NOT NULL,
  PRIMARY KEY (agent_id, name)
);
```

```typescript
async function getAgentPathJail(agentId: string): Promise<PathJail> {
  const mounts = await db.all(`SELECT * FROM agent_mounts WHERE agent_id = ?`, [agentId]);

  // Fall back to defaults if no agent-specific mounts
  return new PathJail(mounts.length > 0 ? mounts : DEFAULT_MOUNTS);
}
```

A coding agent might have access to `/app/repos`. A billing agent might only have access to `/app/bills`. They never overlap.

---

### What the Agent Sees

Include mount information in the system prompt so the agent knows what it can access:

```typescript
function buildMountContext(mounts: Mount[]): string {
  return `
## File System Access
You have access to the following paths only:

${mounts.map((m) => `- **${m.name}** (\`${m.path}\`) — ${m.description} [${m.permission}]`).join('\n')}

All other paths are inaccessible. Do not attempt to access system directories.
  `.trim();
}
```

---

### Summary

| Layer                  | What it protects      | Where it lives         |
| ---------------------- | --------------------- | ---------------------- |
| ALWAYS_BLOCKED list    | System dirs — hard no | PathJail, pre-dispatch |
| Mount definitions      | Scope per agent       | PathJail, pre-dispatch |
| Permission per mount   | Read vs write         | PathJail, pre-dispatch |
| Bash command allowlist | Shell execution       | Bash handler           |
| Bash path scanning     | Paths in commands     | Bash handler           |
| Per-agent mounts       | Agent isolation       | DB + PathJail init     |

The critical principle: **path restriction is not the handler's job**. It runs once at the dispatcher level before any handler is called. No handler can accidentally bypass it. No new handler can forget to add it.
