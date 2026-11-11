# Cut 7.5 — Lab milestone checklist (Continuity M1 / F-sync C0)

**Date:** 2026-11-10  
**Status:** documented + headless soak · **≠ Continuity Pass** · **≠ Soft L3 Fixed** · **≠ Tor Verified** · **≠ Matrix promote**  
**Parent:** [cut7-continuity-m1-sealed-file-design-2026-11-10.md](./cut7-continuity-m1-sealed-file-design-2026-11-10.md)

```text
HANDOFF ATOMIC STEP: Cut 7 CLOSED (7.0–7.5 L1 + checklist) — Continuity Pass still not claimed
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass · M5 linked devices
CANONICAL OWNER:     Continuity / account-sync Plane 3 · desktop-ui Continuity door
PROOF:               checklist below · cut7-lab-continuity-m1-soak.mjs · ≠ Continuity Pass
```

## Goal

Operator soaks **Continuity M1 law + Vite door** without claiming Continuity Pass. Real sealed export/import may still use Next Settings until native adapter.

## Preconditions

- [x] Cut 7.0–7.4 L1 green
- [ ] Soft L3 remains **paused**
- [ ] Unlock ≠ Continuity understood by operator

## Soak steps

| # | Step | Expect | Not claim |
|---|------|--------|-----------|
| 1 | `pnpm verify:cut7-5` | Headless L1 Pass | Continuity Pass |
| 2 | Vite shell → Continuity panel | Honesty status visible | Soft L3 Fixed |
| 3 | Export/Import buttons | Lab stub refuses with Next Settings hint | Native M1 done |
| 4 | Optional Next Settings M1 file round-trip | Sealed file export/import works | Continuity Pass |
| 5 | Confirm chat-state does not mint TRUSTED alone | Cut 7.3 refuse | Soft L3 lookback OK |

### Headless command

```bash
node scripts/cut7-lab-continuity-m1-soak.mjs
# or: pnpm verify:cut7-5
```

## Forbidden claims

- Continuity Pass  
- Soft L3 Fixed · Tor Verified · Matrix promote  
- Unlock recreates wiped PC  
- Live multi-device (M5) shipped  

## NEXT after 7.5

Maintainer may charter native M1 adapter · M2 auto-DC · Soft L3 resume. Continuity Pass remains unclaimed until explicit promote cut.
