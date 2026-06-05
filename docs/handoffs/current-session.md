# Current Session Handoff — Obscur (native-first)

- Last Updated (UTC): 2026-06-02T01:38:00Z
- Git SHA: `f22cfa0b`
- Session Status: **v1.9.4 — P4-5 subtraction queue item 1 landed (local)**

## North star (read first)

**[ui-render-loop-systemic-program.md](../program/ui-render-loop-systemic-program.md)** — render-loop CI bands R1–R3.

**[obscur-native-sqlite-policy.md](../program/obscur-native-sqlite-policy.md)** — native owner matrix + subtraction queue.

Manual Phase B matrix **de-prioritized** for loop hunting; product §2–§3 when maintainer chooses.

---

## Committed this session

| SHA | Summary |
|-----|---------|
| `f2f0ee83` | P4-5 — native SQLite list authority; backup restore body strip; group message guard |
| `a436a168` | API `_api` → `api`, desktop packaging helpers, main-shell UV-RUNTIME-1 route-churn test |
| `2a1badf7` | STAB-R — relay/window render loop fix + CI gates |

**Gates @ `f2f0ee83`:** `pnpm verify:stability` **Pass**

---

## P4-5 subtraction — repair shims removed (uncommitted)

- Deleted `dm-conversation-native-outgoing-repair.ts` + `dm-conversation-native-invite-repair.ts` (+ tests).
- Hydrate pipeline reads SQLite only — no chat-state repair merge on native.
- `runSecondaryProfileDmSoftRefresh` dispatches sqlite index rebuild + re-hydrate event (no chat-state reads).

Outgoing/invite writes already land in SQLite via `message-persistence-service` flush and `commitOutboundCommunityDmInvite`.

**Gates (local):** `pnpm verify:stability` **Pass**

---

## P4-5 subtraction band (`f2f0ee83`)

1. **SQLite list authority** — `messaging-provider` merges `createdConnections` metadata only (not chat-state message threads) when authority is `sqlite`.
2. **Native backup restore** — `stripChatStateMessageBodiesForNativeMirror` strips DM/group bodies before chat-state replace on Tauri.
3. **STAB guard** — `group-home-page-client` null-safe `groupState.messages`.

Tests: `messaging-provider.hydration-scope` (native ghost thread), `restore-merge-chat-state.native`, `dm-conversation-list-merge`.

---

## Next atomic step

1. Commit repair-shim subtraction; run `pnpm release:test-pack -- --skip-preflight`.
2. Subtraction queue remainder: wire relay checkpoint / call record owners (policy item 4).
3. Optional: shell boot render-count test if maintainer still sees launch crashes outside CI.
