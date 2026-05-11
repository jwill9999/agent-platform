# Parked Project Workspace E2E Coverage

`e2e/project-workspaces.spec.ts` was removed in `agent-platform-electron-extract.3`.

The suite relied on typing backend/container paths into the web IDE to open a Project. That is not
the product path after the Electron desktop decision:

- users should not type absolute host paths;
- browser folder handles are not sufficient Project binding for the agent runtime;
- `/workspace` and backend/container paths should not be exposed as normal user-facing state.

Replacement coverage belongs in the Electron Project access and onboarding epics. The replacement
suite should exercise the built desktop runtime: click **Open Project**, select a local folder with
the native picker, verify the selected Project is bound to the local runtime, then run `/init`.
