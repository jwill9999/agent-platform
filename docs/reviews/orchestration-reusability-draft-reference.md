# Future orchestration reuse — draft discussion reference

## Status and provenance

Owner-supplied analysis saved on 26 September 2026 for future reference, after the orchestration
implementation is stable. The supplied text is preserved below verbatim. It is discussion material,
not an approved design, implementation plan, package/API contract or verified capability assessment.
Commands, configuration, package names, interfaces and readiness output are illustrative only.
In particular, the suggested Node version and rapid onboarding estimate are not project requirements
or measured results. A successful environment check alone would not establish autonomous readiness.

## Concepts to revisit later

- An installable package and repository onboarding command, with project-local configuration.
- A reusable orchestration core separated from Agent Platform policies and integrations.
- Provider-neutral execution adapters and optional future remote-agent transport.
- CLI and programmatic access, with service/event-streaming interfaces as later possibilities.
- Explicit readiness diagnostics and portable verification of the complete workflow.

Review the architectural boundary and operational guarantees before selecting packaging or APIs.
Stable local execution, recovery, permissions and existing acceptance gates take precedence.
These options do not change existing features, epics, tasks, priorities or the current pilot sequence.
Joint review is required before any option is carried forward; no package publication or refactor is
being authorized by retaining this reference.

Related context: [orchestration field evaluation](orchestration-field-evaluation.md),
[agent handoff/latency research](orchestration-handoff-gap-reference.md), and
[harness gap/reuse references](../planning/harness-modernization/agent-harness-article-reference.md).

## Original supplied analysis

Yes. For what you're trying to achieve, an **installable npm package with an `init` command is a good distribution model**, but I would package the SDLC orchestration system as more than a conventional library.

The important distinction is that another project shouldn't have to know the internals of `ContinuationJournal`, leases, callbacks, phase jobs, etc. It should consume a **development orchestration product** with a small public interface.

### What I would aim for

Something like:

```bash
npm install -D @your-scope/dev-orchestrator

npx dev-orchestrator init
```

`init` would inspect the target repository and generate project-local configuration rather than copying the orchestration implementation into the project:

```text
my-project/
├── .orchestrator/
│   ├── config.yaml
│   ├── agents/
│   │   ├── planner.yaml
│   │   ├── implementer.yaml
│   │   ├── reviewer.yaml
│   │   └── tester.yaml
│   ├── policies/
│   │   └── development.yaml
│   └── workflows/
│       └── feature-delivery.yaml
│
├── package.json
└── src/
```

The package owns the machinery:

```text
@your-scope/dev-orchestrator
        │
        ├── workflow engine
        ├── continuation supervisor
        ├── phase runtime
        ├── state machine
        ├── event system
        ├── agent launcher
        ├── recovery
        ├── persistence
        └── CLI
```

while the consuming repository owns only its configuration.

### `init` should do quite a lot

I wouldn't make it simply copy some TOML files.

I'd make:

```bash
npx dev-orchestrator init
```

perform repository discovery:

```text
Detect
  │
  ├── package manager
  ├── languages
  ├── framework
  ├── monorepo structure
  ├── test framework
  ├── lint/typecheck commands
  ├── Git provider
  ├── CI provider
  └── repository conventions
```

Then propose/generated configuration such as:

```yaml
project:
  name: payments-service

commands:
  install: pnpm install
  test: pnpm test
  typecheck: pnpm typecheck
  lint: pnpm lint
  build: pnpm build

workflow:
  feature:
    - plan
    - critique
    - implement
    - verify
    - review
    - integrate

agents:
  implementation:
    role: implementation_worker

  review:
    role: code_reviewer

  testing:
    role: test_runner
```

That makes onboarding another repository potentially a one-minute operation.

## I'd separate it into packages

Rather than one enormous package, I would structure the source something like:

```text
packages/

  orchestration-core
      state machine
      task model
      callbacks
      continuations
      events
      contracts

  orchestration-runtime
      scheduler
      worker processes
      recovery
      persistence

  orchestration-agents
      Codex adapter
      Claude adapter
      etc.

  orchestration-git
      branches
      worktrees
      commits
      PR lifecycle

  orchestration-ci
      GitHub Actions
      checks

  orchestration-cli
      init
      run
      status
      resume
      doctor
```

Then expose one convenient CLI package:

```bash
npx @your-scope/orchestrator init
```

Most users never need to know about the lower-level packages.

That modularisation will also help us avoid accidentally coupling the reusable system to **Agent Platform**.

### Configuration over code

This is probably the most important design principle for reuse.

A new repository shouldn't have to write:

```ts
const worker = new ContinuationWorker(...)
const journal = new ContinuationJournal(...)
const phase = new PhaseJobJournal(...)
```

It should say:

```yaml
workflow:
  feature-delivery:

    planning:
      agent: planner
      critic: plan-critic

    implementation:
      agent: implementation-worker
      maxAttempts: 3

    verification:
      agent: test-runner

    review:
      agent: code-reviewer

    delivery:
      target: pull-request
```

The runtime translates that into your durable orchestration machinery.

That gives you a reusable **SDLC orchestration engine**, rather than a reusable collection of classes.

## I would also expose a programmatic API

The CLI shouldn't be the only interface.

For example:

```ts
import { createOrchestrator } from "@your-scope/dev-orchestrator";

const orchestrator = await createOrchestrator({
  root: process.cwd()
});

await orchestrator.runFeature({
  objective: "Add OAuth authentication"
});
```

And perhaps:

```ts
orchestrator.on("agent.started", ...);
orchestrator.on("agent.completed", ...);
orchestrator.on("workflow.blocked", ...);
orchestrator.on("approval.required", ...);
```

That gives you three modes:

```text
CLI

npx orchestrator run feature


Library

import { createOrchestrator } ...


Service

orchestrator daemon
        ↓
REST / SSE / A2A
```

That third mode becomes interesting later.

## Don't bake Codex into the core

This is one change I'd make early.

The development orchestrator currently has quite a bit of Codex-specific thinking around agent execution. For reuse, I'd establish an interface such as:

```ts
interface AgentExecutor {
  start(request: AgentExecutionRequest): Promise<AgentHandle>;

  observe(handle: AgentHandle): Promise<AgentStatus>;

  cancel(handle: AgentHandle): Promise<void>;
}
```

Then:

```text
AgentExecutor
     │
     ├── CodexExecutor
     ├── ClaudeCodeExecutor
     ├── OpenAIExecutor
     ├── LocalModelExecutor
     └── A2AExecutor
```

Now your workflow doesn't care what actually performs the task.

And notice where A2A suddenly becomes useful:

```text
Workflow
   │
AgentExecutor
   │
   ├── local process
   ├── Codex
   ├── Claude
   └── A2A
        │
        ▼
    remote agent
```

That is a much cleaner use of A2A than making it your internal state machine.

## I'd also make `doctor` a first-class command

Because this system depends on quite a lot of infrastructure:

```bash
npx dev-orchestrator doctor
```

could verify:

```text
✓ Git repository
✓ Node 22
✓ pnpm
✓ test command
✓ build command
✓ Codex available
✓ agent definitions
✓ Docker available
✓ credentials
✓ writable orchestration state
✓ GitHub access
✓ CI integration

Ready for autonomous development.
```

That will make portability dramatically easier.

And then the lifecycle becomes pleasantly simple:

```text
                    npm package

                        │
                        ▼
               npm install / npx
                        │
                        ▼
                orchestrator init
                        │
                        ▼
                repository analysis
                        │
                        ▼
             generated configuration
                        │
                        ▼
                orchestrator doctor
                        │
                        ▼
                 workflow ready

              ┌─────────┴─────────┐
              ▼                   ▼
        Feature planning      Bug fixing
              │                   │
              └─────────┬─────────┘
                        ▼
                  Orchestrator
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
     Planner       Implementer       Reviewer
                        │
                      Tester
                        │
                        ▼
                   PR / delivery
```

So I think the agent you discussed this with was heading in the right direction. **npm is the distribution mechanism; `init` is the onboarding mechanism; configuration is the customisation mechanism; and `workflow-control` evolves into the reusable orchestration kernel.**

The architectural change I'd make before publishing it is to establish a hard boundary between **generic orchestration** and **Agent-Platform-specific SDLC policy/integrations**. If we get that boundary right, you could install this into an Angular project, Next.js application, Node backend—or potentially a non-JavaScript repository—without copying any of Agent Platform's implementation into it.
