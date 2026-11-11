# Cut 14.5 — Lab milestone checklist (Vite Settings NARROW)

**Date:** 2026-11-10  
**Status:** **CLOSED** (2026-11-10) · headless soak Pass · **≠ Continuity Pass** · **≠ Soft L3 Fixed** · **≠ live mesh** · **≠ peer grants**  
**Parent:** [cut14-vite-settings-narrow-design-2026-11-10.md](./cut14-vite-settings-narrow-design-2026-11-10.md)

```text
HANDOFF ATOMIC STEP: Cut 14 Vite Settings NARROW — Continuity Pass still not claimed
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass · live delta sync · peer history grants
CANONICAL OWNER:     apps/desktop-ui SettingsDoor · Continuity T2 residue
PROOF:               checklist below · cut14-lab-vite-settings-soak.mjs · ≠ Continuity Pass
```

## Goal

Operator soaks **thin SettingsDoor + T2 residue riding Continuity M1** without claiming Continuity Pass, Soft L3 Fixed, or live relay mesh.

## Soak steps

| # | Step | Expect | Not claim |
|---|------|--------|-----------|
| 1 | `pnpm verify:cut14-5` | Headless L1 Pass | Continuity Pass |
| 2 | Settings → save display name / privacy | Residue persisted | Soft L3 Fixed |
| 3 | Add local relay · Continuity export | T2 relayList present | Live mesh / Tor Verified |

### Headless command

```bash
node scripts/cut14-lab-vite-settings-soak.mjs
# or: pnpm verify:cut14-5
```

## Forbidden claims

- Continuity Pass  
- Soft L3 Fixed · Tor Verified · Matrix promote  
- Live multi-device delta sync · peer history grants shipped  
- Full Next/pwa Settings parity  

## NEXT after 14.5

Maintainer may charter Soft L3 resume · Continuity Pass promote · peer history grants · live M5 deltas · deeper Settings parity.
