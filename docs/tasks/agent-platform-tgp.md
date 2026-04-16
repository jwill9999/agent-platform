# Task: Secret rotation support

**Beads issue:** `agent-platform-tgp`  
**Spec file:** `docs/tasks/agent-platform-tgp.md` (this file)  
**Parent epic:** Security

## Task requirements

Implement secret key rotation so that the encryption master key can be rotated without downtime or data loss. Existing secrets encrypted with the old key are re-encrypted on access (lazy rotation) and can be batch-rotated via a CLI command.

### Current state

- Secrets are AES-256-GCM encrypted in `secret_refs` table
- `key_version` column exists on secret_refs (already prepared for rotation)
- `packages/db/src/crypto/crypto.ts` handles encrypt/decrypt
- `packages/db/src/secrets/secretStore.ts` handles read/write
- `SECRETS_MASTER_KEY` env var holds the base64-encoded 32-byte key
- No mechanism to rotate keys — changing the env var breaks all existing secrets

### Target state

- Support multiple key versions via `SECRETS_MASTER_KEY` (current) + `SECRETS_MASTER_KEY_PREVIOUS` (old)
- On read: if `key_version` doesn't match current key, decrypt with previous key, re-encrypt with current key, update row
- CLI command: `pnpm secret:rotate` — batch re-encrypt all secrets with current key
- `key_version` column correctly tracks which key encrypted each row
- Clear error messages when neither key can decrypt a secret

## Dependency order

### Upstream — must be complete before this task

| Issue                | Spec                                              |
| -------------------- | ------------------------------------------------- |
| `agent-platform-7tq` | [DB transaction support](./agent-platform-7tq.md) |

Re-encryption must be transactional (read + decrypt + re-encrypt + update atomically).

### Downstream — waiting on this task

None currently.

## Implementation plan

### Step 1: Update crypto module to support multiple keys

**File:** `packages/db/src/crypto/crypto.ts`

- Accept a `KeyRing` object: `{ current: { key, version }, previous?: { key, version } }`
- `decrypt(ciphertext, keyVersion, keyRing)` — try current key first; if version mismatch, try previous
- `encrypt(plaintext, keyRing)` — always use current key

### Step 2: Update secret store for lazy rotation

**File:** `packages/db/src/secrets/secretStore.ts`

- On `getSecretUtf8()`: if decrypted with previous key, re-encrypt with current and update row in DB
- Wrap re-encryption in transaction (from `agent-platform-7tq`)
- Log re-encryption events for auditability

### Step 3: Update database bootstrap for key ring

**File:** `packages/db/src/database.ts` (or config)

- Read `SECRETS_MASTER_KEY` → current key
- Read `SECRETS_MASTER_KEY_PREVIOUS` → previous key (optional)
- Construct `KeyRing` object
- Pass to secret store

### Step 4: Create batch rotation CLI

**File:** `packages/db/src/scripts/rotateSecrets.ts` (new)

- Load all secret_refs rows
- For each: decrypt with appropriate key, re-encrypt with current key
- Wrap entire batch in a transaction
- Report: N secrets rotated, N already current, N failed
- Add to `package.json` as `pnpm secret:rotate` script

### Step 5: Tests

- Unit: KeyRing decrypt with current key
- Unit: KeyRing decrypt with previous key + auto re-encrypt
- Unit: KeyRing fails when neither key works
- Integration: Full rotation cycle (encrypt with old, rotate, read with new)
- Integration: Batch rotation CLI

## Git workflow (mandatory)

| Rule                 | Detail                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------- |
| **Feature branch**   | `feature/security`                                                                       |
| **Task branch**      | `task/agent-platform-tgp` (branch from `feature/security` or after `agent-platform-3kd`) |
| **Segment position** | TBD based on epic ordering                                                               |

## Tests (required before sign-off)

- **Unit:** KeyRing encryption/decryption tests
- **Integration:** Lazy rotation on read, batch rotation CLI
- **Regression:** Existing secret read/write unchanged for current-key secrets

## Acceptance criteria

1. Secrets encrypted with old key can be read with new key after rotation
2. Lazy rotation re-encrypts on access (decrypt with old key, re-encrypt with new key, update `key_version`)
3. `pnpm secret:rotate` batch-rotates all secrets in a single transaction
4. `key_version` column correctly updated on each rotation
5. Clear error with code `SECRET_KEY_MISMATCH` when neither current nor previous key can decrypt a secret
6. Existing tests pass

## Definition of done

- [ ] Beads **description** and **acceptance_criteria** satisfied
- [ ] **Every checkbox** in this spec is complete
- [ ] All **upstream** Beads issues are **closed**
- [ ] **Unit tests** run and pass; rotation tests added
- [ ] **Git:** branch pushed; if segment tip, PR merged
- [ ] This spec file updated if scope changed

## Sign-off

- [ ] **Task branch** created from correct parent
- [ ] **Unit tests** executed and passing
- [ ] **Checklists** complete
- [ ] If **segment tip:** PR merged (link: ********\_********) — _or "N/A — merge at segment end"_
- [ ] `bd close agent-platform-tgp --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** **********\_********** **Date:** ******\_******
