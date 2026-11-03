# Design — R-AUTH Slice 1 (auth boot / session hydrate)

**Status:** **Implemented + agent L3 verified** (H2 + self-wait repair)  
**Date:** 2026-07-29 · verified 2026-07-30  
**Slice:** `R-AUTH` (Unlock → identity ready)  
**Truth:** `parity-desktop` · CDP `:9230`  
**Related:** [auth-kern-1-f5-session-loss-investigation-2026-07.md](./auth-kern-1-f5-session-loss-investigation-2026-07.md) · CodaCtrl pathway rollup `.codectx/verify/salvage-rollup-latest.md`

---

## Session gate

```text
HANDOFF ATOMIC STEP: Rust Slice 1 (R-AUTH) — auth boot
PAUSED / CANCELLED:  community · O-2/O-4 · COM-RUN-* · RIW-8 · Dev Lab · relay-publish / dm-persist rewrites
CANONICAL OWNER:     auth-kernel-boot-owner.ts + apps/desktop/src-tauri/src/commands/auth_boot.rs
PROOF BEFORE DONE:   L1 kern contracts · cargo rc1 auth_boot · L3 unlock→F5→unlocked (CDP digest)
OUT OF SCOPE:        UI kit · relay dual-owners · DM persist · AUTH-SESSION-1 scatter revival
```

---

## Goal (user-visible)

After unlock on Tester1, **F5 / WebView reload** returns to unlocked main shell **without** Welcome Back, via existing AUTH-KERN-1 path (not a second restore owner).

Secondary: reduce post-F5 wait when restore succeeds (reconcile/retry budget).

---

## Keep-set (mutable)

From freeze-set: `@dweb/auth`, `@dweb/desktop`, transport packages, `@obscur/auth-engine`, `@obscur/engine-host`, `libobscur`, `obscur_desktop_lib`, `pwa` (auth-kernel / auth / profiles adapters only).

**Frozen:** `@dweb/ui-kit`, website, relay-gateway, conduit-mesh, crypto, … — no edits.

---

## Canonical path (do not add parallel)

```
Unlock → init_native_session → OS keychain nsec::{profileId}
F5 → desktop-window-boot reconcile → runAuthKernelBootRestore
  → AuthBootSnapshot (Rust auth_boot_snapshot)
  → retryAuthKernelNativeSessionUnlock
  → identity unlocked
AuthGateway: overlay while !settled · fail-closed ≤2.5s (already shipped)
```

| Concern | Single owner |
|---------|----------------|
| Boot restore loop | `auth-kernel-boot-owner.ts` |
| Rust hydrate | `commands/auth_boot.rs` → `force_session_restore_for_window` |
| Overlay hang | `auth-gateway.tsx` (fail-closed — keep) |

**session-hydrate:** already single-owner (CodaCtrl).  
**profile-scope:** dual (7 path-heuristic writers) — **subtract or demote to readers** before adding any new scope writer; preferred owner: `auth-kernel-profile-scope.ts` + `resolve-desktop-window-profile-scope.ts` for desktop window bind.

---

## Hypotheses to discriminate (CDP required)

| ID | Hypothesis | Digest signal |
|----|------------|---------------|
| H1 | Keychain missing for profile | `auth.kernel_boot_restore_no_keychain` |
| H2 | Restore runs, unlock fails | `…_mismatch` / `…_exhausted` · no `…_succeeded` |
| H3 | Overlay settles before unlock finishes | settle vs unlock timeline |
| H4 | Profile scope wrong on F5 | `…_profile_scope_violation` |
| H5 | Manual lock sticky | `…_manual_lock` |
| H6 | Persist error after unlock | `obscur_native_session_persist_error::*` |

**Capture verdict (2026-07-30):** **H2 confirmed** (+ H3 self-wait contributor). H1/H4/H5/H6 ruled out. See investigation evidence table.

---

## Implementation order (after capture)

1. **Capture** — unlock → F5 → digest + console; classify H1–H6 ✅  
2. **Repair A** — `desktop-window-boot`: `runAuthKernelBootRestore({ skipBootWait: true })` (remove self-wait)  
3. **Repair B** — `waitForAuthKernelBootRestore`: drive restore when reconcile ends with no in-flight owner (no empty settle)  
4. **Observability** — per-attempt `auth.kernel_boot_restore_attempt` outcomes  
5. **Prove**  
   - L1: `auth-kernel-kern-*.contract.test.ts`  
   - L3: CDP unlock→F5→chat on `:9230` · expect `auth.kernel_boot_restore_succeeded` · not Welcome Back

---

## Forbidden

- Second JS restore loop in `auth-gateway` / `use-identity`
- Touching freeze-set packages
- Claiming fixed on RC0 / unit alone
- Expanding into DM / relay / community

---

## Operator checklist (Studio)

1. `pnpm dev:desktop:online` (or parity) with CDP `:9230`  
2. Monitor → Scan shows ≥1 CDP target · Connect  
3. Unlock Tester1 → F5 → Capture digest → Export report  
4. Agent: `client_session_connect` → digest → proceed hypothesis → patch
