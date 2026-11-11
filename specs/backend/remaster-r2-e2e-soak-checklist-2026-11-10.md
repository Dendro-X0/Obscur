# Remaster R2 — E2E soak checklist

**Date:** 2026-11-10  
**Status:** **CLOSED Pass** · headless soak green · **≠ Soft L3 Fixed** · **≠ Continuity Pass**  
**Parent:** [remaster-foundation-closeout-2026-11-10.md](./remaster-foundation-closeout-2026-11-10.md) · [remaster-r1-path-audit-2026-11-10.md](./remaster-r1-path-audit-2026-11-10.md)

```text
HANDOFF ATOMIC STEP: R2 remaster E2E soak — Continuity Pass / Soft L3 Fixed not claimed
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass · Continuity Cut 16+
CANONICAL OWNER:     apps/desktop-ui remaster face
PROOF:               checklist · remaster-r2-lab-soak.mjs · ≠ Continuity Pass
```

## Goal

Prove remaster path **create → unlock → home → T3 → Continuity** on Vite face without claiming Soft L3 Fixed or Continuity Pass.

## Soak steps

| # | Step | Expect | Not claim |
|---|------|--------|-----------|
| 1 | `pnpm verify:remaster-r2` | Headless Pass | Continuity Pass |
| 2 | createVitePassphraseIdentity | Identity stored | Soft L3 Fixed |
| 3 | writeVitePrivateDcSession | Home URL persisted | Tor Verified |
| 4 | Settings T2 + Continuity M1 export/import | T0–T2 present · settings restored | Continuity Pass |
| 5 | private_dc send face (lab) | accepted ≠ Soft L3 invent | Soft L3 Fixed |

### Headless command

```bash
node scripts/remaster-r2-lab-soak.mjs
# or: pnpm verify:remaster-r2
```

## Forbidden claims

- Soft L3 Fixed · Continuity Pass · Tor Verified · Matrix promote  
- Live multi-device delta sync  

## NEXT after R2

R3 gap patch only if soak fails · else R4 honesty · R5 beta cut plan.
