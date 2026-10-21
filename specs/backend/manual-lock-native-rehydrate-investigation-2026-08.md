# Manual lock native rehydrate investigation (2026-08)

## Symptom

In `pnpm dev:desktop:online`, confirming **Lock Obscur** shows the success toast, but the user can land back on the unlocked shell instead of the auth screen.

## Runtime evidence

- UI: lock confirm dialog + `Obscur locked.` toast appear.
- Native logs from the same session:
  - `[SESSION] Native session cleared for profile default`
  - `[STORAGE] SQLite encrypted at rest.`
  - `[SESSION] Native session re-hydrated from OS keychain for profile default`
  - subsequent relay reconnects follow.

## Root cause

Manual lock currently sets a **browser-side** manual-lock flag and clears the **in-memory** native session, but native restore helpers can still repopulate the session from OS keychain during the same app run.

Two native paths are especially relevant:

1. `commands/session.rs`
   - `session_status_for_window()` rehydrates from keychain when memory is empty.
   - `force_session_restore_for_window()` rehydrates from keychain when asked to restore.
2. `wallet.rs`
   - `ensure_session()` rehydrates from keychain whenever a wallet-backed command runs without in-memory keys.

Because the manual-lock flag lives in JS `sessionStorage`, these native restore helpers do not know the user intentionally locked the profile.

## Fix direction

Introduce a native, profile-scoped **manual lock gate** in `SessionState`:

- `clear_native_session` marks the profile as manually locked.
- explicit unlock / `init_native_session` clears the manual lock.
- native restore helpers (`session_status_for_window`, `force_session_restore_for_window`, `wallet::ensure_session`) must refuse keychain rehydrate while manual lock is active.

This keeps keychain material for future unlock/restart restore, while preventing same-session background work from silently undoing a manual lock.

## Proof plan

- L1: targeted Vitest auth/runtime lock suites
- L2: targeted Rust/native unit coverage for the new manual-lock state
- L3: desktop dev smoke: unlock -> Lock Now -> auth screen persists until password/private-key unlock
