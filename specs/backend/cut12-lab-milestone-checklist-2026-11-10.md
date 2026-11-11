# Cut 12.5 — Lab milestone checklist (Continuity M5 linked devices)

**Date:** 2026-11-10  
**Status:** **CLOSED** (2026-11-10) · headless soak Pass · **≠ Continuity Pass** · **≠ Soft L3 Fixed** · **≠ live multi-device sync**  
**Parent:** [cut12-continuity-m5-linked-devices-design-2026-11-10.md](./cut12-continuity-m5-linked-devices-design-2026-11-10.md)

```text
HANDOFF ATOMIC STEP: Cut 12 Continuity M5 linked-device registry — Continuity Pass still not claimed
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass · live delta sync
CANONICAL OWNER:     Continuity Plane 3 · enrollThisDevice / revokeLinkedDevice
PROOF:               checklist below · cut12-lab-continuity-m5-soak.mjs · ≠ Continuity Pass
```

## Goal

Operator soaks **M5 enroll/revoke registry** without claiming Continuity Pass or live multi-device sync.

## Soak steps

| # | Step | Expect | Not claim |
|---|------|--------|-----------|
| 1 | `pnpm verify:cut12-5` | Headless L1 Pass | Continuity Pass |
| 2 | Continuity → Enroll this device | Device listed | Live sync |
| 3 | Revoke | revoked marked | Soft L3 Fixed |

### Headless command

```bash
node scripts/cut12-lab-continuity-m5-soak.mjs
# or: pnpm verify:cut12-5
```

## Forbidden claims

- Continuity Pass  
- Soft L3 Fixed · Tor Verified · Matrix promote  
- Live multi-device delta sync shipped  

## NEXT after 12.5

Maintainer may charter Soft L3 resume · Continuity Pass promote · M6 backfill · deeper Settings.
