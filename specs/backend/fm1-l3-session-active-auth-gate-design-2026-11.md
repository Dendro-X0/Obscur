# Design — FM1 L3: stop Auth/session half-state after Lock (2026-11)

**Status:** Implemented · L1 + L3 Pass (2026-11-02 soak)  
**Parent:** [fm1-l3-session-active-auth-gate-investigation-2026-11.md](./fm1-l3-session-active-auth-gate-investigation-2026-11.md)  
**Handoff:** FM1 L3 fix — Auth must not sit on unlock UI against a falsely active native session after Lock

```text
HANDOFF ATOMIC STEP: FM1 L3 fix — AuthGateway/shell must not stay on unlock UI when session active
CANONICAL OWNER:     desktop SessionState · SessionApi · clear_native_session
PROOF BEFORE DONE:   L1 SessionState/session_api · L2 optional · L3 re-soak when CDP up
```

## Invariants

1. **Lock clears memory and latches hydrate.** `clear_native_session` removes in-memory keys **and** sets per-profile `hydrate_suppressed` so keychain auto-load cannot silently undo Lock.
2. **Status is observational.** `get_session_status` / `session_status_for_window` report memory only — never call keychain hydrate.
3. **Explicit restore only.** Keychain → memory only via `set_keys`, `force_session_restore` / `hydrate_profile_session`, `init_native_session`, or `ensure_session` when **not** suppressed.
4. **`set_keys` clears the latch.** Any intentional unlock/init/force-restore re-enables hydrate for that profile.
5. **JS manual lock:** `SessionApi.getSessionStatus` skips `get_native_npub` fallback while `isAuthKernelManualLockActive(profileId)`.
6. **Keychain preserved.** Lock does not delete OS keychain (restart / eligible boot restore unchanged).

## Slice (this change)

| Surface | Change |
|---------|--------|
| `apps/desktop/src-tauri/src/session.rs` | `hydrate_suppressed: HashSet<profile_id>`; `clear` sets; `set_keys` clears; `is_hydrate_suppressed` |
| `session_status_for_window` | Memory-only (remove keychain rehydrate block) |
| `wallet::ensure_session` | Skip keychain hydrate when suppressed |
| `SessionApi.getSessionStatus` | Skip `get_native_npub` when manual lock active |
| Tests | SessionApi manual-lock case; Rust unit for suppress if cheap |

## Out of scope

- Soft L3 / Tor / Continuity
- Changing AuthGateway `isShellReady` bind-pending semantics (Slice A)
- Claiming L3 Pass without CDP re-soak

## Claim language

- **Implemented** after code + L1/L2 green
- **L3 Pass** only after soak artifact Pass
