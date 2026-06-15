# agent-platform-290: CI E2E model seed and parked IDE expectations

## Summary

CI E2E checks failed after required model configuration UX became enforced. Browser and packaged VM E2E fixtures did not seed a usable model config, leaving Project chat composers disabled. The browser parked IDE test also still expected the removed internal `/ide` link.

## Requirements

- Seed a usable E2E model config when `E2E_SEED=1` and `SECRETS_MASTER_KEY` is available.
- Ensure packaged Electron VM E2E fixtures provide the same test master key to seeding and runtime.
- Keep the required-model product behavior intact.
- Update browser parked IDE assertions to match the current external desktop IDE guard behavior.

## Verification

- Run the focused browser E2E spec.
- Run the packaged VM Electron E2E spec where possible.
- Run package typecheck/lint/tests relevant to changed files.

## Definition of Done

- The E2E composer is enabled in CI fixtures through a real saved model config.
- The parked IDE browser test no longer expects internal `/ide` navigation.
- CI failure signatures for disabled Project chat composers are addressed.
