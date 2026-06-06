# Current Session Handoff — Obscur (native-first)

- Last Updated (UTC): 2026-06-02T16:25:00Z
- Git SHA: `3569cd4d` + P5 BKP/DM authority gates (uncommitted)
- Session Status: **P5 persistence survival — BKP-1 + DM-1/3 gated; 40 tests pass**

## North star

**[p5-persistence-survival-contract.md](../program/p5-persistence-survival-contract.md)** — module rewrite for durable groups + DM history. Manual re-test of Test 8 **deferred**; only `pnpm verify:p5-persistence` gates count.

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
| Script | `pnpm verify:p5-persistence` | **40 tests pass** |

---

## Next atomic step

1. ACC-03/04 deferred bands (relay checkpoints / call records in SQLite) — only when product priority shifts.
2. Manual Phase B matrix remains **out of scope**; `verify:p5-persistence` is the bar.

**Explicitly out of scope until P5 exits:** manual Phase B matrix for persistence rows.
