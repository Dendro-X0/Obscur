# Phase 2 — Desktop DM survives restart (SQLite)

**Status:** Complete (automated + manual G6-3 soak)  
**Last updated:** 2026-05-24  
**Prerequisite:** Phase 1 G1–G5 signed off ([phase1-desktop-shell-gate.md](./phase1-desktop-shell-gate.md))  
**Next:** [phase3-desktop-online-gate.md](./phase3-desktop-online-gate.md)  
**Policy:** [obscur-native-sqlite-policy.md](./obscur-native-sqlite-policy.md) (P3a–P3b)

---

## What Phase 2 proves

Two desktop profiles (Tester A / B) can exchange DMs while relay transport is on; after **full app restart**, each profile still sees:

- The **conversation** in the sidebar (SQLite `conversations` table)
- The **message thread** when opened (SQLite `messages` + tombstones)

Community, coordination, and invite flows remain **out of scope**.

---

## Dev command (two-profile soak) — no Docker required

**Do not use Docker** for Phase 2 unless you explicitly want a local relay. Firewall/disk constraints are expected; public relays are the default path.

**Single terminal:**

```bash
pnpm dev:desktop:online
```

New profiles ship with **wss://relay.damus.io** and **wss://nos.lol** enabled (`use-relay-list.ts`). `ws://localhost:7000` stays disabled unless you opt in.

`pnpm dev:relay` only prints that Docker is optional and exits successfully — it does **not** start containers.

Open **two** desktop windows (Profile A dark, Profile B light). See [verification-environment.md](../assets/demo/verification-environment.md).

| Check | Pass when |
|-------|-----------|
| Relays | Settings → Relays shows at least one **enabled** `wss://` relay (green/connected or degraded, not permanently offline) |
| Transport | `dev:desktop:online` (not plain `dev:desktop`) so DM send/receive is active |

Optional local relay (Docker only): `pnpm dev:relay:docker` then enable `ws://localhost:7000` in Relays.

Phase 1 shell QA: `pnpm dev:desktop` (offline stubs).

---

## Automated evidence

```bash
pnpm verify:phase2
```

Includes Phase 1 bundle plus:

- Conversation list SQLite authority
- Message persistence → `db_insert_message` on Tauri (even when `chatPerformanceV2` is off)
- DM hydrate window from SQLite
- DM read authority (native = SQLite, no IndexedDB fallback)

---

## Manual script (~15 min)

| Step | Tester A | Tester B | Pass when |
|------|----------|----------|-----------|
| P2-1 | Unlock | Unlock | Both shells interactive |
| P2-2 | Start DM with B's pubkey | Accept / reply | Messages visible both sides |
| P2-3 | — | — | Sidebar shows thread on **both** without navigating away |
| P2-4 | Quit app completely | Quit app completely | Processes ended |
| P2-5 | `dev:desktop:online` + unlock | Same | Cold start OK (Phase 1) |
| P2-6 | Open same DM | Open same DM | **Prior messages still visible** |
| P2-7 | A: Delete-for-me on one message | — | Message hidden for A |
| P2-8 | Quit + restart A | — | Deleted message **still hidden** for A |

Optional P2-9: B still sees message (cooperative delete-for-everyone is a later milestone).

---

## Code invariants (2026-05-24)

| Invariant | Owner |
|-----------|--------|
| Native list authority = SQLite | `conversation-list-authority.ts` |
| Message bus → SQLite flush on Tauri always | `message-persistence-service.ts` (`usesBatchedPersistence`) |
| No UUID-only rows on Tauri | `queueMessageUpsert` + flush guard |
| Sidebar refresh after flush | `dispatchMessagesIndexRebuiltEvent` + `messaging-provider` |
| Thread hydrate from SQLite | `dm-conversation-hydrate-indexed-scan.ts` |

---

## Sign-off

| Step | Date | Pass |
|------|------|------|
| `pnpm verify:phase2` | 2026-05-22 | ✓ |
| P2-1 … P2-6 (restart thread) | 2026-05-24 | ✓ (G6-3 maintainer sign-off) |
| P2-7 … P2-8 (delete-for-me restart) | | Optional |

---

## Out of scope

- Community invites / membership sync
- Delete-for-everyone across profiles (relay + protocol band)
- Android P1 / production signing
- Production web / PWA installer
