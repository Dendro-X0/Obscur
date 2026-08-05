# Investigation — R4 persist smoke (send → reload → marker)

**Date (UTC):** 2026-08-02  
**Handoff:** Demo exit residual · R4 persist smoke  
**Parent:** [production-truth-release-recovery-2026-08.md](../../docs/program/production-truth-release-recovery-2026-08.md)

---

## Session header

```text
NEXT ATOMIC STEP:     R4 persist smoke (maintainer chose)
PAUSED / CANCELLED:   COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab as ship proof · AUTH-SESSION
CANONICAL OWNER:      DM thread history hydrate (native SQLite) — smoke only
PROOF BEFORE DONE:    pnpm verify:r4-persist-smoke · marker visible after WebView reload
OUT OF SCOPE:         O-2 repair patches · Dev Lab synthetic send · process-kill cold restart as required gate
```

---

## Pass contract (smoke)

| Step | Pass |
|------|------|
| Attach | Tester1 CDP shell unlocked (production-parity) |
| Send | UI compose marker `R4-PERSIST-*` visible locally (no Dev Lab `sendSyntheticDm`) |
| Disrupt | Native WebView `reload` (automated proxy for quit→relaunch) |
| Recover | Shell interactive again (unlock if needed — no AUTH-SESSION product work) |
| Assert | Same marker visible in Tester2 thread after reopen |

**Honest bound:** Reload ≠ OS process kill. Full cold restart remains O-2 class (PAUSED as repair). This slice is **soak smoke only**.

---

## Non-goals

- Fixing O-2 / O-4
- Claiming v1.9.15 or public Nostr SLA
- Dual-window receive re-proof (Soft L3 already owns that)

---

## Fix direction

Agent harness only unless Fail with clear hydrate evidence. No product diffs in first iteration.
