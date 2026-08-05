# Investigation — dm-persist dual-owner subtraction

**Date (UTC):** 2026-08-04  
**Handoff:** MRI remediate · RWR refactor · post Track B re-dogfood  
**Parent:** [production-truth-release-recovery-2026-08.md](../../docs/program/production-truth-release-recovery-2026-08.md) · [codactrl-improvement-findings-2026-07.md](../../docs/program/codactrl-improvement-findings-2026-07.md) § Round 2026-08-04  
**Owner conflict:** `studio_owner_conflicts_get` lifecycle `dm-persist`

---

## Session header

```text
NEXT ATOMIC STEP:     dm-persist dual-owner subtraction (investigation)
PAUSED / CANCELLED:   COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab as ship proof · AUTH-SESSION
CANONICAL OWNER:      messaging message-persistence / thread-history (TBD in design)
PROOF BEFORE DONE:    Investigation spec → design with one owner + subtraction list · L1 then Soft L3/R4 when desktop up
OUT OF SCOPE:         groups/** product features · COM-RUN · AUTH-SESSION · O-2 cold restart repair · profile-scope
```

---

## Why this slice

MRI verdict **`remediate`**. RWR mode **`refactor`** — reduce dual-owner hotspots with small blast radius.  
`dm-persist` is the only dual-owner lifecycle that is **not** blocked by AUTH-SESSION or COM-RUN pause (groups writers may be quarantined / stop-writing only).

Writers flagged by CodaCtrl:

| Path | Role suspicion |
|------|----------------|
| `apps/pwa/app/features/messaging/services/message-persistence-service.ts` | DM persist candidate canonical |
| `apps/pwa/app/features/messaging/components/message-persistence-durability-owner.tsx` | UI/durability owner |
| `apps/pwa/app/features/messaging/services/thread-history/workspace-group-message-persist-port.ts` | Group thread port (may be separate lifecycle) |
| `apps/pwa/app/features/groups/services/sealed-group-message-persistence.ts` | Group sealed persist — **not** DM; path-heuristic collision |

---

## Pass contract (investigation)

| Check | Done when |
|-------|-----------|
| Canonical DM persist owner named | One module owns outgoing DM durability |
| Parallel writers listed | Path + call-graph evidence |
| Subtraction plan | What stops writing / what stays group-only |
| No COM-RUN feature work | Groups sealed persist kept for groups only or quarantined from `dm-persist` taxonomy |

**No code** until design exists.
