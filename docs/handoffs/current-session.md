# Current Session Handoff — Obscur (native-first)

- Last Updated (UTC): 2026-06-02T17:00:00Z
- Git SHA: `ab465e40` @ `origin/main`
- Session Status: **P5 + ACC-03/04 shipped · CI gates green**

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
| Script | `pnpm verify:p5-persistence` | **64 tests pass** |

---

## Native ancillary SQLite (ACC-03/04)

| Band | Module | Behavior |
|------|--------|----------|
| ACC-03 | `relay-checkpoint-sqlite-store.ts` | Mirror `dm:all` → per-relay SQLite on sync + restore |
| ACC-04 | `call-record-sqlite-store.ts` | Terminal calls → `call_records`; DM invite cards merge sqlite summaries |

---

## CI evidence (2026-06-02)

| Gate | Result |
|------|--------|
| `pnpm verify:p5-persistence` | **64 passed**, 5 skipped |
| `pnpm verify:stability` | **green** (phase1–3, react stability, gateway/transport boundaries) |

---

## Next atomic step

1. Pick next **v1.9.4 Phase B** product row from [unified-verification-matrix.md](../program/unified-verification-matrix.md) when maintainer chooses — persistence claims stay on CI (`verify:p5-persistence` + `verify:stability`).
2. Optional: desktop smoke (`pnpm dev:desktop:online`) for Test 8 **Restore communities** UX — not required for ship evidence.
