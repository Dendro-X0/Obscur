# Frontend spec — Unlock identity sync + wrong-key surface

**Date:** 2026-11-01  
**Backend:** `specs/backend/profile-slot-unlock-display-sync-design-2026-11.md`

## Surfaces

1. **Auth login hero** — display name = resolve helper (profile store first). Same pubkey fragment under name.  
2. **Title-bar locked chip** — already profile-preview based; leave unless diverges after C1.  
3. **Identity Locked chip** (`LockScreen`) — same resolve helper as Auth.  
4. **Wrong key** — compact alert under key field: one line (“That key isn’t {{occupant}}”) + retry; link “Use a different account…” for switch panel.  
5. **Switch panel** — when expanded: `rounded-2xl`, full card width, title + 2 short lines max, stacked buttons with open-window primary; Cancel dismisses expand.

## Copy

| Key | EN |
|-----|-----|
| `auth.login.wrongKeyForOccupant` | That private key isn’t {{occupantLabel}}. Paste the key for this account, or use a different account below. |
| `auth.login.useDifferentAccount` | Use a different account in this window… |
| `auth.slotConflict.title` | Different account key |
| `auth.slotConflict.bodyOccupant` | This window holds {{occupantLabel}}. Opening another key here needs a new profile window or a reset. |
| `auth.slotConflict.hint` | Recommended: open another profile window. Clearing this window deletes local data for {{occupantLabel}}. |

## Non-goals

Welcome/create redesign · new brand colors · removing Advanced unlock.
