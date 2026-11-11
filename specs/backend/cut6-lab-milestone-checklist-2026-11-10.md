# Cut 6.4 — Lab milestone checklist (release / CI Vite align)

**Date:** 2026-11-10  
**Status:** documented + headless soak · **≠ Soft L3 Fixed** · **≠ Tor Verified** · **≠ Matrix promote** · **≠ Continuity Pass**  
**Parent:** [cut6-release-ci-vite-align-design-2026-11-10.md](./cut6-release-ci-vite-align-design-2026-11-10.md)

```text
HANDOFF ATOMIC STEP: Cut 6 CLOSED (6.0–6.4 L1 + checklist) — Soft L3 still paused
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass
CANONICAL OWNER:     ENGINE-LAB / desktop packaging · CI
PROOF:               checklist below · cut6-lab-release-ci-soak.mjs · ≠ Soft L3
```

## Goal

Confirm **desktop Vite packaging law** and **mobile PWA overlay** after Cut 5/6 — without claiming Soft L3, Continuity, or Tor Verified.

## Product face (required)

| Surface | Law |
|---------|-----|
| Desktop committed | `tauri.conf.json` → `../../desktop-ui/dist` |
| Mobile / Android | `tauri.mobile.conf.json` → `../../pwa/out` |
| Desktop rollback | `OBSCUR_DESKTOP_PRODUCTION_ENTRY=next` / `tauri.next.rollback.conf.json` |
| Channel docs | Stable README names Vite default + Next rollback |

## Preconditions

- [x] Cut 6.0–6.3 L1 green (`pnpm verify:cut6-3` or soak below)
- [ ] Soft L3 remains **paused**
- [ ] Optional: operator `pnpm desktop:package` Vite NSIS smoke (L4)

## Soak steps

| # | Step | Expect | Not claim |
|---|------|--------|-----------|
| 1 | `pnpm verify:cut6-4` | Headless L1 Pass | Soft L3 Fixed |
| 2 | Optional `pnpm desktop:package` | NSIS/AppImage embeds Vite dist | Continuity Pass |
| 3 | Optional Android debug APK | Mobile overlay uses `pwa/out` | Vite-mobile shell done |
| 4 | Confirm `apps/pwa` still present | Rollback + mobile alive | Silent beta wipe |

### Headless command

```bash
node scripts/cut6-lab-release-ci-soak.mjs
# or: pnpm verify:cut6-4
```

## Forbidden claims

- Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass  
- Deleting `apps/pwa` because desktop is Vite  
- Packaged L4 Pass without installer evidence  

## NEXT after 6.4

Maintainer may charter next NARROW cut (Vite product-depth · Soft L3 resume · Continuity/F-sync · Vite-mobile). Soft L3 remains paused.
