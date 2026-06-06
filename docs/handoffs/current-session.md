# Current Session Handoff — Obscur (native-first)

- Last Updated (UTC): 2026-06-02T16:35:00Z
- Git SHA: `a782e61d` + ACC-04 call history read (uncommitted)
- Session Status: **Native ancillary SQLite complete · call cards read sqlite on native**

## North star

**[obscur-native-sqlite-policy.md](../program/obscur-native-sqlite-policy.md)** — native SQLite owner matrix. Persistence claims: `pnpm verify:p5-persistence` (**64 tests**).

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

## Native ancillary SQLite (ACC-03/04)

| Band | Module | Behavior |
|------|--------|----------|
| ACC-03 | `relay-checkpoint-sqlite-store.ts` | Mirror `dm:all` → per-relay SQLite on sync + restore |
| ACC-04 | `call-record-sqlite-store.ts` | Terminal calls → `call_records`; DM invite cards merge sqlite summaries |

---

## Next atomic step

1. Push 16-commit stack when ready (`origin/main` behind).
2. Product matrix / manual smoke only when maintainer chooses — CI gates are the bar.
