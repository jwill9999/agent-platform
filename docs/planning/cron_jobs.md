## Agents as Cron Jobs: Scheduled Agentic Tasks

Yes — and it's one of the most powerful patterns in agent systems. Instead of a human triggering a turn, a **scheduler** triggers it with a predefined goal.

---

### The Core Concept

```
Traditional cron job                 Agent cron job
────────────────────                 ──────────────────────────────
Runs a fixed script                  Runs an agent with a goal
Deterministic output                 Adaptive, uses tools
No reasoning                         Can handle unexpected situations
Brittle if conditions change         Resilient — figures it out
```

A scheduled agent turn is just a regular agent turn with no human on the other end — the "message" is your scheduled prompt.

---

### What This Looks Like in Your Harness

```typescript
interface ScheduledTask {
  id: string;
  agentId: string;
  name: string;
  prompt: string; // the goal injected as the user message
  schedule: string; // cron expression
  timezone: string;
  enabled: boolean;

  // What to do with the output
  outputChannel?: string; // 'telegram' | 'slack' | 'webhook' | 'db'
  outputConfig?: Record<string, unknown>;

  lastRunAt?: Date;
  lastStatus?: 'success' | 'failed' | 'running';
  createdAt: Date;
}
```

---

### Database Schema

```sql
CREATE TABLE scheduled_tasks (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL,
  name            TEXT NOT NULL,
  prompt          TEXT NOT NULL,      -- the goal/instruction
  schedule        TEXT NOT NULL,      -- cron expression e.g. "0 9 * * 1-5"
  timezone        TEXT DEFAULT 'UTC',
  enabled         BOOLEAN DEFAULT true,

  output_channel  TEXT,               -- where to send results
  output_config   TEXT,               -- JSON

  last_run_at     DATETIME,
  last_status     TEXT,
  last_output     TEXT,               -- last result for debugging

  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE scheduled_task_runs (
  id              TEXT PRIMARY KEY,
  task_id         TEXT REFERENCES scheduled_tasks(id),
  started_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at    DATETIME,
  status          TEXT,               -- 'running' | 'success' | 'failed'
  output          TEXT,               -- full agent response
  error           TEXT,               -- if failed
  tool_calls      INTEGER DEFAULT 0   -- how many tools were used
);
```

---

### The Scheduler Service

Use `node-cron` — zero dependencies, runs inside your Docker container, no external service needed:

```typescript
// npm i node-cron
import cron from 'node-cron';

class TaskScheduler {
  private jobs = new Map<string, cron.ScheduledTask>();

  async boot(): Promise<void> {
    const tasks = await db.all(`SELECT * FROM scheduled_tasks WHERE enabled = true`);

    for (const task of tasks) {
      this.register(task);
    }

    console.log(`[Scheduler] Loaded ${tasks.length} scheduled tasks`);
  }

  register(task: ScheduledTask): void {
    // Cancel existing job if re-registering
    this.jobs.get(task.id)?.stop();

    const job = cron.schedule(task.schedule, () => this.runTask(task.id), {
      timezone: task.timezone,
      scheduled: true,
    });

    this.jobs.set(task.id, job);
    console.log(`[Scheduler] Registered: "${task.name}" (${task.schedule})`);
  }

  async unregister(taskId: string): Promise<void> {
    this.jobs.get(taskId)?.stop();
    this.jobs.delete(taskId);
  }

  // Called by FE when user creates/edits a task
  async reload(taskId: string): Promise<void> {
    const task = await db.get(`SELECT * FROM scheduled_tasks WHERE id = ?`, [taskId]);
    if (task?.enabled) {
      this.register(task);
    } else {
      this.unregister(taskId);
    }
  }
}
```

---

### Running the Agent Turn

```typescript
async function runTask(taskId: string): Promise<void> {
  const task = await db.get(`SELECT * FROM scheduled_tasks WHERE id = ?`, [taskId]);

  // Create a run record
  const runId = uuid();
  await db.run(
    `INSERT INTO scheduled_task_runs (id, task_id, status)
     VALUES (?, ?, 'running')`,
    [runId, taskId],
  );

  await db.run(
    `UPDATE scheduled_tasks SET last_run_at = CURRENT_TIMESTAMP,
     last_status = 'running' WHERE id = ?`,
    [taskId],
  );

  try {
    // Standard agent turn — same as any user message
    const output = await harness.runAgentTurn(
      task.agentId,
      `scheduled_task:${taskId}`, // synthetic userId
      task.prompt, // the goal IS the message
    );

    // Deliver output to configured channel
    await deliverOutput(task, output);

    // Record success
    await db.run(
      `UPDATE scheduled_task_runs 
       SET status = 'success', completed_at = CURRENT_TIMESTAMP, output = ?
       WHERE id = ?`,
      [output, runId],
    );

    await db.run(
      `UPDATE scheduled_tasks SET last_status = 'success', last_output = ?
       WHERE id = ?`,
      [output, taskId],
    );
  } catch (err: any) {
    await db.run(
      `UPDATE scheduled_task_runs
       SET status = 'failed', completed_at = CURRENT_TIMESTAMP, error = ?
       WHERE id = ?`,
      [err.message, runId],
    );

    await db.run(`UPDATE scheduled_tasks SET last_status = 'failed' WHERE id = ?`, [taskId]);

    console.error(`[Scheduler] Task "${task.name}" failed:`, err.message);
  }
}
```

---

### Output Delivery

The agent produces a result — where does it go?

```typescript
async function deliverOutput(task: ScheduledTask, output: string): Promise<void> {
  if (!task.outputChannel) return; // fire and forget — just log it

  switch (task.outputChannel) {
    case 'telegram': {
      const config = task.outputConfig as { chatId: string; connectionId: string };
      await sendTelegramMessage(config.connectionId, config.chatId, output);
      break;
    }

    case 'slack': {
      const config = task.outputConfig as { channel: string; connectionId: string };
      await sendSlackMessage(config.connectionId, config.channel, output);
      break;
    }

    case 'webhook': {
      const config = task.outputConfig as { url: string; secret?: string };
      await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.secret && { 'X-Webhook-Secret': config.secret }),
        },
        body: JSON.stringify({ taskId: task.id, output, timestamp: new Date() }),
      });
      break;
    }

    case 'email': {
      const config = task.outputConfig as { to: string; subject: string };
      await sendEmail(config.to, config.subject, output);
      break;
    }
  }
}
```

---

### Real-World Task Examples

This is where it gets compelling. These are prompts your users could configure:

```typescript
const EXAMPLE_TASKS = [
  {
    name: 'Morning standup summary',
    schedule: '0 8 * * 1-5', // 8am weekdays
    prompt: `Check our GitHub repos for any PRs opened or merged 
               in the last 24 hours. Check open issues labelled 
               "urgent". Summarise in bullet points for standup.`,
    output: 'slack:#standup',
  },
  {
    name: 'Dependency security check',
    schedule: '0 9 * * 1', // Monday 9am
    prompt: `Run npm audit in /app/workspace. If any high or 
               critical vulnerabilities are found, create a GitHub 
               issue with the details and suggested fixes.`,
    output: 'telegram',
  },
  {
    name: 'Disk usage monitor',
    schedule: '0 */6 * * *', // every 6 hours
    prompt: `Check disk usage on the system. If any partition is 
               above 80% capacity, alert me with details of the 
               largest directories.`,
    output: 'telegram',
  },
  {
    name: 'Weekly changelog',
    schedule: '0 17 * * 5', // Friday 5pm
    prompt: `Look at git log for the past week across all repos. 
               Generate a human-readable changelog grouped by 
               feature area. Post to the #releases Slack channel.`,
    output: 'slack:#releases',
  },
  {
    name: 'API health check',
    schedule: '*/15 * * * *', // every 15 minutes
    prompt: `Make a GET request to https://api.myapp.com/health. 
               If the response is not 200 or takes more than 2 
               seconds, send an alert immediately.`,
    output: 'telegram',
  },
];
```

---

### Frontend Task Configuration

```
Scheduled Tasks
├── [+ New Task]
│
├── Morning Standup    ✓ enabled    Last run: 08:00  ✓ success
│   "0 8 * * 1-5"     → Slack:#standup
│   [Edit] [Run Now] [Disable] [History]
│
├── Security Check     ✓ enabled    Last run: Mon 09:00  ✓ success
│   "0 9 * * 1"        → Telegram
│   [Edit] [Run Now] [Disable] [History]
│
└── API Monitor        ✗ disabled
    "*/15 * * * *"     → Telegram
    [Edit] [Enable] [History]

Create Task
├── Name:      [ Morning Standup                    ]
├── Agent:     [ Dev Assistant              ▾       ]
├── Schedule:  [ 0 8 * * 1-5               ]
│              [Mon ✓][Tue ✓][Wed ✓][Thu ✓][Fri ✓]
│              Time: [08:00] Timezone: [Europe/London ▾]
├── Goal:
│   ┌────────────────────────────────────────────┐
│   │ Check GitHub for PRs merged in last 24hrs  │
│   │ and summarise for standup...               │
│   └────────────────────────────────────────────┘
├── Deliver output to: [Slack       ▾]
│   Channel: [ #standup             ]
│
└── [Test Run]  [Save]
```

The **Test Run** button is critical UX — triggers an immediate run outside the schedule so the user can verify it works before saving.

---

### Docker Wiring

The scheduler boots alongside your harness — no separate container needed:

```typescript
// main.ts
async function bootstrap() {
  await db.migrate();
  await seedSystemTools();
  await syncSkillRegistry();

  // Start scheduler alongside the API
  const scheduler = new TaskScheduler();
  await scheduler.boot();

  // HTTP server for webhooks + FE API
  await startHttpServer();

  console.log('[Harness] Ready');
}

bootstrap();
```

---

### Summary

| Concern              | Solution                                         |
| -------------------- | ------------------------------------------------ |
| Scheduler library    | `node-cron` — zero infra, runs in Docker         |
| Task storage         | SQLite `scheduled_tasks` table                   |
| Run history          | `scheduled_task_runs` table                      |
| Agent execution      | Same `runAgentTurn()` as any user message        |
| Output delivery      | Channel adapter — Telegram, Slack, webhook       |
| Dynamic registration | `scheduler.reload()` called when FE saves a task |
| No external service  | Entirely self-contained in your container        |

The key insight is there's no special "agent cron mode" — a scheduled task is just a regular agent turn where the scheduler is the user. Every skill, tool, MCP server, memory and lesson the agent has is available exactly as it would be in a live conversation.
