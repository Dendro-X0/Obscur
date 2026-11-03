# Investigation — FM1 L3: Auth gate while native session active (2026-11)

**Status:** Closed for root cause · fix design + L1 landed · L3 re-soak owed  
**Handoff:** `docs/handoffs/current-session.md` — FM1 L3 fix  
**L3 artifact:** `docs/handoffs/single-door-fm1-l3-soak-latest.{md,json}` (Fail 2026-11-02)  
**Parent FM1:** [single-door-unlock-loop-investigation-2026-11.md](./single-door-unlock-loop-investigation-2026-11.md)

```text
HANDOFF ATOMIC STEP: FM1 L3 fix — AuthGateway/shell must not stay on unlock UI when session active
PAUSED / CANCELLED: Soft L3 · Tor Verified · Continuity promote · Matrix promote
CANONICAL OWNER:    Auth (session lifecycle) · desktop SessionState
PROOF BEFORE DONE:  L1 unit · L2 contract · optional CDP L3 re-soak
SURFACE:            Tauri desktop
```

## Evidence (L3)

1. Title-bar Lock → PROFILE LOCKED / Auth gate observed.
2. Password / Import Key reentry did **not** reach messenger shell.
3. Final probe: Auth shows Import Key / PRIVATE KEY while `get_session_status.is_active === true` (same Tester1 npub).
4. Prior FM1 L1/L2 (bind-pending remount) already landed — this L3 fail is a **different amplifier**.

## Ranked failure modes

### FM1-L3-A — Status / ensure_session auto-hydrate undoes lock (HIGH — matches artifact)

**Mechanism**

1. Lock path: JS `lockIdentity` / `lockSession` → `clear_native_session` → in-memory keys removed (keychain kept for stay-signed-in).
2. `session_status_for_window` (`get_session_status`) **rehydrates from OS keychain** whenever memory is empty.
3. `get_native_npub` / `ensure_session` does the same.
4. `auth_boot_snapshot` with `restore_eligible: false` (manual lock) still calls `session_status_for_window` when keychain present → **side-effect hydrate** even though boot phase returns `"locked"`.
5. JS `SessionApi.getSessionStatus` further calls `get_native_npub` when status appears inactive (`NATIVE_SECURE_SESSION_RESTORE_ENABLED`).

**Result:** After Lock, native session reports active while JS identity stays locked (manual-lock blocks boot restore). Auth correctly mounts; any consumer of `is_active` sees a half-state. Unlock UX feels stuck / silent when UI is on Import Key or controls no-op against already-active native session.

### FM1-L3-B — Classic bind-pending hold with lost bind UI (MEDIUM — already L1/L2)

Identity unlocked + module bind-pending + Auth remount lost bind form. Mitigated in unlock-loop fix design; still possible if Gateway React state desyncs from module flag (silent early-return when Gateway thinks pending / module does not).

### FM1-L3-C — CDP fills wrong control / Import Key Unlock with empty nsec (LOW — harness)

Unlock-retry attaches already on Import Key; password fill + Unlock may not hit `handleLoginUsername`. Does not explain `is_active: true` by itself.

## Non-goals

- Soft L3 / Tor Verified / Continuity / OAuth
- Deleting keychain on Lock (stay-signed-in / restart restore must remain)
- Claiming L3 Pass without re-soak

## Fix direction (subtraction)

1. **Observational status:** `get_session_status` / `session_status_for_window` must not mutate session (no keychain hydrate).
2. **Lock latch:** after `clear_native_session`, suppress keychain auto-hydrate for that profile until explicit `set_keys` / force restore / init.
3. **JS status API:** while auth-kernel manual lock is active, do not call `get_native_npub` as a status fallback.
4. Explicit restore paths unchanged: `desktop_force_session_restore`, unlock `applyNativeSessionPersistence`, `auth_boot_snapshot` when `restore_eligible`.

## Proof plan

| Layer | Check |
|-------|--------|
| L1 | Rust/unit or vitest: after clear, status inactive; force restore / set_keys re-enables hydrate |
| L2 | SessionApi: manual lock → inactive status without `get_native_npub` |
| L3 | Desktop CDP: lock → status inactive → password → shell (optional this slice) |
