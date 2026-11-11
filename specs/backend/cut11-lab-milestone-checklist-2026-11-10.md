# Cut 11.5 — Lab milestone checklist (Vite product-depth)

**Date:** 2026-11-10  
**Status:** documented + headless soak · **≠ Continuity Pass** · **≠ Soft L3 Fixed** · **≠ Tor Verified** · **≠ Matrix promote**  
**Parent:** [cut11-vite-product-depth-design-2026-11-10.md](./cut11-vite-product-depth-design-2026-11-10.md)

```text
HANDOFF ATOMIC STEP: Cut 11 Vite product-depth — Continuity Pass still not claimed
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass · M5
CANONICAL OWNER:     desktop-ui AuthDoor · PrivateHomeSessionDoor · createVitePassphraseIdentity
PROOF:               checklist below · cut11-lab-vite-product-depth-soak.mjs · ≠ Continuity Pass
```

## Goal

Operator soaks **empty-device create (`createVitePassphraseIdentity`) + private home save** on Vite production face without claiming Continuity Pass or Soft L3 Fixed.

## Preconditions

- [x] Cuts 5–10 CLOSED
- [x] Cut 11.0–11.4 L1 green
- [ ] Soft L3 remains **paused**

## Soak steps

| # | Step | Expect | Not claim |
|---|------|--------|-----------|
| 1 | `pnpm verify:cut11-5` | Headless L1 Pass | Continuity Pass |
| 2 | Empty Vite shell → Create account | Passphrase create → shell | Soft L3 Fixed |
| 3 | Private home door → save URL | Session persisted | Continuity Pass |
| 4 | Unlock copy still ≠ Continuity | Honesty visible | Unlock restores wiped PC |

### Headless command

```bash
node scripts/cut11-lab-vite-product-depth-soak.mjs
# or: pnpm verify:cut11-5
```

## Forbidden claims

- Continuity Pass  
- Soft L3 Fixed · Tor Verified · Matrix promote  
- Unlock recreates wiped PC  

## NEXT after 11.5

Maintainer may charter Soft L3 resume · M5 linked · Continuity Pass promote · deeper Settings. Continuity Pass remains unclaimed until explicit promote.
