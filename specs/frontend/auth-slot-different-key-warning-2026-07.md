# Frontend spec — Occupied window / different-key warning

**Backend design:** [auth-slot-different-key-warning-design-2026-07.md](../backend/auth-slot-different-key-warning-design-2026-07.md)  
**Surface:** Auth lock screen (`AuthScreen`) — Import Key tab + existing inline conflict region

## Goal

When the user pastes/imports a private key for an account that is **not** the occupant of this profile window, show a clear warning with recovery actions — not a dead-end “key mismatch” / “incorrect password” only.

## Composition (reuse)

- Keep single amber **inline** region (`ProfileSlotAccountConflictInline`) under the auth card actions.
- No new modal; no hero redesign; no cards beyond existing conflict panel.

## Copy (en)

| Key | Text |
|-----|------|
| Title | This window already has an account |
| Body | **{{profileLabel}}** on this device already holds local data for another account. Signing in with a different private key here would mix two identities in one window. |
| Hint | Open a **new profile window** for the other account (recommended), or **reset this window’s local data** (optionally export an archive first), then import again. |
| Actions | Open another profile window (recommended) · Clear this window and continue · Export archive, then switch · Cancel |

Show occupant username when known (e.g. DemoUser); otherwise short pubkey prefix.

## States

| State | UI |
|-------|-----|
| Import key matches occupant | No conflict panel |
| Import key ≠ occupant (typed or on Continue) | Conflict panel visible; pending import retained for Clear/Export retry |
| User Cancel | Clear conflict + pending |

## A11y

- `role="region"` + aria-label retained
- Buttons keyboard reachable; busy disables actions
