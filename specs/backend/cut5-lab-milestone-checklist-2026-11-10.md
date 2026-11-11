# Cut 5.4 — Lab milestone checklist (Vite production cutover)

**Date:** 2026-11-10  
**Status:** documented + headless cutover soak · **≠ Soft L3 Fixed** · **≠ Tor Verified** · **≠ Matrix promote** · **≠ Continuity Pass**  
**Parent:** [cut5-vite-production-cutover-design-2026-11-10.md](./cut5-vite-production-cutover-design-2026-11-10.md)

```text
HANDOFF ATOMIC STEP: Cut 5 CLOSED (5.0–5.4 L1 + checklist) — Soft L3 still paused
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass
CANONICAL OWNER:     ENGINE-LAB / desktop production entry · desktop-ui face
PROOF:               checklist below · cut5-lab-vite-production-soak.mjs · ≠ Soft L3
```

## Goal

Operator soaks **Vite as the default desktop webview** after the committed `frontendDist` flip, with **one-flag Next rollback** still live. Soft L3 / Continuity / Tor / Matrix promote stay out of band.

## Product face after 5.3 (required)

| Concern | Owner |
|---------|--------|
| Committed dist | `tauri.conf.json` → `../../desktop-ui/dist` · `beforeBuildCommand` builds desktop-ui |
| Default recipes | `pnpm -C apps/desktop dev\|build` → Vite via `run-desktop-production.mjs` |
| Next rollback | `OBSCUR_DESKTOP_PRODUCTION_ENTRY=next` or `dev:next` / `build:next` → `tauri.next.rollback.conf.json` |
| Unlock / home | Cut 4 native ports (prefer-native DeviceUnlock + HostEnginePort/T3) |
| Soft L3 / Continuity | **Paused** — not claimed by green Vite default |

## Kill list (Cut 5)

| Kill ID | Residue | Cutover rule |
|---------|---------|--------------|
| **K-NEXT-DEFAULT** | Production still Next | Committed `frontendDist` is Vite |
| **K-LAB-ONLY-VITE** | Vite only via lab overlay | Default `dev`/`build` resolve Vite |
| **K-SILENT-FLIP-RISK** | Flip without rollback | Next overlay + `PRODUCTION_ENTRY=next` |
| **K-NEXT-ORPHAN** | No named Next role | Rollback / optional lab — `apps/pwa` kept |

## Preconditions

- [x] Cut 5.0–5.3 L1 green (`pnpm verify:cut5-3`)
- [ ] Soft L3 contact Pass remains **paused** (B4)
- [ ] Optional operator: identity record + H-dc session for live send (Cut 4 L2)
- [ ] Next rollback path still present (do not delete `apps/pwa`)

## Soak steps (L2 — desktop · Vite as default)

| # | Step | Expect | Not claim |
|---|------|--------|-----------|
| 1 | `pnpm -C apps/desktop dev` (no lab flag) | Tauri webview on Vite `:3350` | Soft L3 Fixed |
| 2 | Unlock → Private-trust home | Protocol chips; prefer-native when Tauri | Continuity Pass |
| 3 | Send on `private_dc` (optional live) | prepareT3 → home accepted ≠ delivered | Soft L3 dual CDP |
| 4 | `OBSCUR_DESKTOP_PRODUCTION_ENTRY=next pnpm -C apps/desktop dev` **or** `dev:next` | Next rollback webview still boots | Silent beta wipe |
| 5 | Confirm committed dist | `frontendDist` → `desktop-ui/dist` | Packaged NSIS Pass |
| 6 | Optional L4 | Packaged NSIS with Vite asset | Soft L3 · Continuity |

## L1 evidence already landed (5.1–5.3)

| Slice | Proof |
|-------|-------|
| 5.1 | Production entry resolver + rollback env · `verify:cut5-1` |
| 5.2 | `run-desktop-production.mjs` recipes · `verify:cut5-2` |
| 5.3 | Committed dist flip + `tauri.next.rollback.conf.json` · `verify:cut5-3` |

### Headless command (L1 gate)

```bash
node scripts/cut5-lab-vite-production-soak.mjs
# or: pnpm verify:cut5-4
```

Runs Cut 5.1–5.3 L1 gates (selftest + contracts + vite build). **≠ Soft L3 Fixed.**

## Forbidden claims after soak

- Soft L3 Fixed / contact Pass  
- Tor Verified · Matrix promote · Continuity Pass  
- Deleting `apps/pwa` because Vite is default  
- Soft L3 dual CDP from a successful Vite-default unlock  
- Packaged NSIS Pass without optional L4 evidence  

## NEXT after 5.4

Maintainer may charter next NARROW cut (packaged L4 evidence · Soft L3 resume · Continuity / F-sync · release-matrix download face). Soft L3 remains paused until separately resumed.
