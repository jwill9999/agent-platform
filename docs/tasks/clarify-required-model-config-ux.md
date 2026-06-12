# Clarify Required Model Config UX

## Problem

Chat and workspace flows need a deterministic model-config contract. At least one usable saved model
config must exist before a user can send a message. Without one, the UI should guide the user to
create/configure a model instead of allowing a generic chat failure.

## Scope

- Treat saved model configs with an API key, plus local `ollama` configs, as usable.
- Disable chat sending when no usable model config exists.
- Show a clear setup message when the app needs a model config before chat can run.
- Preserve provider/model agnosticism: no flow should hard-code a provider or model ID.
- Preserve flow choice: agents/workspaces can still prefer their assigned/selected model config
  when multiple usable configs exist.

## Acceptance

- No usable model config: user cannot send and sees a clear instruction to configure a model.
- Exactly one usable model config: it is selected as the default for all chat/workspace flows.
- Multiple usable model configs: selection remains configurable and agent assignment still wins.
- Focused tests cover zero, one, and many usable model-config cases.
