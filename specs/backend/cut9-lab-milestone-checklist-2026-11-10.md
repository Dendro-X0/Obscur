# Cut 9.5 — Lab milestone checklist (Continuity M2 auto-DC)

**Date:** 2026-11-10  
**Status:** documented + headless soak · **≠ Continuity Pass** · **≠ Soft L3 Fixed** · **≠ Tor Verified** · **≠ Matrix promote**  
**Parent:** [cut9-continuity-m2-auto-dc-design-2026-11-10.md](./cut9-continuity-m2-auto-dc-design-2026-11-10.md)

```text
HANDOFF ATOMIC STEP: Cut 9 Continuity M2 auto-DC — Continuity Pass still not claimed
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass · M5
CANONICAL OWNER:     Continuity Plane 3 · publishSealedSnapshotToHome
PROOF:               checklist below · cut9-lab-continuity-m2-soak.mjs · ≠ Continuity Pass
```

## Goal

Operator soaks **Continuity M2 publish/restore to private home** without claiming Continuity Pass. Background auto-schedule remains deferred.

## Preconditions

- [x] Cut 8 CLOSED (M1 seal)
- [x] Cut 9.0–9.4 L1 green
- [ ] Soft L3 remains **paused**
- [ ] Unlock ≠ Continuity understood by operator

## Soak steps

| # | Step | Expect | Not claim |
|---|------|--------|-----------|
| 1 | `pnpm verify:cut9-5` | Headless L1 Pass | Continuity Pass |
| 2 | Continuity panel shows Publish/Restore home | M2 actions visible | Soft L3 Fixed |
| 3 | Optional lab `/v1` publish→fetch | Opaque sealed blob only | Continuity Pass |
| 4 | Confirm DM threads not used as Continuity store | Dedicated `/v1/continuity/backups` | Soft L3 lookback OK |

### Headless command

```bash
node scripts/cut9-lab-continuity-m2-soak.mjs
# or: pnpm verify:cut9-5
```

## Forbidden claims

- Continuity Pass  
- Soft L3 Fixed · Tor Verified · Matrix promote  
- Unlock recreates wiped PC  
- Background auto-backup scheduled  

## NEXT after 9.5

Maintainer may charter Soft L3 resume · Vite product-depth · M4 pair · Continuity Pass promote. Continuity Pass remains unclaimed until explicit promote.
