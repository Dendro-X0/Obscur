# Investigation — AUTH-KERN-1 F5 session loss + slow post-refresh load

**Status:** **Fixed (runtime)** — agent L3 on parity CDP 2026-07-30  
**Date:** 2026-07-28 (UTC) · evidence + repair 2026-07-30  
**Symptom:** After unlock, F5 / WebView refresh lands on **Welcome Back** (Tester1) despite copy promising OS secure storage restore  
**Related:** [`auth-gateway-reload-restore-hang-investigation-2026-07.md`](./auth-gateway-reload-restore-hang-investigation-2026-07.md) · [`auth-keychain-restore-failed-r2-investigation-2026-07.md`](./auth-keychain-restore-failed-r2-investigation-2026-07.md) · charter [`obscur-auth-kernel-charter-2026-06.md`](../../docs/program/obscur-auth-kernel-charter-2026-06.md) · design [`r-auth-slice1-design-2026-07.md`](./r-auth-slice1-design-2026-07.md)

---

## Agent capture evidence (2026-07-30 · parity CDP `:9230`)

| Step | Result |
|------|--------|
| Unlock Tester1 via MCP | Shell unlocked (Chats / Tester1) |
| Rust log | `[SESSION] Native session initialized and persisted … profile default` (×2) |
| CDP `Page.reload` (F5) | **Welcome Back** again |
| Post-F5 digest | `auth.kernel_boot_restore_exhausted` · no `…_succeeded` · no `…_no_keychain` · no manual_lock |
| Post-F5 CDP invoke | `get_session_status` / `desktop_force_session_restore` / `auth_boot_snapshot` → **active + phase unlocked + keychainPresent true** |
| UI vs Rust | JS identity **locked** / Welcome Back while Rust session **already hydrated** |

### Classification

| ID | Verdict |
|----|---------|
| H1 | **Ruled out** — keychainPresent true; init persisted; force restore works after F5 |
| **H2** | **Confirmed** — exhausted; native unlock path fails to sync JS identity |
| H3 | **Contributing** — `desktop-window-boot` called `runAuthKernelBootRestore()` without `skipBootWait`, but reconcile completes only in `finally` after restore → **8s self-wait**; `waitForAuthKernelBootRestore` could settle empty before restore starts |
| H4 | No `profile_scope_violation` event |
| H5 | Manual lock keys empty |
| H6 | No persist-error sessionStorage keys; remember_me true |

### Repair (AUTH-KERN-1 / keep-set) — landed

1. `desktop-window-boot.ts` — `runAuthKernelBootRestore({ skipBootWait: true })` (remove self-wait)
2. `auth-kernel-boot-owner.ts` — read durable/local identity via `readStoredIdentitySnapshot` + `seedAuthKernelLockedIdentity`; reset attempts per flight; per-attempt outcomes
3. `auth-kernel-legacy-delegates.ts` — `seedAuthKernelLockedIdentity`

### L3 proof (agent · no manual)

| Check | Result |
|-------|--------|
| Shell stamp | `shell-2026-07-30T04:54:03Z` |
| F5 UI | Tester1 main shell · **not** Welcome Back (`cap-f17f69cd2b6a`) |
| Event | `auth.kernel_boot_restore_succeeded` attempt 1 |
| L1 | kern-1..4 · 17/17 pass |

---

## Session gate

```text
NEXT ATOMIC STEP:     Full Release recovery — rebuild shell · Mixed ACTIVE · F5 smoke (handoff)
PAUSED / CANCELLED:   community roster · v2.0.0 tag · demo recording · AUTH-SESSION-1 (old patch loops)
CANONICAL OWNER:      auth-kernel-boot-owner.ts + Rust auth_boot / session force restore
PROOF BEFORE DONE:    CodaCtrl digest chain (t3) · then L1 kern-1 contracts · L3 unlock→F5→chat
OUT OF SCOPE:         New silent-unlock loops outside auth-kernel · browser localStorage tokens on desktop
```

| Allowed now | Forbidden without charter |
|-------------|---------------------------|
| Investigation + CodaCtrl capture | Code that “revives AUTH-SESSION-1” as scatter `auth-gateway` / `use-identity` patches |
| Repair **existing** AUTH-KERN boot owner after design + handoff update | Flip policy / invent second restore path |
| Fail-closed hang fix stays (no infinite “Restoring…”) | Claiming “fixed” without L3 unlock→F5→chat |

**Policy nuance:** AUTH-SESSION-1 (v1.9.10) cancelled incremental JS/Rust patch loops. Product later chartered **AUTH-KERN-1** and flipped `DESKTOP_OS_SESSION_RESTORE_PRODUCT_READY = true` / `AUTH_ENGINE_BOOT_RESTORE_ENABLED = true`. UI still promises OS restore. This slice is **repair of AUTH-KERN-1**, not revival of cancelled AUTH-SESSION-1 scatter.

**Handoff conflict:** Current next step is Mixed relay L3 / rebuild. Session-loss repair needs explicit handoff atomic-step swap before implementation.

---

## Symptom contract

| Field | Value |
|-------|--------|
| User action | Unlock Tester1 → use app → **F5** (or WebView reload) |
| Expected (AUTH-KERN-1) | Return to unlocked main shell **without** Welcome Back |
| Actual | Welcome Back + device password form; “How sign-in works…” still claims OS secure storage reopen |
| Secondary | Post-refresh feels slow (restore overlay up to 2.5s, then full auth boot) |
| Does not prove | Cold process kill restore (R2 / AUTH-KERN cold path); packaged NSIS only unless capture uses same surface |

---

## Architecture (canonical path)

```
Unlock → applyNativeSessionPersistence → init_native_session → OS keychain (nsec::{profileId})
F5 → desktop-window-boot reconcile → runAuthKernelBootRestore
  → waitForProfileBootReconcile (≤8s)
  → AuthBootSnapshot (keychainPresent, restoreEligible)
  → retryAuthKernelNativeSessionUnlock → force hydrate → identity unlocked
AuthGateway overlay: “Restoring session…” while !settled OR hard-cap ≤2.5s → fail-closed to auth shell
```

| Concern | Owner |
|---------|--------|
| Boot restore loop | `apps/pwa/app/features/auth-kernel/auth-kernel-boot-owner.ts` |
| Restore eligibility / consent | `auth-kernel-policy.ts` · `device-session-consent.ts` |
| Manual lock survives F5 | `auth-kernel-manual-lock-state.ts` (sessionStorage) |
| Rust hydrate | `commands/auth_boot.rs` · `force_session_restore_for_window` |
| Overlay / hang fail-closed | `auth-gateway.tsx` (`RELOAD_RESTORE_OVERLAY_MAX_MS = 2500`) |
| Persist after unlock | `use-identity.ts` → `initNativeSession` |

---

## Ranked hypotheses

| ID | Hypothesis | Discriminator (CodaCtrl / digest) |
|----|------------|-----------------------------------|
| **H1** | Keychain never written / empty for profile → `auth.kernel_boot_restore_no_keychain` | Digest after unlock+F5; Credential Manager `obscur` / `nsec::{profileId}` |
| **H2** | Boot restore runs but unlock fails (mismatch / inactive / exhausted) | `auth.kernel_boot_restore_mismatch` · `…_exhausted` · no `…_succeeded` |
| **H3** | Timing: overlay hard-cap 2.5s + early `markAuthKernelBootRestoreSettled` fail-closed **before** reconcile/unlock finishes; late unlock never surfaces | Timeline: settle vs unlock events; identity stays locked after 5s |
| **H4** | Profile scope / window bind wrong on F5 | `auth.kernel_boot_restore_profile_scope_violation` · wrong `profileId` in digest |
| **H5** | Manual lock flag still set (`auth.kernel.manual_lock`) | `auth.kernel_boot_restore_manual_lock` |
| **H6** | Persist feedback error after last unlock | `sessionStorage` `obscur_native_session_persist_error::{profileId}` |

**Primary working hypothesis (pre-capture):** **H1 or H2** — product gate is on, hang fix only fail-closes UI; Welcome Back that **sticks** means restore returned false, not merely overlay timeout. **H3** explains slow flash + occasional late chat if unlock eventually succeeds.

**Load-time note:** Even on success, `waitForProfileBootReconcile(8_000)` + up to 5×350ms retries dominate F5. Speed slice (after restore works): skip/shorten reconcile on same-tab reload when scope already bound; align overlay budget with restore budget (not 2.5s vs 8s).

---

## CodaCtrl capture plan (t3)

**Preflight:** `codactrld` from Obscur repo root · `client_dev_environment_get` → `workspaceAligned: true` · CDP `:9230` (Tester1).

| Step | Action | Evidence |
|------|--------|----------|
| 0 | Connect desktop session | `client_session_connect { cdpPort: 9230 }` |
| 1 | Confirm unlocked (chat visible) | screenshot · digest |
| 2 | Note `profileId` + persist feedback keys | bridge / console |
| 3 | Reload (F5) | wait ≤5s |
| 4 | Pull runtime digest | Expect `auth.kernel_boot_restore_*` |
| 5 | Chain append | `chain-auth-kern1-f5-2026-07-28` |

**Pass:** digest includes `auth.kernel_boot_restore_succeeded` + main shell (not Welcome Back).  
**Fail classes:** map to H1–H6 above; do not patch until one class dominates.

**Agent note (2026-07-28):** This Cursor session has **no CodaCtrl MCP tools** attached. Capture requires maintainer MCP restart per [`codactrl-obscur-agent-runbook-2026-07.md`](../../docs/program/codactrl-obscur-agent-runbook-2026-07.md) or manual digest paste.

---

## Design slice (only after capture + handoff charter)

1. Fix **one** owner defect (persist write **or** boot read **or** race) — subtraction, no second restore loop.
2. Align AuthGateway overlay budget with boot restore settle (success path keeps chat; fail path still ≤~2.5–3s to auth shell).
3. Trim F5 reconcile wait when profile already bound (load-time).
4. Proof: L1 `auth-kernel-kern-1` + gateway tests · L3 unlock→F5→chat on parity/release exe.

---

## Claim language

| May say | When |
|---------|------|
| Investigated | This spec + digest chain filed |
| Implemented | Spec slice landed |
| Fixed (runtime) | L3 unlock→F5→unlocked on correct desktop surface |
| AUTH-SESSION-1 revived | **Never** — use AUTH-KERN-1 wording only |
