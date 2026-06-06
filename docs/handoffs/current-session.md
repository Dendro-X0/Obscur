# Current Session Handoff — Obscur (native-first)

- Last Updated (UTC): 2026-06-02T15:06:00Z
- Git SHA: `1ec2e385` + `P3d addGroup sqlite` (pending push)
- Session Status: **Stability band landed; P3d group list sync**

## North star

**[ui-render-loop-systemic-program.md](../program/ui-render-loop-systemic-program.md)** — Band R3 **STAB-SETTINGS-1** closed @ `1ec2e385`.

---

## Landed @ `1ec2e385`

| Band | Deliverable |
|------|-------------|
| STAB-SETTINGS-1 | Shared settings model + tab error boundaries + mount CI |
| STAB-P1 | Profile `revert()` unmount-only; `use-profile` setState dedup |
| DM send | `sent_quorum` when publish succeeds (no false 1/2 relay toast) |
| P4-5 drift | Skip message-domain drift on native SQLite authority |
| COM leave | Auto-disband uses seeded roster (`community-auto-disband-policy`) |

`pnpm verify:stability` **Pass** (47 tests + grep gates).

---

## Landed (follow-up commit)

**P3d:** `scheduleNativeGroupListSync` on `addGroup` / `updateGroup` — SQLite upsert at create time, not only hydrate.

---

## Test 8 / group disappearance (diagnosis)

Local **leave intent** (ledger + outbox + tombstone) hid the group — not missing SQLite rows. Banner *"relay declined"* = relay publish failed after local exit; does not restore membership. Auto-disband on stale CRDT roster could cascade to both profiles; seeded-roster guard @ `1ec2e385` mitigates.

**Recovery:** Fresh invite + `allowRevive`, or clear leave outbox / ledger `left` / tombstone for that `groupId@@relayUrl`.

---

## Next atomic step

1. Manual smoke: create community on desktop → restart → group still in Network list (SQLite + chat-state).
2. Manual smoke: creator leaves while member B visible in roster → B must keep group (no auto-disband).
3. Product matrix rows (DM/COM) when maintainer chooses.
4. Deferred: backup restore audit (`encrypted-account-backup-service.ts`); ACC-03/04 sqlite wiring (v2.0).
