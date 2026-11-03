# Single-door unlock loop — fix design (2026-11)

Parent: [single-door-unlock-loop-investigation-2026-11.md](./single-door-unlock-loop-investigation-2026-11.md)

## Goal

Break the L3 soak loop: after Advanced key unlock with closed PDK, user must **see and complete** device-password bind; Auth must not silently no-op or snap back to Log In.

## Slice L1 (this change)

### 1. Module owns bind-required UX

Extend `device-password-bind-pending` (or sibling) so pending implies **required bind UI**, not only AuthGateway hold:

- `setDevicePasswordBindPending(true)` ⇒ AuthScreen on mount / subscribe **forces** `loginTab=key`, `importKeyGuideStep=set_device_password`, `devicePasswordBindRequired=true`.
- Clearing pending clears local bind flags.

### 2. Stop silent early-return while bind-pending

In `handleLoginUsername` / `handleLoginFinal` / import continue:

- If `isDevicePasswordBindPending()` and identity already unlocked → do **not** treat as `appShellUnlocked` success; surface bind UI (or run bind if passwords present).
- Prefer: `appShellUnlocked` for early-return uses same gate as gateway (`isShellReady` semantics): identity unlocked **and** not bind-pending.

### 3. Tab clicks must not abandon required bind

While bind-required / module pending: Log In ↔ Import Key tab handlers must not reset `importKeyGuideStep` to `enter_key`.

### 4. Copy (minimal)

If password submit while bind-pending: short error pointing at device-password bind (not “incorrect password”).

## Out of scope this slice

- Nostr decoupling / remove keys
- Continuity
- Full identity-wrap recovery UX when password truly unknown (FM2 education)

## Proof

Same table as investigation L1–L3.
