# Current Session Handoff — Obscur (native-first)

- Last Updated (UTC): 2026-06-02T16:30:00Z
- Git SHA: `990524ae` + ACC-03 relay checkpoint owner (uncommitted)
- Session Status: **P5 exited · ACC-03 native relay checkpoints wired**

## North star

**[obscur-native-sqlite-policy.md](../program/obscur-native-sqlite-policy.md)** — native SQLite owner matrix. Persistence claims: `pnpm verify:p5-persistence` (**54 tests**).

---

## Diagnosis (user-confirmed)

- **Groups (Test 8):** Terminal **local leave intent** hides communities — not missing SQLite create. Banner *relay declined* = publish failed after local exit; does not restore.
- **DM ~7 days:** Default retention is **unlimited** (`localMessageRetentionDays: 0`). Loss when SQLite never owned the thread and relay live window (7d `since`) was the only path — **not** a built-in 7-day delete policy.

---

## Landed @ `1ec2e385` / `4f776559` / `ac682c11`

STAB settings, DM quorum, native drift skip, auto-disband seeded roster, native group list sync on add/update.

---

## P5

| Band | Module | Gate |
|------|--------|------|
| P5-DM-2 | `dm-conversation-hydrate-indexed-scan` | 8-day-old SQLite row survives hydrate test |
| P5-COM-2 | `community-leave-recovery.ts` | Revoke rejected leave → ledger `joined`, clear outbox/tombstone |
| P5-COM-2 UX | `use-restore-rejected-community-leaves` + summary banner | Bulk restore + `addGroup(allowRevive)` |
| P5-BKP-1 | `encrypted-account-backup-service` native restore | Strip bodies before chat-state replace; skip hydrateMessages |
| P5-DM-1 | `message-persistence-service.test.ts` | SQLite write on confirmed eventId |
| P5-DM-3 | `p5-persistence-authority-gates.test.ts` | 7d lookback only in `dm-relay-transport.ts` |
| P5-COM-3/4 | auto-disband + sqlite sync | existing tests |
| Script | `pnpm verify:p5-persistence` | **54 tests pass** |

---

## ACC-03 (uncommitted)

| Owner | Module | Behavior |
|-------|--------|----------|
| Relay checkpoints | `relay-checkpoint-sqlite-store.ts` | Mirror `dm:all` → per-relay `dbUpsertRelayCheckpoint` on sync + restore |
| Bootstrap | `bootstrapTimelineCheckpointsFromSqlite` | Cold start seeds localStorage from SQLite max frontier |

**Not yet:** ACC-04 voice call records → SQLite.

---

## Next atomic step

1. ACC-04: `call_records` sqlite owner (voice-call-crdt in-memory today).
2. Manual Phase B matrix remains **out of scope**; CI gates are the bar.
