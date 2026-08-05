# Dual-owner B2 L3 — `engine_invoke` DM insert → cold restart

**Status:** VERIFIED (B2 path) · 2026-07-30T09:00Z  
**Does not claim:** Full UI DM send→persist (relays unreachable)

---

## Environment

| Item | Value |
|------|--------|
| Shell | `pnpm dev:desktop` · stamp `shell-2026-07-30T08:39:48Z` |
| CDP | `:9230` · sessions `csess-5b751121dbac` (pre) · `csess-534be36eada0` (post) |
| Profile | Tester1 · `profileId=default` |
| Relays | Public WSS TCP timeout · Docker daemon unavailable · UI `0/3` Offline |

---

## Proof steps

1. **Insert (pre-restart)** — CDP `Runtime.evaluate` → Tauri `engine_invoke`  
   `{ engine: "dm", method: "insertMessage", scope: { profileId: "default" }, payload: MessageRecord }`  
   Marker: `DUAL-OWNER-L3-1785401847396`  
   Conversation: `obscur:dev-lab:dm-kernel-write-probe`  
   Result: `{ ok: true, data: { inserted: true } }` · `db_get_messages` hit plaintext present
2. **Cold restart** — process exit + `OBSCUR_CDP_MAIN=9230 pnpm dev:desktop` relaunch
3. **Unlock** — Tester1 password → main shell
4. **Read (post-restart)** — `db_get_messages` same conversation → **hit** same `event_id` + plaintext

---

## Artifacts

| Kind | Path |
|------|------|
| Pre digest | `.codectx/verify/client-sessions/csess-5b751121dbac/captures/cap-2ef2531dc6c4/digest.json` |
| Post unlock snapshot | `.codectx/verify/client-sessions/csess-534be36eada0/captures/cap-b75853192f46/` |
| Post digest | `.codectx/verify/client-sessions/csess-534be36eada0/captures/cap-ee599d120dbe/digest.json` |

---

## Honesty / gaps

| Claim | Status |
|-------|--------|
| B2 write port shape (`engine_invoke` + `request` wrapper) | Proved live |
| Row survives process kill + relaunch | Proved |
| UI composer send → confirmed `eventId` → bus flush → SQLite | **Not run** — public relays timed out; no local Docker relay |
| Product flush path (`writeDmKernelMessage` from MessagePersistenceService) | Same invoke command as probe; not separately instrumented this soak |

---

## Next

B3: migrate remaining product `dbInsertMessage` callers (backup-evidence first; community invite PAUSED allowlist) before tombstoning `db_insert_message`.
