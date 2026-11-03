# Design — Soft-lock SQLite closed while shell stays unlocked

**Date (UTC):** 2026-10-12  
**Status:** Slices 1–3 **L1 Pass** · [slice2](./soft-lock-sqlite-shell-drift-slice2-design-2026-10.md) · [slice3](./soft-lock-sqlite-shell-drift-slice3-design-2026-10.md) · L3 P5 deferred  

**Investigation:** [soft-lock-sqlite-shell-drift-investigation-2026-10.md](./soft-lock-sqlite-shell-drift-investigation-2026-10.md)

---

```text
HANDOFF ATOMIC STEP:  P5 group live — unblock send path honesty + plaintext reopen
PAUSED / CANCELLED:   M1 / ASE-2 / dialects
CANONICAL OWNER:      desktop DbState · storage_at_rest · use-chat-actions
PROOF BEFORE DONE:    L1 unit · L2 desktop build · L3 operator send on PB1A after unlock
```

---

## Goal

When the shell looks unlocked but `DbState.db` is `None`, group/DM send must not look like a relay failure. Prefer automatic reopen when safe; otherwise stop with an unlock instruction.

## Invariants

1. **Honesty:** Locked-DB errors never surface as “relay scope”.
2. **Safe reopen:** If no at-rest envelope exists, `desktop_db_ensure_open` may reopen plaintext SQLite without a passphrase.
3. **Encrypted envelope:** Requires PDK (`desktop_storage_at_rest_unlock` / Import Key). No silent decrypt.
4. **Hydrate only on display:** Peer name/avatar work stays separate; this band is storage readiness for writes.

## Slice 1 (this pass)

| Piece | Behavior |
|-------|----------|
| `DbState::ensure_open_for_writes` | Open if already open; else plaintext reopen; else locked error |
| `desktop_db_ensure_open` | Tauri command exposing that path |
| `ensureNativeSqliteOpenForWrites` | Try vault/PDK unlock first, then `desktop_db_ensure_open` |
| `handleSendMessage` | Gate before send; toast unlock copy on failure |

## Out of scope (later)

- Force full auth-gate UI overlay when drift detected at boot
- Soft Lock menu CDP reliability
- Changing Soft Lock semantics themselves

## Proof

- L1: JS unit for ensure helper mapping; existing locked-DB toast tests stay green
- L2: `pnpm build:pwa-shell` + desktop run
- L3: Operator unlock if encrypted → invite Tester2 on `PB1A-1791732571` → dual send → EG-LOG `group live`
