## Implementation Plan: Risk-Managed Tool Set with Human in the Loop

Yes — human in the loop (HITL) was mentioned in the context of the Vercel AI SDK's `needsApproval` flag, and it's a first-class pattern worth designing properly. Let me give you a full implementation plan.

---

### The Core Principle

```
ZERO risk     → execute automatically, no logging required
LOW risk      → execute automatically, lightweight logging
MEDIUM risk   → execute automatically, full audit log
HIGH risk     → pause, notify human, wait for approval
CRITICAL risk → never execute, always refuse
```

---

### Phase 1: Foundation — Risk Infrastructure

**Deliverables:**

- Risk tier enum and constants
- Tool registry schema with risk metadata
- Constraint definitions per tool

**Schema additions:**

```sql
ALTER TABLE tools ADD COLUMN risk_tier TEXT DEFAULT 'medium';
ALTER TABLE tools ADD COLUMN constraints TEXT;     -- JSON
ALTER TABLE tools ADD COLUMN requires_approval BOOLEAN DEFAULT false;
ALTER TABLE tools ADD COLUMN audit_log BOOLEAN DEFAULT true;

CREATE TABLE tool_executions (
  id              TEXT PRIMARY KEY,
  tool_name       TEXT NOT NULL,
  agent_id        TEXT NOT NULL,
  session_id      TEXT,
  task_id         TEXT,              -- if from scheduled task

  args            TEXT NOT NULL,     -- JSON — what was requested
  result          TEXT,              -- JSON — what was returned
  risk_tier       TEXT NOT NULL,

  status          TEXT NOT NULL,     -- 'approved' | 'rejected' |
                                     -- 'auto_executed' | 'pending_approval'
  approved_by     TEXT,              -- user ID if human approved
  approved_at     DATETIME,
  rejection_reason TEXT,

  started_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at    DATETIME,
  duration_ms     INTEGER
);

CREATE TABLE approval_requests (
  id              TEXT PRIMARY KEY,
  execution_id    TEXT REFERENCES tool_executions(id),
  agent_id        TEXT NOT NULL,
  tool_name       TEXT NOT NULL,
  args            TEXT NOT NULL,     -- shown to human

  context         TEXT,              -- what was the agent trying to do
  risk_reason     TEXT,              -- why this needs approval

  status          TEXT DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
  expires_at      DATETIME,               -- auto-reject after timeout

  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at     DATETIME,
  resolved_by     TEXT
);
```

---

### Phase 2: Tool Handlers — Zero and Low Risk

These are fully automated — implement and register with no approval gate.

**Effort: 1-2 days**

```typescript
// src/tools/handlers/zero-risk.ts
export const ZERO_RISK_HANDLERS: Record<string, ToolHandler> = {
  // Identity and generation
  generate_uuid: () => ({
    uuid: crypto.randomUUID(),
  }),

  get_current_time: ({ timezone = 'UTC' }) => ({
    iso: new Date().toISOString(),
    unix: Math.floor(Date.now() / 1000),
    local: new Date().toLocaleString('en-GB', { timeZone: timezone }),
    timezone,
  }),

  // JSON
  json_parse: ({ text }) => {
    try {
      return { result: JSON.parse(text), error: null };
    } catch (e: any) {
      return { result: null, error: e.message };
    }
  },

  json_stringify: ({ value, pretty = false }) => ({
    result: pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value),
  }),

  json_transform: ({ data, path }) => {
    // Simple dot-notation path extraction
    // e.g. path: "users.0.name"
    const result = path.split('.').reduce((obj: any, key: string) => obj?.[key], data);
    return { result };
  },

  // CSV
  csv_parse: ({ text, delimiter = ',' }) => {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(delimiter).map((h) => h.trim());
    const rows = lines.slice(1).map((line) => {
      const values = line.split(delimiter);
      return headers.reduce((obj: any, header, i) => {
        obj[header] = values[i]?.trim() ?? '';
        return obj;
      }, {});
    });
    return { headers, rows, count: rows.length };
  },

  csv_stringify: ({ rows, headers }) => {
    const cols = headers ?? Object.keys(rows[0] ?? {});
    const lines = [cols.join(','), ...rows.map((r: any) => cols.map((c) => r[c] ?? '').join(','))];
    return { result: lines.join('\n') };
  },

  // Text operations
  regex_match: ({ text, pattern, flags = '' }) => {
    const regex = new RegExp(pattern, flags);
    const matches = text.match(regex);
    return { matches: matches ?? [], found: !!matches };
  },

  regex_replace: ({ text, pattern, replacement, flags = 'g' }) => ({
    result: text.replace(new RegExp(pattern, flags), replacement),
  }),

  diff_text: ({ textA, textB }) => {
    const linesA = textA.split('\n');
    const linesB = textB.split('\n');
    const added = linesB.filter((l) => !linesA.includes(l));
    const removed = linesA.filter((l) => !linesB.includes(l));
    return { added, removed, unchanged: linesA.filter((l) => linesB.includes(l)) };
  },

  chunk_text: ({ text, maxChunkSize = 2000, overlap = 100 }) => {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      chunks.push(text.slice(start, start + maxChunkSize));
      start += maxChunkSize - overlap;
    }
    return { chunks, count: chunks.length };
  },

  count_tokens: ({ text }) => ({
    estimate: Math.ceil(text.length / 4),
    characters: text.length,
    words: text.split(/\s+/).length,
  }),

  template_render: ({ template, variables }) => {
    const result = template.replace(
      /\{\{(\w+)\}\}/g,
      (_: string, key: string) => variables[key] ?? `{{${key}}}`,
    );
    return { result };
  },

  // Encoding
  base64_encode: ({ text }) => ({
    result: Buffer.from(text).toString('base64'),
  }),

  base64_decode: ({ encoded }) => ({
    result: Buffer.from(encoded, 'base64').toString('utf-8'),
  }),

  hash_string: ({ input, algorithm = 'sha256' }) => ({
    hash: crypto.createHash(algorithm).update(input).digest('hex'),
    algorithm,
  }),

  url_encode: ({ text }) => ({ result: encodeURIComponent(text) }),
  url_decode: ({ text }) => ({ result: decodeURIComponent(text) }),

  // Date
  format_date: ({ timestamp, format, timezone = 'UTC' }) => ({
    result: new Date(timestamp).toLocaleString('en-GB', { timeZone: timezone }),
  }),

  date_diff: ({ dateA, dateB, unit = 'days' }) => {
    const diff = Math.abs(new Date(dateB).getTime() - new Date(dateA).getTime());
    const units: Record<string, number> = {
      ms: 1,
      seconds: 1000,
      minutes: 60000,
      hours: 3600000,
      days: 86400000,
    };
    return { diff: Math.floor(diff / (units[unit] ?? 86400000)), unit };
  },

  extract_urls: ({ text }) => ({
    urls: text.match(/https?:\/\/[^\s]+/g) ?? [],
  }),

  extract_emails: ({ text }) => ({
    emails: text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [],
  }),
};
```

```typescript
// src/tools/handlers/low-risk.ts
export const LOW_RISK_HANDLERS: Record<string, ToolHandler> = {
  file_exists: async ({ path: filePath }) => ({
    exists: await fs
      .access(filePath)
      .then(() => true)
      .catch(() => false),
  }),

  file_info: async ({ path: filePath }) => {
    const stat = await fs.stat(filePath);
    return {
      size: stat.size,
      sizeKb: Math.round(stat.size / 1024),
      modified: stat.mtime.toISOString(),
      created: stat.birthtime.toISOString(),
      isDirectory: stat.isDirectory(),
      isFile: stat.isFile(),
    };
  },

  list_directory: async ({ path: dirPath, recursive = false }) => {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return {
      entries: entries.map((e) => ({
        name: e.name,
        type: e.isDirectory() ? 'directory' : 'file',
        path: path.join(dirPath, e.name),
      })),
      count: entries.length,
    };
  },

  find_files: async ({ directory, pattern, maxResults = 50 }) => {
    const glob = await import('glob');
    const files = await glob.glob(pattern, {
      cwd: directory,
      absolute: true,
      maxDepth: 5,
    });
    return { files: files.slice(0, maxResults), count: files.length };
  },

  read_file: async ({ path: filePath, encoding = 'utf-8' }) => {
    const content = await fs.readFile(filePath, encoding as BufferEncoding);
    return { content, size: content.length };
  },

  get_env: ({ name }) => {
    // Only expose non-sensitive env vars
    const BLOCKED = ['KEY', 'SECRET', 'PASSWORD', 'TOKEN', 'CREDENTIAL'];
    const isBlocked = BLOCKED.some((b) => name.toUpperCase().includes(b));
    if (isBlocked) return { error: `Environment variable "${name}" is restricted` };
    return { value: process.env[name] ?? null, exists: !!process.env[name] };
  },

  get_system_info: async () => {
    const os = await import('os');
    return {
      platform: os.platform(),
      cpuCount: os.cpus().length,
      totalMemMb: Math.round(os.totalmem() / 1024 / 1024),
      freeMemMb: Math.round(os.freemem() / 1024 / 1024),
      uptimeHours: Math.round(os.uptime() / 3600),
      nodeVersion: process.version,
    };
  },

  which_command: async ({ command }) => {
    try {
      const { stdout } = await execAsync(`which ${command}`);
      return { found: true, path: stdout.trim() };
    } catch {
      return { found: false, path: null };
    }
  },

  get_working_dir: () => ({ path: process.cwd() }),

  check_url: async ({ url, timeoutMs = 5000 }) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return {
        reachable: true,
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
      };
    } catch (err: any) {
      return { reachable: false, error: err.message };
    }
  },

  extract_pdf_text: async ({ path: filePath }) => {
    const pdfParse = await import('pdf-parse');
    const buffer = await fs.readFile(filePath);
    const data = await pdfParse.default(buffer);
    return {
      text: data.text,
      pages: data.numpages,
      info: data.info,
    };
  },
};
```

---

### Phase 3: Medium Risk Handlers with Constraints

Auto-executed but with path and URL constraints enforced by the harness:

```typescript
// src/tools/middleware/constraints.ts

const WORKSPACE_ROOT = '/app/workspace';

function assertSafePath(filePath: string): void {
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(WORKSPACE_ROOT)) {
    throw new Error(
      `Path "${filePath}" is outside workspace. ` +
        `All file operations must be within ${WORKSPACE_ROOT}`,
    );
  }
}

function assertSafeUrl(url: string): void {
  const parsed = new URL(url);
  const BLOCKED_HOSTS = [
    '169.254.169.254', // AWS metadata
    'metadata.google.internal',
    '127.0.0.1',
    'localhost',
  ];
  if (BLOCKED_HOSTS.some((h) => parsed.hostname.includes(h))) {
    throw new Error(`URL host "${parsed.hostname}" is blocked`);
  }
}

export const MEDIUM_RISK_HANDLERS: Record<string, ToolHandler> = {
  write_file: async ({ path: filePath, content, encoding = 'utf-8' }) => {
    assertSafePath(filePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, encoding as BufferEncoding);
    return { success: true, path: filePath, bytesWritten: content.length };
  },

  append_file: async ({ path: filePath, content }) => {
    assertSafePath(filePath);
    await fs.appendFile(filePath, content, 'utf-8');
    return { success: true, path: filePath };
  },

  copy_file: async ({ source, destination }) => {
    assertSafePath(source);
    assertSafePath(destination);
    await fs.copyFile(source, destination);
    return { success: true, source, destination };
  },

  create_directory: async ({ path: dirPath }) => {
    assertSafePath(dirPath);
    await fs.mkdir(dirPath, { recursive: true });
    return { success: true, path: dirPath };
  },

  http_request: async ({ url, method = 'GET', headers = {}, body }) => {
    assertSafeUrl(url);
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    return {
      status: response.status,
      ok: response.ok,
      body: text,
      headers: Object.fromEntries(response.headers.entries()),
    };
  },

  download_file: async ({ url, destination }) => {
    assertSafeUrl(url);
    assertSafePath(destination);
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    await fs.writeFile(destination, Buffer.from(buffer));
    return {
      success: true,
      path: destination,
      sizeBytes: buffer.byteLength,
    };
  },
};
```

---

### Phase 4: Human in the Loop for High Risk

This is the most important phase. High risk tools pause execution and wait for human approval before proceeding.

**The HITL Flow:**

```
Agent requests delete_file({ path: '/app/workspace/config.json' })
        │
        ▼
Harness intercepts — HIGH risk detected
        │
        ▼
Creates approval_request record
        │
        ▼
Sends notification to user (Telegram/Slack/FE)
        │
        ├── User approves → tool executes → result returned to agent
        │
        └── User rejects → error returned to agent → agent adapts
```

**The Approval Gate:**

```typescript
// src/tools/middleware/hitl.ts

class HumanInTheLoop {
  async requestApproval(
    toolName: string,
    args: Record<string, unknown>,
    context: TurnContext,
  ): Promise<ApprovalResult> {
    const requestId = uuid();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min timeout

    // Build human-readable explanation
    const explanation = this.explainToolCall(toolName, args);

    // Store pending request
    await db.run(
      `INSERT INTO approval_requests
       (id, execution_id, agent_id, tool_name, args, context, risk_reason, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        requestId,
        context.executionId,
        context.agentId,
        toolName,
        JSON.stringify(args),
        context.currentGoal,
        explanation,
        expiresAt.toISOString(),
      ],
    );

    // Notify the user via their configured channel
    await this.notifyUser(context.userId, {
      requestId,
      toolName,
      explanation,
      args,
      expiresAt,
    });

    // Wait for response — poll with timeout
    return this.waitForApproval(requestId, expiresAt);
  }

  private async waitForApproval(requestId: string, expiresAt: Date): Promise<ApprovalResult> {
    while (new Date() < expiresAt) {
      await sleep(3000); // poll every 3 seconds

      const request = await db.get(`SELECT * FROM approval_requests WHERE id = ?`, [requestId]);

      if (request.status === 'approved') {
        return { approved: true, approvedBy: request.resolved_by };
      }

      if (request.status === 'rejected') {
        return {
          approved: false,
          reason: request.rejection_reason ?? 'Rejected by user',
        };
      }
    }

    // Timed out — auto-reject
    await db.run(
      `UPDATE approval_requests SET status = 'rejected',
       rejection_reason = 'Approval timed out after 30 minutes'
       WHERE id = ?`,
      [requestId],
    );

    return { approved: false, reason: 'Approval request timed out' };
  }

  private explainToolCall(toolName: string, args: Record<string, unknown>): string {
    const explanations: Record<string, (a: any) => string> = {
      delete_file: (a) => `Delete file: ${a.path}`,
      move_file: (a) => `Move "${a.source}" → "${a.destination}"`,
      bash: (a) => `Execute command: ${a.command}`,
      kill_process: (a) => `Kill process PID: ${a.pid}`,
    };
    return explanations[toolName]?.(args) ?? `Execute ${toolName} with ${JSON.stringify(args)}`;
  }

  private async notifyUser(userId: string, request: ApprovalNotification): Promise<void> {
    const message = `
⚠️ *Approval Required*

Your agent wants to perform a high-risk action:

*Action:* ${request.explanation}
*Tool:* \`${request.toolName}\`

*Approve:* /approve_${request.requestId.slice(0, 8)}
*Reject:*  /reject_${request.requestId.slice(0, 8)}

_Expires in 30 minutes_
    `.trim();

    // Send via user's configured notification channel
    await notificationService.send(userId, message);
  }
}
```

**Notification UI in Frontend:**

```
┌─────────────────────────────────────────────────┐
│ ⚠️  Approval Required                           │
│                                                  │
│ Agent: Dev Assistant                             │
│ Action: Delete file /app/workspace/old-config    │
│                                                  │
│ Context: "Cleaning up deprecated config files   │
│  as part of the weekly maintenance task"         │
│                                                  │
│ Expires in: 28 minutes                           │
│                                                  │
│ [✓ Approve]  [✗ Reject]  [View Full Args]       │
└─────────────────────────────────────────────────┘
```

---

### Phase 5: The Central Dispatcher

All tool calls route through a single dispatcher that applies the right policy:

```typescript
// src/tools/dispatcher.ts

async function dispatchTool(
  toolName: string,
  args: Record<string, unknown>,
  context: TurnContext,
): Promise<string> {
  const tool = await getToolDefinition(toolName);

  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  // Log the attempt
  const executionId = await logToolExecution(toolName, args, context);

  try {
    let result: unknown;

    switch (tool.riskTier) {
      case ToolRisk.ZERO:
      case ToolRisk.LOW:
        // Auto-execute — no logging overhead for zero risk
        result = await executeHandler(toolName, args);
        break;

      case ToolRisk.MEDIUM:
        // Auto-execute with constraint validation
        validateConstraints(toolName, args);
        result = await executeHandler(toolName, args);
        await logExecution(executionId, 'auto_executed', result);
        break;

      case ToolRisk.HIGH:
        // Pause and request human approval
        const approval = await hitl.requestApproval(toolName, args, context);

        if (!approval.approved) {
          await logExecution(executionId, 'rejected', null, approval.reason);
          return JSON.stringify({
            error: 'Action rejected',
            reason: approval.reason,
            toolName,
          });
        }

        // Approved — execute
        validateConstraints(toolName, args);
        result = await executeHandler(toolName, args);
        await logExecution(executionId, 'approved', result, null, approval.approvedBy);
        break;

      case ToolRisk.CRITICAL:
        await logExecution(executionId, 'blocked', null, 'Critical risk — never executed');
        throw new Error(`Tool "${toolName}" is classified as critical risk and cannot be executed`);
    }

    return JSON.stringify(result);
  } catch (err: any) {
    await logExecution(executionId, 'failed', null, err.message);
    throw err;
  }
}
```

---

### Full Phase Plan

```
Phase 1 — Foundation               Week 1
├── Risk tier enum + constants
├── DB schema (tool_executions, approval_requests)
└── Central dispatcher skeleton

Phase 2 — Zero + Low Risk          Week 1-2
├── All zero risk handlers (~20)
├── All low risk handlers (~10)
└── Register + test each

Phase 3 — Medium Risk              Week 2
├── Write/append/copy file handlers
├── HTTP + download handlers
├── Path constraint enforcement
└── URL blocklist enforcement

Phase 4 — HITL Infrastructure      Week 2-3
├── Approval request creation
├── Polling + timeout mechanism
├── Telegram/Slack notification
└── FE approval UI

Phase 5 — High Risk Handlers       Week 3
├── bash (with allowlist)
├── delete_file (with HITL)
├── move_file (with HITL)
└── kill_process (with HITL)

Phase 6 — Audit + Observability    Week 3-4
├── Execution log queries for FE
├── Risk report dashboard
├── Alert on repeated rejections
└── Middleware hooks
```

---

### Summary

| Risk Tier | Examples                | Execution | Notification  | Audit               |
| --------- | ----------------------- | --------- | ------------- | ------------------- |
| ZERO      | json_parse, uuid, dates | Immediate | None          | None                |
| LOW       | read_file, list_dir     | Immediate | None          | Lightweight         |
| MEDIUM    | write_file, http        | Immediate | None          | Full log            |
| HIGH      | bash, delete, kill      | Paused    | User notified | Full log + approval |
| CRITICAL  | rm -rf /, system32      | Never     | N/A           | Blocked log         |

The key insight is that **most agent work is zero and low risk** — data transformation, file reading, lookups. High risk actions are rare and deliberate. Designing the system so the common path is frictionless while the dangerous path has a human gate gives you both speed and safety.
