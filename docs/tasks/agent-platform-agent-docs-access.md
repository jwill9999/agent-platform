# Agent access to current AI library documentation

## Requirements

Owner requested current AI SDK documentation access alongside the previously authorized LangChain
MCP connection. Add project agent instructions with official lookup entry points and installed-version
checks. Keep application code, dependencies and migration decisions unchanged.

## Implementation and dependency order

No task dependencies. Register LangChain documentation in project Codex configuration and document
AI SDK index/search/targeted Markdown lookup in shared agent instructions. Reuse the installed
Vercel AI SDK skill. Deliver task/agent-docs-access to feature/agent-docs-access for review.

## Verification and definition of done

Validate TOML, live LangChain initialization, AI SDK index/search/page access, Markdown and relative
links. Preserve unrelated local files. Push the reviewed configuration/documentation changes and
record the PR in Beads. No model calls, package changes or production promotion.
