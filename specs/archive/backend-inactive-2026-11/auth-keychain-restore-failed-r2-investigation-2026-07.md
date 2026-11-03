# Investigation — R2 `auth-keychain-restore-failed` / cold password unlock

**Status:** Capture complete (2026-07-04) — **split verdict** · design slice next  
**Date:** 2026-07-04 (UTC)  
**Symptom:** `auth-keychain-restore-failed` · register fingerprint `symptom:auth-keychain-restore-failed`  
**Tracker:** [`docs/program/obscur-runtime-issue-tracker-2026-07.md`](../../docs/program/obscur-runtime-issue-tracker-2026-07.md) · maintainer queue R2  
**Handoff:** [`docs/handoffs/current-session.md`](../../docs/handoffs/current-session.md)  
**Prior analysis:** [`docs/archive/program/inactive-2026-06/desktop-f5-session-restore-analysis.md`](../../docs/archive/program/inactive-2026-06/desktop-f5-session-restore-analysis.md) (F5 scope clobber — fixed 2026-06-17; cold kill is a distinct path)

---

## Summary

After **desktop process cold kill** (`taskkill obscur_desktop_app.exe`) and relaunch, the user lands on `/sign-in` (expected — no auto-unlock). **Device password unlock fails** when the profile is in **passwordless native-only** state; it **succeeds** when a device password was explicitly materialized.

**Capture verdict (2026-07-04 — chain `chain-r2-auth-cold-unlock-2026-07-04`):**

| Node | Outcome |
|------|---------|
| `n0-sign-in-gate-fresh-boot` | **H1 confirmed** — UI: *“No device login password is saved…”* · digest `auth.kernel_boot_restore_no_keychain` |
| `n1-warm-password-unlock` | Import Key → **Set password and unlock** → main shell (12 msgs) |
| `n2-cold-password-unlock-pass` | **t4 PASS** — `taskkill` → relaunch → password unlock → main shell without Import Key |

**Refined root cause:** R2 is not universal cold-restart auth breakage. Failure path = **`__obscur_native_only__` active identity** (Import Key / “Skip — unlock with key only” / native session persist without password row). Success path = password-encrypted row present in scoped storage (explicit “Set password and unlock” or prior password unlock). R1 t4 cold capture used **Import Key workaround** — likely left passwordless state, feeding R2.

**Primary hypothesis (failure path):** Active stored identity is **`__obscur_native_only__`** while **`collectPasswordProtectedIdentityCandidates` finds no harvestable password blob** → *“No device password unlock is saved…”*

**Secondary hypothesis:** Password candidates exist but decrypt fails (*“Incorrect password”*) — **not observed** in this capture round.

---

## Symptom contract

| Field | Value |
|-------|--------|
| User action | Cold kill desktop → relaunch → `/profiles` or `/sign-in` → enter **device password** (not Import Key) |
| Expected | Unlock succeeds; runtime activates without re-importing nsec |
| Actual | Unlock fails; Import Key or backup restore required |
| Proof tier target | **t4** — `taskkill obscur_desktop_app.exe` → relaunch → password unlock |
| Fixture | Tester1 · password `SyI14^ew1E` · [`obscur-dev-test-accounts.md`](../../docs/program/obscur-dev-test-accounts.md) |
| Does not prove | Auto keychain unlock without password; packaged NSIS build; Tester2 dual-window |

---

## Evidence inventory

### Prior captures (t3 — gate only)

| Source | Finding |
|--------|---------|
| `chain-dm-split-brain-2026-07-02` · `n1-sign-in-gate` | `/sign-in` after profile pick; digest `auth.kernel_boot_restore_no_keychain` |
| Register `verify:issue:agent:*` · `auth-keychain-restore-failed` | proof tier **t3**; `doesNotProve: root cause` |
| Phase 1C O-2 t4 (2026-07-04) | Password unlock **PASS** after cold kill — same symptom class, opposite outcome |
| R1 t4 `n1-post-restart-hydrate` (2026-07-04) | Post-restart used **Import Key**; `doesNotProve: Password cold unlock without Import Key` |

### Signals to pull on next capture

| Signal | Interpretation |
|--------|----------------|
| `auth.kernel_boot_restore_no_keychain` | Keychain empty for scoped profile — expected on cold kill if persist failed |
| `auth.kernel_boot_restore_succeeded` | Auto-restore worked — R2 repro should **not** see this before manual unlock |
| `auth.identity_password_repair_restored` | Bootstrap repaired passwordless → password-protected row |
| `identityState.stored.encryptedPrivateKey === __obscur_native_only__` | Password form shown but no passphrase path |
| Unlock error text | *No device password* vs *Incorrect password* — splits H1 vs H4 |
| `sessionStorage` native persist feedback | [`native-session-persist-feedback.ts`](../../apps/pwa/app/features/auth/services/native-session-persist-feedback.ts) after last warm unlock |

---

## Architecture — three tiers (unchanged from F5 analysis)

| Tier | Survives cold kill? | Owner |
|------|---------------------|-------|
| In-memory Rust `SessionState` | **No** | `commands/session.rs` |
| OS keychain `nsec::{profileId}` | **Yes** (if persisted) | `native_keychain.rs` |
| IndexedDB / localStorage `identity::{profileId}` | **Yes** | `get-stored-identity.ts` · `identity-persistence` |

**Product policy (current):** `DESKTOP_OS_SESSION_RESTORE_PRODUCT_READY = true` · boot restore **enabled** via auth-kernel — but user may still land on sign-in when keychain absent or manual lock. **Manual password unlock remains required** on that path.

---

## Code path analysis

### Boot (cold start)

```
layout.tsx sync scope → desktop-window-boot → ensureInitialized (use-identity.ts)
  → getStoredIdentity / recoverStoredIdentityProfile
  → resolveStoredIdentityRecord (data-root-identity-repair.ts)
       └─ if passwordless: resolvePasswordProtectedIdentityRecord (local aliases → LevelDB harvest)
  → waitForAuthKernelBootRestore (auth-kernel-boot-owner.ts)
  → readAuthKernelKeychainPresent
  → setLockedAwaitingNativeRestore | setStoredLockedIdentityStartup | locked
```

**Owners:**

| Concern | Canonical module |
|---------|------------------|
| Identity bootstrap + unlock | `apps/pwa/app/features/auth/hooks/use-identity.ts` |
| Passphrase decrypt + candidate harvest | `apps/pwa/app/features/profiles/services/identity-passphrase-unlock.ts` |
| Passwordless → password repair | `apps/pwa/app/features/profiles/services/data-root-identity-repair.ts` |
| Boot restore loop | `apps/pwa/app/features/auth-kernel/auth-kernel-boot-owner.ts` |
| Auth shell / routing | `apps/pwa/app/features/auth/components/auth-gateway.tsx` |
| Startup state taxonomy | `apps/pwa/app/features/auth/services/startup-auth-state-contracts.ts` |
| Native session IPC | `apps/pwa/app/features/auth/services/session-api.ts` → `desktop_force_session_restore` |

### Manual password unlock

```
auth-screen / main-shell → unlockIdentityAction
  → tryUnlockIdentityWithPassphrase (activeRecord = identityState.stored)
  → collectPasswordProtectedIdentityCandidates (localStorage + harvestProfileWebStorage)
  → decryptPrivateKeyHex per candidate
  → on success: applyNativeSessionPersistence → initNativeSession → keychain
  → on zero candidates: "No device password unlock is saved… Use Import Key"
  → on decrypt miss: "Incorrect password"
```

**Critical gate:** `isPasswordlessNativeOnlyIdentity(record)` excludes rows with sentinel `__obscur_native_only__` from passphrase candidates. If bootstrap repair did not promote a password-encrypted row into `identityState.stored`, password unlock cannot succeed.

### Native persist after warm unlock

```
applyNativeSessionPersistence (staySignedIn default true)
  → syncNativeSessionInBackground → initNativeSession(privateKeyHex)
  → SessionApi.forceSessionRestore
  → setIdentityState(unlocked, NATIVE_KEY_SENTINEL)
```

Import Key and native-only unlock paths may persist **passwordless sentinel** in IndexedDB while keychain holds the key — password unlock depends on **harvest finding an older encrypted blob**.

### Parallel paths (subtraction targets — do not add a fourth restore loop)

| Path | Role |
|------|------|
| `runAuthKernelBootRestore` | Auto keychain restore on reload |
| `probeNativeSessionForRestore` / `tryNativeSessionUnlock` | Legacy aggressive restore |
| `auth-gateway` auto-unlock effects | Mobile remember-me only when `!isAuthKernelAuthority()` |
| `resolveStoredIdentityRecord` | Password-row repair at bootstrap |

---

## Ranked hypotheses

### H1 — Passwordless active record, harvest miss (primary)

**Mechanism:** Last successful unlock used native/keychain path; stored row is passwordless sentinel. LevelDB harvest does not find password-encrypted sibling (wrong profile slot, wiped EBWebView, or harvest timing). User enters device password → zero candidates.

**Supports:** R1 cold capture used Import Key; identity-passphrase-unlock tests show harvest can recover when blob exists; error copy matches H1.

**Disproves:** Console shows `auth.identity_password_repair_restored` and `stored.encryptedPrivateKey` is real JSON blob before unlock attempt.

### H2 — Bootstrap repair race

**Mechanism:** `resolveStoredIdentityRecord` repairs asynchronously during `ensureInitialized`, but UI unlock fires before repair completes or before `identityState.stored` reflects repaired row.

**Supports:** Intermittent O-2 pass vs R1 fail on same fixture.

**Disproves:** Capture shows repaired record in identity snapshot before first password submit.

### H3 — Profile scope mismatch

**Mechanism:** `resolveIdentityScopeProfileId()` differs between warm session and post-kill boot (`layout.tsx` / `last_known` / registry). Unlock reads `identity::wrongProfile` — empty or passwordless.

**Supports:** F5 analysis history (scope clobber fixed but cold boot may differ).

**Disproves:** Boot logs show consistent `profileId` + `storedPublicKeyHex` matching Tester1 fixture.

### H4 — Wrong encrypted blob (Incorrect password)

**Mechanism:** Multiple password-encrypted candidates; active/passphrase pair mismatched after backup restore or alias merge.

**Supports:** Account-sync tests document passwordless overwrite protection — inverse may still occur on edge paths.

**Disproves:** Single candidate; decrypt succeeds in isolated test with harvested blob + fixture password.

### H5 — Keychain present, boot restore exhausted, passwordless UI

**Mechanism:** `auth.kernel_boot_restore_no_keychain` false positive/negative; user sees password form while boot owner expected auto-restore; manual password path never wired for native-restorable state.

**Supports:** RIW-9 `n1-sign-in-gate` signal.

**Disproves:** Digest shows keychain absent + `stored_locked` — password path is correct surface; failure is decrypt/candidates.

---

## Repro protocol (CodaCtrl t4 — required before fix)

### Stack preflight

```bash
# Terminal A — relay (user: Docker ready)
pnpm dev:relay:docker          # :7000

# Terminal B — coordination
pnpm dev:coordination          # :8787

# Terminal C — desktop + CDP
export WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9230"
pnpm dev:desktop -- --online --skip-build

# Terminal D — CodaCtrl daemon (if not via Studio)
CLIENT_CAPTURE_MODE=playwright codactrld serve
```

### Capture sequence

1. `client_dev_environment_get` → `workspaceAligned: true` · CDP `:9230` targets > 0
2. **Warm baseline:** `client_session_connect` `{ "cdpPort": 9230 }` → unlock Tester1 with **password** (not Import Key) → confirm chats load
3. `client_runtime_digest_pull` → save warm digest
4. `client_investigation_chain_create` `{ "chainId": "chain-r2-auth-cold-unlock-2026-07-04", "hypothesis": "H1 passwordless active record" }`
5. **Cold kill:** `taskkill /IM obscur_desktop_app.exe /F` → relaunch desktop (same env)
6. `client_session_connect` → confirm `/sign-in` or profile picker
7. `client_runtime_digest_pull` **before** unlock → capture `auth.kernel_boot_*` signals
8. Password unlock: `client_interact_type` password field → `client_interact_click` Log In
9. `client_console_latest` + screenshot + `client_validate_assert` (success: main shell visible; fail: error banner text)
10. If fail: retry with Import Key → record as workaround step (does not satisfy t4 pass)
11. `client_investigation_chain_append` nodes `n0-warm-password-unlock` → `n1-post-kill-sign-in` → `n2-password-attempt`
12. Export: `.codactrl/verify/issue-report/export-manifest.json`

### Pass criterion (t4)

| Check | Required |
|-------|----------|
| Cold kill | `taskkill obscur_desktop_app.exe` |
| Unlock method | Device password only |
| Outcome | Main shell / chats without Import Key |
| Chain | 3 nodes minimum with digest + screenshot refs |
| Register | Update `auth-keychain-restore-failed` proof tier → t4 on pass |

---

## Diagnostic checklist (capture agent)

Record in chain node notes:

- [ ] `startupState.kind` (`stored_locked` | `native_restorable` | `mismatch`)
- [ ] `auth.kernel_boot_restore_*` events from digest
- [ ] `auth.identity_password_repair_restored` present/absent
- [ ] Whether warm session ended with password vs Import Key unlock
- [ ] Exact unlock error string (*No device password* vs *Incorrect password*)
- [ ] `encryptedPrivateKey` class: sentinel vs JSON (via dev-lab bridge if available — do not log secrets)
- [ ] `resolveIdentityScopeProfileId()` at unlock time
- [ ] Native persist feedback in `sessionStorage` after warm unlock

---

## Remediation options (design — no code in this spec)

| Option | Owner | Description | Risk |
|--------|-------|-------------|------|
| **A — Bootstrap materialization** | `data-root-identity-repair.ts` | Ensure `resolveStoredIdentityRecord` completes before auth shell accepts password; surface repair failure in UI | Low if idempotent |
| **B — Unlock-time re-repair** | `identity-passphrase-unlock.ts` | Call `resolvePasswordProtectedIdentityRecord` inside `tryUnlockIdentityWithPassphrase` when active row passwordless | Overlap with bootstrap — verify single owner |
| **C — Persist password row on unlock** | `use-identity.ts` `unlockIdentityAction` | After successful decrypt, always `saveStoredIdentity` with encrypted blob (already partial) | Must not overwrite stronger row |
| **D — Honest UX** | `auth-screen.tsx` | When passwordless-only + no candidates, skip password tab / direct to Import Key | Does not fix root cause; acceptable interim |
| **E — Device password setup gate** | auth-screen passwordless guide | Force device password creation after Import Key before marking profile “ready” | Product change — needs charter |

**Subtraction rule:** Do not add a fifth boot-restore loop in `auth-gateway.tsx`. Extend auth-kernel or identity-passphrase owner only.

**Out of scope:** Re-enable silent auto-unlock without password (AUTH-SESSION-1 cancelled band); COM-RUN-01 roster; R3 sidebar preview.

---

## Proof plan (post-fix)

| Layer | Command / action |
|-------|-------------------|
| **L1** | `pnpm -C apps/pwa exec vitest run app/features/profiles/services/identity-passphrase-unlock.test.ts app/features/profiles/services/data-root-identity-repair.test.ts app/features/auth/services/startup-auth-state-contracts.test.ts` |
| **L1** | `pnpm verify:session-persistence-policy` · `pnpm -C apps/pwa exec vitest run app/features/auth-kernel/` |
| **L3** | CodaCtrl warm password unlock baseline |
| **L4 / t4** | Cold kill → password unlock without Import Key · chain `chain-r2-auth-cold-unlock-*` |
| **Regression** | Phase 1C O-2 cold DM message still visible after unlock |

---

## Next step after this spec

1. Execute t4 capture (warm password → cold kill → password attempt) — confirm H1 vs H4 from error text + digest.
2. If H1 confirmed: design slice in follow-on **design spec** — option A or B with owner map.
3. Implement smallest slice; re-run t4 before handoff **VERIFIED**.

---

## References

- [`obscur-auth-kernel-charter-2026-06.md`](../../docs/program/obscur-auth-kernel-charter-2026-06.md)
- [`obscur-v2-known-limitations.md`](../../docs/program/obscur-v2-known-limitations.md) § R2
- [`runtime-issue-investigation-workflows-2026-06.md`](../../docs/program/runtime-issue-investigation-workflows-2026-06.md)
