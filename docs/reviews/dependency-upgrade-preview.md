# Major dependency upgrade preview review

19October2026 draft. Exact stagingbe153; independent read-only researcher sdk_router_worker inspected
current code/lock/actions, PR368–372 and official sources. No package/runtime/settings change.
Findings and initial estimates are in the [plan](../planning/dependency-upgrade-preview.md).

Confirmed obsolete ai4→5 recommendation versus stagedai7.0.143; Electron42 published EOL20October;
Next15 approaching inferred two-year boundary21October while still listed MaintenanceLTS. Do not
present inferred Next date as an explicit new vendor EOL notice. PR370 inventory mismatch is a
provenance failure, not proof of a particular vulnerable dependency. Broad groups and paused manifest
changes need explicit disposition. The original user concern is valid: major upgrades need reviewed
scope; enabling proposals does not enable merge or approve changes.

Distinct plan critique found UP-P01: Next16 changes existing plain dev/build commands to default
Turbopack. The plan and verification map now explicitly require a retain-Webpack versus qualify-
Turbopack decision, monorepo tracing/standalone Docker assembly and desktop renderer coverage.
Corrected plan passed distinct source-aware critique with zero findings (UP-P01 resolved).
Document publication and the owner discussion remain pending; no implementation or merge is approved. Future upgrades/tests are
proposed, not implemented or run. No owner decision on runtime targets/distribution floor is assumed.
