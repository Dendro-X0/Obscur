# Current Session Handoff — Obscur (native-first)

- Last Updated (UTC): 2026-06-02T16:20:00Z
- Git SHA: `46bd6a67` + P5 recovery UX (uncommitted)
- Session Status: **P5 persistence survival — recovery UX wired; CI gates green**

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
| P5-COM-3/4 | auto-disband + sqlite sync | existing tests |
| Script | `pnpm verify:p5-persistence` | 21 tests pass |

**Not yet:** P5-BKP-1 backup restore audit; P5-DM-1 write-before-success; P5-DM-3 hydrate/relay lookback grep gate.

---

## Next atomic step

1. P5-BKP-1: native backup restore subtraction (no chat-state DM body authority).
2. P5-DM-1: strengthen tests that accepted DM writes hit SQLite before UI success.
3. P5-DM-3: grep gate — hydrate paths must not use relay 7-day lookback constant.

**Explicitly out of scope until P5 exits:** manual Phase B matrix for persistence rows.
