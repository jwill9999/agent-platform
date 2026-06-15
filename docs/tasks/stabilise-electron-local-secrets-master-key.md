# Stabilise Electron Local Secrets Master Key

## Problem

Local desktop runs can fail in both Personal Chat and Coding/Project Chat when saved model API keys
were encrypted under a different `SECRETS_MASTER_KEY`. The backend then fails while decrypting the
stored model key and the UI shows a generic unexpected error.

## Scope

- Make `make electron-local` use a stable development secrets master key across restarts.
- Preserve the existing encrypted-secret model: API keys remain encrypted in SQLite.
- Return an actionable model reconfiguration error when an existing saved key can no longer be
  decrypted.
- Extend Playwright/Electron coverage so Personal Chat and Project/Coding paths send a message and
  observe an assistant response.

## Acceptance

- Local desktop development does not generate a fresh secrets master key every run.
- Existing unrecoverable model-key decryption failures tell the user to re-enter the model API key
  in Settings > Models.
- Electron Playwright coverage verifies Personal Chat and Project/Coding workspace paths can receive
  assistant response text using deterministic mocked model output.
- Manual/staging QA still performs a real configured-model smoke test to catch provider/key issues.
