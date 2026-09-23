# Resolve direct-file Ask and Block policy coverage

Beads: `agent-platform-direct-file-policy`. Discovered from `agent-platform-harness-baseline-p2`.

## Requirements and observed gap

Composed Electron tests save Workspace writes through Settings and verify persistence after reload.
`sys_write_file` then writes a disposable Project file under both Ask and Block, without an approval
record, with a success audit and confirmed changed bytes. Auto succeeds as expected; direct reads
under Block remain read-only. Shell Block and network-command Block work. This is a category-scope
mismatch, not a path-jail escape or an assertion that every permission check is bypassed.

The baseline UI helper text described commands, and the category check applied only to `sys_bash`.
Direct writes used medium-risk metadata without an approval requirement. The owner explicitly
approved extending the category to direct mutations on September 23 after reviewing these failures.

## Approved scope

Apply Workspace writes to direct Project file mutations as well as shell writes. Preserve the
stricter rule: Block denies; Ask requires a durable approval before effect; Auto does not override
high-risk/explicit approval, path-jail, onboarding, allowlist or hard-denial rules. Inventory direct
write/edit/apply-patch/copy/move/delete tools before implementation so a single-tool patch does not
leave equivalent write paths inconsistent. Read-only tools remain unaffected. UI descriptions must
state the supported scope clearly. Preserve the retained failing regression expectations.

## Implementation plan and dependency order

Owner approval is recorded. Reuse the
existing dispatcher/approval service and category settings; no parallel permission system or SDK
migration. Add policy matrix integration assertions and extend the retained representative Electron
journeys. Inventory any additional mutation-path coverage as explicit follow-up scope. This is a
soft discovered-from link to P2, not a hard blocker requiring all baseline assessment to finish.

## Tests and verification

Reuse the Gherkin and evidence in
[permission category baseline](../reviews/current-runtime-permission-category-baseline.md).
Retain the Ask and Block failing cases, assert no effect before approval and no effect under Block,
plus Auto success and read-only control. Verify frontend state, persisted mode, approvals, audits,
provider tool result identity and actual file contents. Add revoked-policy-on-resume coverage if the
approved design affects resume enforcement. No paid provider calls; external provider fixture only.

## Definition of done

Owner-approved scope and tool inventory recorded; intended Ask/Auto/Block outcomes pass with
independent effects and durable evidence; stricter policies remain intact; UI wording is accurate;
no hidden skipped failures. Required build/type/lint/unit/composed E2E and hosted review/quality
checks pass at the committed source. Feature integration is reviewed; no staging/main promotion.

## Implementation boundary and inventory

Reuse the existing WRITE_TOOL_IDS set: sys_write_file, sys_append_file, sys_copy_file,
sys_create_directory, sys_download_file and coding_apply_patch. The patch tool supports creation and
text replacement/append; it does not expose a standalone move/delete operation. There are no
registered dedicated direct move/delete tools in this set; shell moves/removals keep their existing
classification. Git mutation, arbitrary connected tools and network-only tools retain their separate
policies. A download is included because it writes a destination file; its URL protections remain.

Allowed repair paths: harness dispatcher and its focused tests, Workspace settings description and
tests, existing Electron/provider fixtures, this task spec, review evidence and session handoff.
No dependency, database, authentication or workflow-contract change. Ask without settings defaults
conservatively to approval; Auto still consults metadata. Block is checked before approved-resume
bypass, and fresh API resume context must read the current settings. Add a UI journey changing Ask
to Block while approval waits, then approving the old request: no write may occur.
