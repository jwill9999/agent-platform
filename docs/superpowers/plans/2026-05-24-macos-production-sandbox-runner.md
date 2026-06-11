# macOS Production Sandbox Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move command execution from host/Docker development behavior to a packaged macOS production runner that executes `sys_bash` inside a managed local VM, with staging proving the same path that production will use.

**Architecture:** Keep the existing harness `CommandRunner` interface as the stable boundary, but make runner selection explicit and fail-closed for packaged desktop builds. Add a macOS production runner backed by Apple Virtualization.framework through a native helper process, then require packaged Electron E2E to execute real commands through that runner before `staging` can merge to `main`.

**Tech Stack:** Electron, Node.js/TypeScript, Swift, Apple Virtualization.framework, Linux guest image, Vitest, Electron/Playwright E2E, GitHub Actions/macOS runners.

---

## Current Position

The current `jwill9999/docker-sandbox-command-runner` branch is useful foundation work, but it is not the production sandbox solution.

Current behavior on that branch:

- `sys_bash` flows through `packages/harness/src/commandRunner.ts`.
- Docker sandbox mode can execute commands inside a Docker container.
- Desktop currently defaults to `AGENT_PLATFORM_COMMAND_RUNNER=auto`.
- `auto` falls back to host execution when the Docker binary is missing.

Production concern:

- End users should not need to install Docker, configure daemons, or run developer tooling.
- Staging must test production-ready behavior, not local developer fallbacks.
- `main` represents production-ready code, so staging cannot pass by accidentally exercising host mode.

Target production rule:

```text
Packaged macOS app:
  sys_bash -> policy/approval/path jail -> macOS VM runner -> Linux guest command

No VM available:
  command execution fails closed with a clear user-visible status

Developer override:
  host or Docker runner only when explicitly configured for local development
```

## Environment Model

The sandbox runner must be built and tested against three explicit environments. The same
environment names should appear in code, docs, CI configuration, and release checklists.

| Environment | Purpose                                                | Runner Policy                                                                                                                                                                | Evidence Required                                                                                                                        |
| ----------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Local       | Developer productivity while building the app.         | Host and Docker runners may be enabled only by explicit developer configuration. macOS VM runner should be available as early as possible for production-path development.   | Unit tests, adapter tests, Swift helper tests, and optional local VM smoke tests.                                                        |
| Staging     | Production rehearsal and release candidate validation. | Must use the packaged macOS app with `macos-vm`, or command execution must be explicitly disabled for that release. Host and Docker fallback are not valid staging evidence. | Packaged Electron E2E, runner health proving `macos-vm`, VM command execution proof, fail-closed unavailable proof, full quality gates.  |
| Production  | Released app used by end users.                        | Must use the packaged macOS app with the managed VM runner. Missing or unhealthy runner fails closed with a clear user-visible status.                                       | Release artifact signing/notarization, packaged runner startup, manual release smoke, and staging evidence from the same artifact shape. |

Configuration rules:

- Local may use `.env.local`, shell environment overrides, or explicit developer settings.
- Staging must use production-like environment variables committed to CI/release configuration, with
  secrets supplied through the staging secret store.
- Production must use the same variable names and defaults as staging, with production secrets and
  production artifact signing.
- A setting that changes runner safety must be visible in runner health output and test assertions.
- `AGENT_PLATFORM_COMMAND_RUNNER=host` and `AGENT_PLATFORM_COMMAND_RUNNER=docker-sandbox` are
  development modes. They are not acceptable for staging-to-main approval.

Production-readiness principles:

- Store configuration in environment-specific settings rather than code branches.
- Keep dev/staging/production as similar as possible; staging should differ only in credentials,
  artifact identity, and endpoints required for test safety.
- Fail closed when a production dependency such as the VM helper, VM image, secure storage, or
  runner health check is unavailable.
- Emit logs and health states that explain whether failures are policy denials, runner
  unavailability, VM boot failures, command failures, or packaging/signing problems.
- Treat packaged Electron E2E as the release gate for desktop runtime behavior; dev Electron and
  Docker checks are useful but insufficient for production promotion.

## File Structure

Create or modify these files during the plan:

- `packages/harness/src/commandRunner.ts`  
  Owns the runner interface, runner mode types, result mapping, and configured runner factory.

- `packages/harness/src/commandRunnerHealth.ts`  
  New focused module for runner health/status types and helpers.

- `packages/harness/test/commandRunner.test.ts`  
  Unit tests for runner mode selection and fail-closed behavior.

- `packages/harness/test/commandRunnerHealth.test.ts`  
  Unit tests for health/status normalization.

- `apps/desktop/src/main/backendSupervisor.ts`  
  Injects production runner configuration into the managed backend.

- `apps/desktop/test/backendSupervisor.test.ts`  
  Tests packaged/staging environment defaults.

- `apps/desktop/src/main/macosVmRunner.ts`  
  Node-side adapter that invokes the native macOS VM helper.

- `apps/desktop/test/macosVmRunner.test.ts`  
  Tests command construction, health parsing, and error mapping for the helper adapter.

- `apps/desktop/native/macos-vm-runner/Package.swift`  
  Swift package for the native VM helper.

- `apps/desktop/native/macos-vm-runner/Sources/MacosVmRunner/main.swift`  
  Swift CLI entry point for `status`, `prepare`, `start`, `stop`, and `exec`.

- `apps/desktop/native/macos-vm-runner/Tests/MacosVmRunnerTests/MacosVmRunnerTests.swift`  
  Swift unit tests for CLI parsing and JSON output.

- `apps/desktop/e2e/command-sandbox.e2e.ts`  
  Packaged-app E2E proving `sys_bash` executes inside the VM runner and fails closed when unavailable.

- `docs/desktop-runtime.md`  
  Documents production, staging, and development runner behavior.

- `docs/testing/command-sandbox-regression-suite.md`  
  Defines the release gate for command sandbox testing.

- `docs/adr/0003-macos-production-sandbox-runner.md`  
  Records the decision to use Apple Virtualization.framework for the first production runner.

- `.github/workflows/staging.yml` or the existing staging workflow file  
  Adds macOS packaged sandbox checks before staging can be considered production-ready.

## Stage 1: Correct Current PR Semantics

This stage prevents the existing Docker adapter from being mistaken for the production sandbox.

### Task 1: Remove Production Host Fallback From Desktop Defaults

**Files:**

- Modify: `apps/desktop/src/main/backendSupervisor.ts`
- Modify: `apps/desktop/test/backendSupervisor.test.ts`
- Modify: `docs/desktop-runtime.md`

- [ ] **Step 1: Write failing backend environment test**

In `apps/desktop/test/backendSupervisor.test.ts`, update the managed backend environment expectation so packaged desktop defaults to a fail-closed runner mode:

```ts
expect(env.AGENT_PLATFORM_COMMAND_RUNNER).toBe('disabled');
```

Expected failure:

```text
Expected: "disabled"
Received: "auto"
```

- [ ] **Step 2: Run the focused test**

Run:

```bash
pnpm --filter @agent-platform/desktop test -- test/backendSupervisor.test.ts
```

Expected: FAIL because desktop still injects `auto`.

- [ ] **Step 3: Change the desktop default**

In `apps/desktop/src/main/backendSupervisor.ts`, set the managed backend default to disabled until the production VM runner exists:

```ts
AGENT_PLATFORM_COMMAND_RUNNER: env.AGENT_PLATFORM_COMMAND_RUNNER ?? 'disabled',
```

This preserves explicit developer overrides while preventing accidental production host fallback.

- [ ] **Step 4: Extend runner mode types**

In `packages/harness/src/commandRunner.ts`, update the mode type:

```ts
export type CommandRunnerMode = 'disabled' | 'host' | 'docker-sandbox' | 'macos-vm';
```

Update `configuredMode` so unknown values resolve to `disabled`, not `host`:

```ts
function configuredMode(env: Record<string, string | undefined>): CommandRunnerMode {
  const raw = env.AGENT_PLATFORM_COMMAND_RUNNER ?? env.AGENT_COMMAND_RUNNER;
  if (raw === 'host' || raw === 'docker-sandbox' || raw === 'macos-vm' || raw === 'disabled') {
    return raw;
  }
  return 'disabled';
}
```

Add a disabled runner:

```ts
function createDisabledCommandRunner(): CommandRunner {
  return {
    run: async () => ({
      status: 'denied',
      code: 'COMMAND_RUNNER_UNAVAILABLE',
      reason: 'command_runner_disabled',
      message:
        'Command execution is unavailable because no production sandbox runner is configured.',
    }),
  };
}
```

Update `createConfiguredCommandRunner`:

```ts
if (mode === 'disabled') return createDisabledCommandRunner();
if (mode === 'host') return hostRunner;
if (mode === 'docker-sandbox') return dockerRunner;
if (mode === 'macos-vm') {
  return options.macosVmRunner ?? createDisabledCommandRunner();
}
```

Add `macosVmRunner?: CommandRunner` to `ConfiguredCommandRunnerOptions`.

- [ ] **Step 5: Add mode selection tests**

In `packages/harness/test/commandRunner.test.ts`, add:

```ts
it('defaults configured command execution to disabled when no mode is provided', async () => {
  const runner = createConfiguredCommandRunner({ env: {}, hostRunner: fakeHostRunner });

  const result = await runner.run(fakeRequest());

  expect(result).toMatchObject({
    status: 'denied',
    code: 'COMMAND_RUNNER_UNAVAILABLE',
  });
});

it('uses host execution only when explicitly requested', async () => {
  const runner = createConfiguredCommandRunner({
    env: { AGENT_PLATFORM_COMMAND_RUNNER: 'host' },
    hostRunner: fakeHostRunner,
  });

  const result = await runner.run(fakeRequest());

  expect(result.status).toBe('success');
  expect(fakeHostRunner.run).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
pnpm --filter @agent-platform/harness test -- test/commandRunner.test.ts
pnpm --filter @agent-platform/desktop test -- test/backendSupervisor.test.ts
```

Expected: PASS.

- [ ] **Step 7: Update docs**

In `docs/desktop-runtime.md`, replace the current `auto` production language with:

```md
Packaged desktop builds must not use host fallback. Until the macOS VM runner is available, command execution defaults to disabled. Docker and host runners are explicit development modes only.
```

- [ ] **Step 8: Commit**

```bash
git add packages/harness/src/commandRunner.ts packages/harness/test/commandRunner.test.ts apps/desktop/src/main/backendSupervisor.ts apps/desktop/test/backendSupervisor.test.ts docs/desktop-runtime.md
git commit -m "feature/docker-sandbox-command-runner fix make command runner fail closed"
```

## Stage 2: Add Runner Health Contract

This stage lets the UI, API, E2E tests, and staging gates know which execution environment is active.

### Task 2: Define Runner Health Types

**Files:**

- Create: `packages/harness/src/commandRunnerHealth.ts`
- Modify: `packages/harness/src/index.ts`
- Test: `packages/harness/test/commandRunnerHealth.test.ts`

- [ ] **Step 1: Add failing health tests**

Create `packages/harness/test/commandRunnerHealth.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { normalizeCommandRunnerHealth } from '../src/commandRunnerHealth.js';

describe('command runner health', () => {
  it('marks the macOS VM runner healthy only when ready', () => {
    expect(
      normalizeCommandRunnerHealth({
        mode: 'macos-vm',
        available: true,
        ready: true,
        production: true,
      }),
    ).toMatchObject({
      mode: 'macos-vm',
      state: 'ready',
      production: true,
      canExecute: true,
    });
  });

  it('fails closed when a production runner is unavailable', () => {
    expect(
      normalizeCommandRunnerHealth({
        mode: 'macos-vm',
        available: false,
        ready: false,
        production: true,
        detail: 'VM image missing',
      }),
    ).toMatchObject({
      mode: 'macos-vm',
      state: 'unavailable',
      production: true,
      canExecute: false,
      detail: 'VM image missing',
    });
  });

  it('labels host mode as development only', () => {
    expect(
      normalizeCommandRunnerHealth({
        mode: 'host',
        available: true,
        ready: true,
        production: false,
      }),
    ).toMatchObject({
      mode: 'host',
      state: 'ready',
      production: false,
      canExecute: true,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @agent-platform/harness test -- test/commandRunnerHealth.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement health module**

Create `packages/harness/src/commandRunnerHealth.ts`:

```ts
import type { CommandRunnerMode } from './commandRunner.js';

export type CommandRunnerHealthInput = {
  mode: CommandRunnerMode;
  available: boolean;
  ready: boolean;
  production: boolean;
  detail?: string;
};

export type CommandRunnerHealthState = 'ready' | 'unavailable' | 'disabled';

export type CommandRunnerHealth = {
  mode: CommandRunnerMode;
  state: CommandRunnerHealthState;
  production: boolean;
  canExecute: boolean;
  detail?: string;
};

export function normalizeCommandRunnerHealth(input: CommandRunnerHealthInput): CommandRunnerHealth {
  const state: CommandRunnerHealthState =
    input.mode === 'disabled'
      ? 'disabled'
      : input.available && input.ready
        ? 'ready'
        : 'unavailable';
  return {
    mode: input.mode,
    state,
    production: input.production,
    canExecute: state === 'ready',
    ...(input.detail ? { detail: input.detail } : {}),
  };
}
```

- [ ] **Step 4: Export health types**

In `packages/harness/src/index.ts`, export:

```ts
export {
  normalizeCommandRunnerHealth,
  type CommandRunnerHealth,
  type CommandRunnerHealthInput,
  type CommandRunnerHealthState,
} from './commandRunnerHealth.js';
```

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @agent-platform/harness test -- test/commandRunnerHealth.test.ts
pnpm --filter @agent-platform/harness typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/harness/src/commandRunnerHealth.ts packages/harness/src/index.ts packages/harness/test/commandRunnerHealth.test.ts
git commit -m "feature/docker-sandbox-command-runner feat add command runner health contract"
```

## Stage 3: Decide the macOS VM Runtime Shape

This stage records the production architecture before implementation begins.

### Task 3: Write the macOS VM ADR

**Files:**

- Create: `docs/adr/0003-macos-production-sandbox-runner.md`
- Modify: `docs/desktop-runtime.md`

- [ ] **Step 1: Create ADR**

Create `docs/adr/0003-macos-production-sandbox-runner.md`:

```md
# ADR 0003: macOS Production Command Sandbox Runner

## Status

Accepted for macOS-first production planning.

## Context

The desktop application must run user project commands without relying on end-user Docker installation or host shell fallback. Staging must exercise the same execution path intended for production.

## Decision

Use Apple Virtualization.framework as the first production command runner for packaged macOS builds. The Electron app starts a native helper process that owns a managed Linux VM lifecycle. The harness continues to call the `CommandRunner` interface; the macOS VM runner implements that interface by sending commands to the guest.

## Production Rules

- Packaged macOS builds use `AGENT_PLATFORM_COMMAND_RUNNER=macos-vm`.
- If the VM runner is unavailable, command execution fails closed.
- Host and Docker runners are explicit development modes only.
- Staging must run packaged Electron E2E against the macOS VM runner before merge to `main`.

## Guest Boundary

- Mount only approved Project folders into the guest at `/workspace`.
- Keep app data, credentials, and Electron runtime files outside the guest mount.
- Run commands as a non-root guest user.
- Enforce command timeout, output limit, CPU, memory, and network policy.
- Return structured health and execution results to the backend.

## Alternatives Considered

- Host execution: unacceptable for production because commands run directly on the user system.
- Docker: useful for development, but unsuitable as a product guarantee because end users may not have Docker installed or running.
- Remote execution: rejected for first release because the product must run locally without cloud command execution.
- macOS App Sandbox alone: protects the app process but does not provide a Linux-like command execution environment or dependency isolation for project tooling.

## Consequences

The product must package, bootstrap, update, and test a local VM runtime. Windows and Linux will need equivalent runner adapters later, but the `CommandRunner` contract remains shared.
```

- [ ] **Step 2: Update desktop runtime docs**

In `docs/desktop-runtime.md`, add:

```md
The production macOS runner is the managed VM runner described in ADR 0003. Docker is a development adapter. Staging must not merge to `main` unless packaged Electron E2E proves command execution through the managed VM runner or command execution remains explicitly disabled.
```

- [ ] **Step 3: Run docs checks**

```bash
pnpm docs:lint
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add docs/adr/0003-macos-production-sandbox-runner.md docs/desktop-runtime.md
git commit -m "feature/docker-sandbox-command-runner docs choose macos vm sandbox runner"
```

## Stage 4: Build the Native macOS VM Helper Skeleton

This stage creates the native boundary without yet requiring a full Linux image.

### Task 4: Add Swift Helper CLI Skeleton

**Files:**

- Create: `apps/desktop/native/macos-vm-runner/Package.swift`
- Create: `apps/desktop/native/macos-vm-runner/Sources/MacosVmRunner/main.swift`
- Create: `apps/desktop/native/macos-vm-runner/Tests/MacosVmRunnerTests/MacosVmRunnerTests.swift`
- Modify: `apps/desktop/package.json`

- [ ] **Step 1: Create Swift package**

Create `apps/desktop/native/macos-vm-runner/Package.swift`:

```swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MacosVmRunner",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "macos-vm-runner", targets: ["MacosVmRunner"])
    ],
    targets: [
        .executableTarget(name: "MacosVmRunner"),
        .testTarget(name: "MacosVmRunnerTests", dependencies: ["MacosVmRunner"])
    ]
)
```

- [ ] **Step 2: Add JSON CLI skeleton**

Create `apps/desktop/native/macos-vm-runner/Sources/MacosVmRunner/main.swift`:

```swift
import Foundation

struct JsonResponse: Codable {
    let ok: Bool
    let mode: String
    let state: String
    let message: String
}

func printJson(_ response: JsonResponse) {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    let data = try! encoder.encode(response)
    print(String(data: data, encoding: .utf8)!)
}

let command = CommandLine.arguments.dropFirst().first ?? "status"

switch command {
case "status":
    printJson(JsonResponse(ok: false, mode: "macos-vm", state: "unavailable", message: "VM runner is not prepared."))
case "prepare":
    printJson(JsonResponse(ok: false, mode: "macos-vm", state: "unavailable", message: "VM image preparation is not implemented."))
case "start":
    printJson(JsonResponse(ok: false, mode: "macos-vm", state: "unavailable", message: "VM start is not implemented."))
case "stop":
    printJson(JsonResponse(ok: true, mode: "macos-vm", state: "disabled", message: "VM runner is stopped."))
case "exec":
    printJson(JsonResponse(ok: false, mode: "macos-vm", state: "unavailable", message: "VM command execution is not implemented."))
default:
    printJson(JsonResponse(ok: false, mode: "macos-vm", state: "unavailable", message: "Unknown command: \(command)"))
    exit(2)
}
```

- [ ] **Step 3: Add desktop scripts**

In `apps/desktop/package.json`, add scripts:

```json
"native:vm:build": "swift build --package-path native/macos-vm-runner",
"native:vm:test": "swift test --package-path native/macos-vm-runner"
```

- [ ] **Step 4: Run helper build**

```bash
pnpm --filter @agent-platform/desktop native:vm:build
```

Expected: PASS on macOS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/native/macos-vm-runner apps/desktop/package.json
git commit -m "feature/docker-sandbox-command-runner feat add macos vm runner helper skeleton"
```

## Stage 5: Add Node Adapter for macOS VM Helper

This stage wires the helper into TypeScript without requiring the full VM implementation.

### Task 5: Implement `MacosVmCommandRunner`

**Files:**

- Create: `apps/desktop/src/main/macosVmRunner.ts`
- Test: `apps/desktop/test/macosVmRunner.test.ts`
- Modify: `apps/desktop/src/main/backendSupervisor.ts`

- [ ] **Step 1: Write failing adapter tests**

Create `apps/desktop/test/macosVmRunner.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

import { createMacosVmCommandRunner } from '../src/main/macosVmRunner.js';

describe('macOS VM command runner adapter', () => {
  it('calls the native helper with exec and maps unavailable responses to denied results', async () => {
    const execFile = vi.fn((_binary, _args, _options, callback) => {
      callback(
        null,
        '{"ok":false,"mode":"macos-vm","state":"unavailable","message":"VM runner is not prepared."}\n',
        '',
      );
      return { on: vi.fn() };
    });
    const runner = createMacosVmCommandRunner({ helperPath: '/app/macos-vm-runner', execFile });

    const result = await runner.run({
      command: 'pwd',
      cwd: '/Users/alice/project',
      env: { mode: 'explicit', variables: {} },
      timeoutMs: 1000,
      maxOutputBytes: 4096,
      audit: { toolId: 'sys_bash' },
      workspace: { root: '/Users/alice/project' },
    });

    expect(execFile).toHaveBeenCalledWith(
      '/app/macos-vm-runner',
      ['exec', '--workspace', '/Users/alice/project', '--cwd', '/Users/alice/project', '--', 'pwd'],
      expect.any(Object),
      expect.any(Function),
    );
    expect(result).toMatchObject({
      status: 'denied',
      code: 'MACOS_VM_RUNNER_UNAVAILABLE',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @agent-platform/desktop test -- test/macosVmRunner.test.ts
```

Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Implement adapter**

Create `apps/desktop/src/main/macosVmRunner.ts`:

```ts
import { execFile } from 'node:child_process';

import type { CommandRunner, CommandRunnerResult } from '@agent-platform/harness';

type ExecFileLike = typeof execFile;

export interface MacosVmCommandRunnerOptions {
  helperPath: string;
  execFile?: ExecFileLike;
}

interface HelperResponse {
  ok: boolean;
  mode: string;
  state: string;
  message: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
}

export function createMacosVmCommandRunner({
  helperPath,
  execFile: exec = execFile,
}: MacosVmCommandRunnerOptions): CommandRunner {
  return {
    run: (request) =>
      new Promise<CommandRunnerResult>((resolve) => {
        const startedAt = Date.now();
        const args = [
          'exec',
          '--workspace',
          request.workspace?.root ?? request.cwd,
          '--cwd',
          request.cwd,
          '--',
          request.command,
        ];
        const child = exec(
          helperPath,
          args,
          {
            timeout: request.timeoutMs,
            maxBuffer: request.maxOutputBytes * 2,
            env: request.env.variables,
          },
          (error, stdout, stderr) => {
            if (error) {
              resolve({
                status: 'denied',
                code: 'MACOS_VM_RUNNER_UNAVAILABLE',
                reason: 'macos_vm_runner_process_failed',
                message: stderr || error.message,
              });
              return;
            }
            const response = JSON.parse(stdout) as HelperResponse;
            if (!response.ok && response.state === 'unavailable') {
              resolve({
                status: 'denied',
                code: 'MACOS_VM_RUNNER_UNAVAILABLE',
                reason: 'macos_vm_runner_unavailable',
                message: response.message,
              });
              return;
            }
            resolve({
              status: response.exitCode === 0 ? 'success' : 'failed',
              stdout: response.stdout ?? '',
              stderr: response.stderr ?? '',
              exitCode: response.exitCode ?? 1,
              durationMs: Date.now() - startedAt,
            });
          },
        );
        child.on('error', () => {});
      }),
  };
}
```

- [ ] **Step 4: Run focused tests**

```bash
pnpm --filter @agent-platform/desktop test -- test/macosVmRunner.test.ts
pnpm --filter @agent-platform/desktop typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/main/macosVmRunner.ts apps/desktop/test/macosVmRunner.test.ts apps/desktop/src/main/backendSupervisor.ts
git commit -m "feature/docker-sandbox-command-runner feat add macos vm command runner adapter"
```

## Stage 6: Implement VM Lifecycle

This stage turns the skeleton helper into a real managed local VM runner.

### Task 6: Prepare and Start the VM

**Files:**

- Modify: `apps/desktop/native/macos-vm-runner/Sources/MacosVmRunner/main.swift`
- Modify: `apps/desktop/native/macos-vm-runner/Tests/MacosVmRunnerTests/MacosVmRunnerTests.swift`
- Modify: `docs/desktop-runtime.md`

- [ ] **Step 1: Define helper commands**

The helper must support:

```text
macos-vm-runner status
macos-vm-runner prepare --runtime-dir <dir>
macos-vm-runner start --runtime-dir <dir> --memory-mb 4096 --cpus 2
macos-vm-runner stop --runtime-dir <dir>
macos-vm-runner exec --workspace <host-path> --cwd <host-path> -- <command>
```

- [ ] **Step 2: Implement persistent runtime layout**

Use this app-owned structure:

```text
<desktop runtime dir>/vm/
  images/
    base-linux.img
  state/
    machine-id
    runner.sock
  logs/
    vm.log
```

The helper must never place VM state inside user Project folders.

- [ ] **Step 3: Implement `status` JSON**

`status` must return:

```json
{
  "ok": true,
  "mode": "macos-vm",
  "state": "ready",
  "message": "VM runner is ready."
}
```

or:

```json
{
  "ok": false,
  "mode": "macos-vm",
  "state": "unavailable",
  "message": "VM image is missing."
}
```

- [ ] **Step 4: Implement `prepare`**

`prepare` verifies or creates the VM runtime directory, validates the Linux base image, and records a machine ID. It must fail clearly when the image is missing:

```json
{
  "ok": false,
  "mode": "macos-vm",
  "state": "unavailable",
  "message": "Linux VM image is missing from the packaged runtime."
}
```

- [ ] **Step 5: Implement `start`**

`start` uses Virtualization.framework to boot the VM with bounded CPU and memory. The first implementation may run as a long-lived helper process controlled by Electron.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/native/macos-vm-runner docs/desktop-runtime.md
git commit -m "feature/docker-sandbox-command-runner feat manage macos vm runner lifecycle"
```

## Stage 7: Execute Commands Inside the VM

This stage provides the actual production sandbox behavior.

### Task 7: Add Guest Command Execution

**Files:**

- Modify: `apps/desktop/native/macos-vm-runner/Sources/MacosVmRunner/main.swift`
- Modify: `apps/desktop/src/main/macosVmRunner.ts`
- Modify: `apps/desktop/test/macosVmRunner.test.ts`
- Modify: `docs/testing/command-sandbox-regression-suite.md`

- [ ] **Step 1: Define guest execution contract**

The guest command service must:

```text
Input:
  workspace mount path
  cwd inside mounted workspace
  command string
  explicit environment variables
  timeout
  max output bytes

Output:
  stdout
  stderr
  exitCode
  durationMs
```

- [ ] **Step 2: Enforce project-only mount**

For host Project `/Users/alice/GetHope`, the guest must see:

```text
/workspace
```

and not:

```text
/Users/alice
/Users/alice/Library
~/.ssh
~/.config
```

- [ ] **Step 3: Add E2E-visible proof command**

The command:

```bash
pwd && ls /Users || true && test ! -d "$HOME/.ssh"
```

must prove:

```text
/workspace
test confirms no host /Users mount
test confirms no host ssh directory
```

- [ ] **Step 4: Map VM results to `CommandRunnerResult`**

Update `apps/desktop/src/main/macosVmRunner.ts` so VM execution responses map to:

```ts
{
  status: exitCode === 0 ? 'success' : 'failed',
  stdout,
  stderr,
  exitCode,
  durationMs,
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/native/macos-vm-runner apps/desktop/src/main/macosVmRunner.ts apps/desktop/test/macosVmRunner.test.ts docs/testing/command-sandbox-regression-suite.md
git commit -m "feature/docker-sandbox-command-runner feat execute commands in macos vm runner"
```

## Stage 8: Package the Runner With Electron

This stage ensures the packaged app contains everything needed to start the production runner.

### Task 8: Bundle Helper and VM Assets

**Files:**

- Modify: `apps/desktop/package.json`
- Modify: Electron builder/packaging config file used by the repo
- Modify: `apps/desktop/test/packageScripts.test.ts`
- Modify: `docs/desktop-runtime.md`

- [ ] **Step 1: Add package script expectations**

In `apps/desktop/test/packageScripts.test.ts`, assert package scripts build native helper assets before packaging:

```ts
expect(scripts['native:vm:build']).toBeDefined();
expect(scripts['package:mac']).toContain('native:vm:build');
```

- [ ] **Step 2: Configure packaging**

Package these app-owned assets:

```text
macos-vm-runner
base-linux.img or supported compressed image artifact
guest command service bootstrap files
```

- [ ] **Step 3: Add startup validation**

Packaged app startup must check:

```text
helper exists
helper executable bit is set
VM image exists
status command returns valid JSON
```

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/package.json apps/desktop/test/packageScripts.test.ts docs/desktop-runtime.md
git commit -m "feature/docker-sandbox-command-runner feat package macos vm runner assets"
```

## Stage 9: Add Production-like E2E and Staging Gate

This stage makes staging reflect production.

### Task 9: Add Packaged Electron Sandbox E2E

**Files:**

- Create: `apps/desktop/e2e/command-sandbox.e2e.ts`
- Modify: `docs/testing/command-sandbox-regression-suite.md`
- Modify: `.github/workflows/staging.yml` or existing staging workflow

- [ ] **Step 1: Add E2E test**

Create `apps/desktop/e2e/command-sandbox.e2e.ts` with scenarios:

```ts
test('packaged macOS app executes sys_bash inside the VM runner', async ({ electronApp }) => {
  // Open a temporary Project through the production-like desktop path.
  // Send chat/tool request that runs `pwd`.
  // Assert output includes `/workspace`.
  // Assert runner health reports `mode: macos-vm`.
});

test('packaged macOS app fails closed when the VM runner is unavailable', async ({
  electronApp,
}) => {
  // Launch with VM image intentionally unavailable.
  // Attempt sys_bash command.
  // Assert clear unavailable message.
  // Assert host command did not run.
});
```

- [ ] **Step 2: Add staging workflow rule**

The staging workflow must require:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @agent-platform/desktop test:e2e
```

For macOS staging, `test:e2e` must run against the packaged runner, not the dev host runner.

- [ ] **Step 3: Document merge rule**

In `docs/testing/command-sandbox-regression-suite.md`, add:

```md
`staging` must not merge to `main` unless packaged macOS Electron E2E either proves `AGENT_PLATFORM_COMMAND_RUNNER=macos-vm` command execution or command execution is explicitly disabled for the release.
```

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/e2e/command-sandbox.e2e.ts docs/testing/command-sandbox-regression-suite.md .github/workflows/staging.yml
git commit -m "feature/docker-sandbox-command-runner test gate staging on macos vm sandbox"
```

## Stage 10: Release Hardening

This stage covers production details that must be complete before public release.

### Task 10: Harden Runtime Operations

**Files:**

- Modify: `apps/desktop/src/main/macosVmRunner.ts`
- Modify: `apps/desktop/native/macos-vm-runner/Sources/MacosVmRunner/main.swift`
- Modify: `docs/desktop-runtime.md`

- [ ] **Step 1: Add resource limits**

Enforce:

```text
memory: default 4096 MB, configurable by app-owned config only
cpu: default 2 vCPU
timeout: inherited from CommandRunnerRequest
output: bounded by CommandRunnerRequest.maxOutputBytes
process user: non-root guest user
network: disabled by default, later policy-gated
```

- [ ] **Step 2: Add reset and repair flow**

Expose a desktop maintenance action:

```text
Reset command runner VM
```

It may delete app-owned VM state and images. It must not delete user Project folders.

- [ ] **Step 3: Add signing/notarization validation**

Packaged macOS release checks must verify:

```text
app is signed
native helper is signed
helper can execute after signing
notarized app can start VM runner
```

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/main/macosVmRunner.ts apps/desktop/native/macos-vm-runner docs/desktop-runtime.md
git commit -m "feature/docker-sandbox-command-runner chore harden macos vm runner release path"
```

## Stage 11: Future Platform Adapters

This stage is not required for the first macOS release, but the architecture must leave room for it.

### Task 11: Document Windows and Linux Runner Targets

**Files:**

- Create: `docs/planning/local-sandbox-runner-platforms.md`

- [ ] **Step 1: Create platform planning doc**

Create `docs/planning/local-sandbox-runner-platforms.md`:

```md
# Local Sandbox Runner Platform Plan

## macOS

Production runner: Apple Virtualization.framework managed Linux VM.

## Windows

Candidate runners:

- WSL2-backed managed distribution
- Hyper-V managed VM

Host PowerShell/cmd execution is development-only and must not be the packaged production default.

## Linux

Candidate runners:

- user namespaces with bubblewrap
- lightweight VM
- rootless container runtime managed by the app

Host shell execution is development-only and must not be the packaged production default.

## Shared Contract

All platforms implement the harness `CommandRunner` behavior:

- project-only workspace mount
- explicit environment
- no app data or credential mounts
- bounded resources
- structured health
- fail-closed production behavior
```

- [ ] **Step 2: Commit**

```bash
git add docs/planning/local-sandbox-runner-platforms.md
git commit -m "feature/docker-sandbox-command-runner docs plan future local sandbox adapters"
```

## Testing Strategy And Evidence Matrix

The test strategy must prove properties, not just run commands. Each task must state which property
it proves and which environment it applies to.

| Layer                 | Environment                              | What It Proves                                                                                                                                        | Required Before                       |
| --------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Unit tests            | Local                                    | Pure policy, mode selection, health normalization, and result mapping are deterministic.                                                              | Any PR merge into the feature branch. |
| Adapter tests         | Local                                    | TypeScript calls the correct helper command, passes explicit env only, maps failures to denied results, and never falls back silently.                | VM adapter implementation review.     |
| Swift helper tests    | Local and staging CI on macOS            | Native CLI parsing and JSON output are stable before packaging.                                                                                       | Native helper merge.                  |
| Local VM smoke        | Local                                    | Developers can run the same VM path before staging, without relying on host/Docker behavior.                                                          | VM lifecycle task completion.         |
| Packaged Electron E2E | Staging                                  | The release-shaped app can start the managed backend, report `macos-vm`, execute inside `/workspace`, and fail closed when VM assets are unavailable. | Any staging-to-main promotion.        |
| Manual packaged smoke | Staging and production release candidate | The installed/notarized app works on a real macOS machine with a real Project folder.                                                                 | Release approval.                     |

Required sandbox properties:

- Runner identity: health output must show the active mode and whether it is production-valid.
- Filesystem isolation: commands see `/workspace` for the selected Project and cannot see host home
  directories, app data, credentials, or unrelated Projects.
- Fail-closed behavior: missing helper, missing image, VM boot failure, and unavailable secure
  storage deny command execution instead of falling back to host.
- Environment isolation: guest commands receive only explicit allowed environment variables.
- Resource control: timeout, output limit, CPU, memory, and process/user restrictions are enforced
  or reported as unavailable until enforced.
- Auditability: command execution results distinguish policy denial, approval required, runner
  unavailable, VM failure, and command non-zero exit.
- Packaging validity: the helper and VM assets are present, executable after signing, and usable
  from the packaged app location.

Per-task Definition of Done rules:

- Tasks `.1` and `.2` may complete with unit and adapter tests because they define policy and
  status contracts.
- Task `.3` may complete with Swift helper skeleton tests and ADR approval because it does not yet
  claim production command execution.
- Task `.4` cannot complete until a real local macOS VM smoke proves command execution in
  `/workspace`.
- Task `.5` cannot complete until packaged Electron E2E proves staging uses `macos-vm` and fails
  closed when unavailable.
- Task `.6` cannot complete until signing/notarization and release smoke are documented and
  verified for the packaged helper.
- The epic cannot close while staging can pass using host or Docker command execution.

## Final Verification

Before the production sandbox work can merge from staging to `main`, run:

```bash
pnpm lint
pnpm typecheck
pnpm format:check
pnpm docs:lint
pnpm test
pnpm build
pnpm --filter @agent-platform/desktop native:vm:build
pnpm --filter @agent-platform/desktop native:vm:test
pnpm --filter @agent-platform/desktop test:e2e
git diff --check
```

Required manual packaged-app pass on macOS:

1. Install or launch the packaged app artifact, not the dev Electron shell.
2. Open a real Project folder.
3. Run a harmless shell command through chat/tooling.
4. Confirm runner health reports `macos-vm`.
5. Confirm command output shows guest path `/workspace`.
6. Confirm host-only paths such as `~/.ssh` and app data are not visible inside the guest.
7. Disable or remove VM assets and confirm command execution fails closed with a clear message.

## Merge Rule

Do not merge to `main` while any of these are true:

- Packaged desktop command execution uses host fallback.
- Staging has only tested Docker or host execution.
- Runner health cannot prove `macos-vm` for packaged macOS.
- Packaged E2E does not cover command execution and fail-closed unavailable behavior.
- The VM helper or guest image is not included in the packaged artifact.

## Execution Order

Recommended PR sequence:

1. PR A: Correct current Docker PR semantics and add fail-closed runner mode.
2. PR B: Add runner health contract and UI/API visibility.
3. PR C: Add macOS VM ADR and native helper skeleton.
4. PR D: Implement VM lifecycle and command execution.
5. PR E: Package VM assets and add packaged Electron E2E.
6. PR F: Add release hardening, signing/notarization validation, and staging gate enforcement.
