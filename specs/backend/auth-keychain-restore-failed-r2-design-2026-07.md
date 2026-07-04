# Design — R2 password-protected identity materialization at unlock

**Status:** Approved for implementation (2026-07-04)  
**Investigation:** [auth-keychain-restore-failed-r2-investigation-2026-07.md](./auth-keychain-restore-failed-r2-investigation-2026-07.md)  
**Chain:** `chain-r2-auth-cold-unlock-2026-07-04`

---

## Problem (split verdict)

| Path | Behavior | Fix band |
|------|----------|----------|
| **A — Passwordless-only** | User chose Import Key → skip device password (`__obscur_native_only__`). Cold restart requires Import Key again. | **Honest UX** (existing copy) — not a crypto bug |
| **B — Password drift** | Active scoped row is passwordless but sibling LevelDB / alias keys still hold password-encrypted blob. Bootstrap repair may not have run before sign-in probe. | **This slice** |
| **C — Password set** | Explicit “Set password and unlock” or passphrase unlock with encrypted row. | **Already works** (n2 t4 PASS) |

---

## Design decision

**Option B (unlock-time materialization)** — single choke in `identity-passphrase-unlock.ts`:

Before `collectPasswordProtectedIdentityCandidates` gathers rows, call existing owner `resolvePasswordProtectedIdentityRecord` when `shouldAttemptPasswordProtectedIdentityRepair(active)` for the scoped profile.

Effects:

1. `hasPasswordProtectedUnlockOnDevice` — sign-in UI reflects harvestable password rows after materialize.
2. `tryUnlockIdentityWithPassphrase` — decrypt attempts see repaired local row.
3. No new boot-restore loop in `auth-gateway.tsx`.

**Out of scope:** Force password setup after skip (option E); auto keychain unlock without password.

---

## Owner map

| Concern | Owner |
|---------|--------|
| Harvest + write password row | `data-root-identity-repair.ts` (`resolvePasswordProtectedIdentityRecord`) |
| Unlock candidate gather | `identity-passphrase-unlock.ts` (`collectPasswordProtectedIdentityCandidates`) |
| Bootstrap repair | `resolveStoredIdentityRecord` in `use-identity.ts` (unchanged) |

---

## Implementation slice

1. Add `materializePasswordProtectedIdentityBeforeUnlock` in `identity-passphrase-unlock.ts`.
2. Invoke at start of `collectPasswordProtectedIdentityCandidates`.
3. Unit test: mock repair; assert called when active row is passwordless.

---

## Proof plan

| Layer | Command |
|-------|---------|
| L1 | `pnpm -C apps/pwa exec vitest run app/features/profiles/services/identity-passphrase-unlock.test.ts app/features/profiles/services/data-root-identity-repair.test.ts` |
| L3 | Re-run chain n0 gate — if harvest has blob, UI should show password tab |
| L4 | Existing n2 path unchanged (password set → cold unlock PASS) |
| L4 (optional) | n3 — skip-key-only → cold kill → Import Key required (documents path A) |

---

## Register / handoff exit

- **VERIFIED t4** when path C holds after fix (regression).
- Path A remains **documented limitation** in [obscur-v2-known-limitations.md](../../docs/program/obscur-v2-known-limitations.md) — not claimed fixed.
- Path B fixed when `auth.identity_password_repair_restored` fires at unlock probe and password unlock succeeds without Import Key.
