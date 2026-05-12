# Project Profiles and Capabilities

Projects are generic containers for user-selected folders. A Project can be a repository, docs folder, research folder, generated app, automation workspace, or mixed file set. Coding is a capability or tool mode inside a Project, not the definition of a Project.

## Model

Project assessment emits two separate concepts:

- `profile`: the broad Project shape, such as `coding`, `docs_content`, `research`, `automation`, `mixed`, or `unknown`.
- `capabilities`: the supported actions inferred for that Project, such as `files`, `chat`, `coding_tools`, `tests`, `automation`, or `docs_research`.

The frontend maps these values through `apps/web/lib/project-navigation.ts` before rendering labels. UI surfaces should use those helpers instead of formatting enum names directly.

## Extension Points

When adding a new Project kind:

1. Add the profile or capability to `packages/contracts/src/project.ts`.
2. Teach `apps/api/src/infrastructure/projects/projectAssessment.ts` how to infer it.
3. Add the user-facing display copy in `apps/web/lib/project-navigation.ts`.
4. Cover the new label and fallback behavior in `apps/web/test/project-navigation.test.ts`.

Unknown Projects must keep neutral copy and avoid promising coding, test, or automation support until assessment has detected those capabilities.
