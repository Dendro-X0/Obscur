# Native persistence policy — SQLite (desktop + mobile)

**Status:** Active (2026-05-22)  
**Supersedes:** Dual IndexedDB + SQLite authority on Tauri/desktop  
**Aligns with:** [obscur-2.0-milestone-roadmap.md](./obscur-2.0-milestone-roadmap.md) Lane P3, [greenfield/04-architecture-sketch.md](../greenfield/04-architecture-sketch.md), [platform-pivot-private-trust-2026-05.md](./platform-pivot-private-trust-2026-05.md)

---

## Policy (one sentence)

**On native runtime (desktop Tauri, mobile shell), all durable product state lives in SQLite via `libobscur` / Tauri `db_*` commands — not IndexedDB, not chat-state localStorage as authority.**

Production web is disabled (`native-runtime-gate`); dev browser harness may keep IndexedDB for local iteration only.

---

## Surfaces

| Surface | Persistence | QA |
|---------|-------------|-----|
| Desktop (Tauri) | SQLite only | Multi-profile windows |
| Mobile (Tauri) | SQLite only | Emulator + device |
| Browser dev / PWA local | IndexedDB + projection (legacy) | Not production target |
| Production web | **Disabled** | N/A |

---

## Domains (convergence order)

| Domain | SQLite owner | Deprecate on native |
|--------|--------------|---------------------|
| DM messages + tombstones | `db_insert_message`, `db_delete_message`, tombstone tables | IndexedDB message store as read authority |
| DM conversations list | `db_get_conversations` | chat-state `createdConnections` as authority |
| Account projection event log | Migrate or mirror to SQLite (Lane P3) | IDB-only replay that resurrects deletes |
| Community / groups local cache | `db_*` group tables | IDB group projections |
| Delete-for-me / cooperative redaction | SQLite tombstones + kernel projection | Fire-and-forget IDB writes |
| Settings / prefs | Profile-scoped SQLite or dedicated native store | Competing localStorage keys |

---

## Runtime detection

Use `hasNativeRuntime()` from `apps/pwa/app/features/runtime/runtime-capabilities.ts` (callable Tauri bridge) — **not** `isTauri()` from notifications.

Helper: `requiresSqlitePersistence()` in `native-persistence-policy.ts`.

---

## Authority rules (native)

1. **Conversation list** — always `sqlite` authority on native (even when empty).
2. **DM hydrate** — load window from SQLite first; IndexedDB recovery paths **off** on native.
3. **Deletes** — await SQLite tombstone + row delete before UI success; no parallel IDB purge as truth.
4. **Diagnostics** — log `NON_CANONICAL` if native code reads IndexedDB for production DM paths.

---

## Testing

- All product QA on **desktop**, two+ profile windows.
- Automated: extend `conversation-list-authority.test.ts`, DM hydrate tests with `hasNativeRuntime` mocked true.
- No requirement to keep web/desktop parity tests green for native-only bands.

---

## Relation to Nostr / communities

SQLite fixes **local truth** and delete resurrection. **Roster join/leave across clients** still requires coordination directory (not Nostr relay authority). See [community-fork-decision-2026-05.md](./community-fork-decision-2026-05.md).

---

## Bands

| Band | Deliverable | Pass |
|------|-------------|------|
| **P3a** | Conversation list + policy doc | Native always `sqlite` authority — **Done** |
| **P3b** | DM hydrate native-only path | Delete-for-me survives restart (desktop) — **Done** (code); manual two-profile verify pending |
| **P3c** | Account projection native bootstrap | **Done** — seal-only import (tombstones + peer trust); DM timeline stays in SQLite; manual verify pending |
| **P3d** | Community tables native-only | Groups cache single owner |

---

## Do not

- Add new IndexedDB writes on native for DM/community features.
- Treat greenfield as the shipping shell for this policy (Obscur implements here).
- Promise cross-client delete-for-everyone until `TeamTransportPort` exists — SQLite enables local tombstones only.
