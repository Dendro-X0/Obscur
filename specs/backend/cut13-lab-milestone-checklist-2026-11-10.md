# Cut 13.5 — Lab milestone checklist (Continuity M6 home backfill)

**Date:** 2026-11-10  
**Status:** **CLOSED** (2026-11-10) · headless soak Pass · **≠ Continuity Pass** · **≠ Soft L3 Fixed** · **≠ invent CRM** · **≠ live multi-device sync**  
**Parent:** [cut13-continuity-m6-home-backfill-design-2026-11-10.md](./cut13-continuity-m6-home-backfill-design-2026-11-10.md)

```text
HANDOFF ATOMIC STEP: Cut 13 Continuity M6 private-home backfill — Continuity Pass still not claimed
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass · live delta sync
CANONICAL OWNER:     Continuity Plane 3 · backfillFromPrivateHome
PROOF:               checklist below · cut13-lab-continuity-m6-soak.mjs · ≠ Continuity Pass
```

## Goal

Operator soaks **M6 opaque envelope backfill from private home** without claiming Continuity Pass, Soft L3 Fixed, or CRM invent from chat.

## Soak steps

| # | Step | Expect | Not claim |
|---|------|--------|-----------|
| 1 | `pnpm verify:cut13-5` | Headless L1 Pass | Continuity Pass |
| 2 | Continuity → Backfill from private home | Report counts · opaque only | Soft L3 Fixed |
| 3 | Plaintext home rows | Dropped + counted | CRM invent |

### Headless command

```bash
node scripts/cut13-lab-continuity-m6-soak.mjs
# or: pnpm verify:cut13-5
```

## Forbidden claims

- Continuity Pass  
- Soft L3 Fixed · Tor Verified · Matrix promote  
- Live multi-device delta sync shipped  
- Relationship graph invented from message bodies  

## NEXT after 13.5

Maintainer may charter Soft L3 resume · Continuity Pass promote · peer history grants · deeper Settings · live M5 deltas.
