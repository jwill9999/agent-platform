# Production bootstrap adapters

`bootstrapAdapterRuntime.ts` implements the strict stdin JSON protocols used by
`BootstrapCoordinator`. `bootstrapAdapterBundle.ts` generates two self-contained Node executables
with the exact deployment configuration embedded. It does not execute Git or Beads while building.
No npm modules, external configuration file, credentials or approval records are embedded in an
adapter. The generated files import only Node builtins.

## Build and pin

Build with the repository Node 24 runtime, then run:

```sh
node packages/workflow-control/dist/bootstrapAdapterBundle.js CONFIG_JSON NEW_ABSOLUTE_DIRECTORY
```

Alternatively use `pnpm --filter @agent-platform/workflow-control build:bootstrap-adapters --`
followed by those two arguments. The destination must be a strict descendant of the canonical
working directory and must not exist. Run the CLI from the intentionally chosen deployment root;
an absolute path outside that root is rejected. Config JSON and CLI arguments cannot override
this boundary. Paths must be canonical, with no traversal or symlinked parent directories.

Trusted embedding code may intentionally place a bundle outside its working directory by calling
`buildBootstrapAdapters(config, absoluteDestination, { deploymentRoot: trustedAbsoluteRoot })`.
The root must come from trusted caller configuration, never forwarded unchecked from request data,
CLI arguments or the adapter config JSON. It must be an existing canonical directory other than
the filesystem root; the destination must remain strictly inside it.

The builder creates an owner-only
directory and `bootstrap-beads.mjs` / `bootstrap-remote.mjs`, both mode 0700. It prints the complete
`policy.adapters` object, including each executable digest and `dependencies`. Copy the entire
object into the final reviewed policy. Never omit dependency pins or update an approved bundle in
place. A changed binary, configuration or runtime requires a new bundle and policy approval.

The strict deployment configuration has these fields:

| Field                             | Required binding                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| `version`                         | `1`                                                                                         |
| `workspaceRoot`                   | Exact canonical original checkout realpath, not an arbitrary worktree                       |
| `gitCommonDirectory`              | Exact realpath of that checkout's `.git` directory                                          |
| `repository`                      | Exact `owner/repository`                                                                    |
| `taskId`, `ref`                   | Exact task ID and `refs/heads/task/TASK_ID`                                                 |
| `remoteName`, `remoteUrl`         | Exact reviewed origin name and URL                                                          |
| `expectedRemoteSha`               | Exact SHA or `null` for initial ref creation                                                |
| `homeDirectory`                   | Current OS user's real home directory, for existing CLI/keychain lookup                     |
| `node`, `git`, `beads`            | Each `{path, digest}` with real executable path and SHA-256                                 |
| `beadsProjectId`, `beadsDatabase` | Exact official context project UUID and embedded Dolt database name                         |
| `gitExecPath`                     | Real Git exec directory; helper aliases must resolve to pinned binaries                     |
| `https`                           | `{remoteHelper, credentialHelper}`, each an executable pin; or `null` for local conformance |

HTTPS deployments accept only `https://github.com/OWNER/REPOSITORY.git` for the exact configured
repository. `https.remoteHelper` pins the executable behind `git-remote-https` (normally
`git-remote-http`). `https.credentialHelper` pins the existing native credential helper implementing
Git's credential protocol, such as `git-credential-osxkeychain`. It is invoked for `get` only, never
`store` or `erase`; it must already be able to retrieve the repository credential. The adapters do
not import a host `GH_TOKEN`, change Git configuration, add credentials or install a new helper.
Interactive prompts and redirects are disabled. Missing scoped credentials fail closed.

For real local conformance tests, `https: null` requires an exact absolute bare-repository realpath.
No `file://`, SSH, `ext::`, arbitrary HTTPS host, or user-selected command protocol is accepted.
This explicit local configuration is embedded and pinned like production configuration.

The observed macOS tools are the bundled Node 24 executable, the official
`/Users/letuscode/.local/bin/bd`, and Xcode's real Git/remote/keychain executables under
`/Applications/Xcode.app/Contents/Developer/usr`. Resolve symlinks before hashing. Inspection of
their dynamic dependencies found Apple system libraries/frameworks only. The supported trust base
is the OS loader, Apple system libraries, `/bin/sh` and owner/root filesystem permissions. Node
options, dynamic loader variables and mutable npm imports are not inherited. Deployment on another
platform or with additional non-system shared libraries requires a dependency-closure review; do
not claim those libraries are covered by an executable hash alone.

The coordinator validates policy dependency hashes before launching the adapter interpreter.
The adapter also checks its embedded pins, interpreter identity and Git helper resolutions.
The remote adapter supplies a private Git exec directory containing only links to the pinned Git
and HTTPS helper. It operates from a fresh temporary bare repository with an empty template and
disabled global/system configuration. Client-only object alternates provide the canonical source
objects without changing its index or refs or leaking alternates into a local remote receiver.

## Read and mutation boundaries

The Beads adapter accepts only `{kind:"beads.read", workspaceRoot, taskId}` with exact configured
values. It invokes official `bd` with `--readonly --sandbox --dolt-auto-commit=off --json`, checks
`context` resolves to the canonical repository and pinned project/database in embedded Dolt mode
without redirects, then calls `show --long --id=TASK_ID`.
It unwraps exactly one in-progress task and preserves every returned field. Freeze the policy's
`beadsSnapshot` from this complete object: the MCP view can omit fields such as `spec_id`, `owner`,
`created_by`, `started_at` and `parent`. Do not strip these or fabricate MCP-equivalent null fields.

The remote adapter accepts only `git.observe_ref` or `git.push` with the configured workspace,
repository, remote name/URL and task ref. Push additionally binds the configured old SHA and a valid
new commit SHA. It observes the exact remote ref, verifies the local task ref matches the requested
commit, checks fast-forward ancestry when an old SHA exists, uses provider-side
`--force-with-lease=REF:EXPECTED_OLD`, and re-observes the exact resulting head. Tags, other refs,
local pre-push hooks and repository URL/credential configuration do not influence the push.
An old-SHA replay fails CAS; coordinator recovery must observe/adopt an already completed effect.

Requests with extra keys, other commands, substituted bindings, malformed/oversized JSON, modified
dependencies or CLI arguments fail before dispatch. Requests are bounded to 64 KiB; subprocess
output is bounded to 1 MiB and execution to an eight-second operation budget. Failures expose one
generic error, never subprocess output or credentials. The outer coordinator remains responsible
for run/task/workspace fences, policy/approval, exact source tree, evidence and the durable saga.

## Approval preparation

Generating adapters is not approval to execute them against the live repository. After independent
review, regenerate the candidate manifest/tree/diff, retain the generated executable hashes and
dependency list, read the exact Beads snapshot, and attach real final-candidate test and independent
review evidence. Then derive the full policy and contract/material digests and obtain exact critic
and authenticated owner approval, including the separate live journal migration and old-stub
cancellation sequence. The earlier draft packet's tree, empty adapter fields and MCP snapshot are
superseded by this implementation; do not silently reuse its digest or historical approvals.

Tests use real temporary workspaces/bare remotes plus a fixture Beads process. They establish command
and environment isolation and CAS behavior; they do not certify live credentials, keychain access,
hosted checks, Beads synchronization or an executed bootstrap publication.
