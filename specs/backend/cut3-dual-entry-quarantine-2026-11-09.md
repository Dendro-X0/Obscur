# Cut 3.4 — Dual-entry quarantine (Next vs Vite)

**Date:** 2026-11-09  
**Superseded production default:** Cut 5/6 — committed desktop `frontendDist` is Vite; Next/mobile use rollback + `tauri.mobile.conf.json`. Lab dual-entry resolver remains for `dev:lab`.  
**Status:** **L1 Pass** · Soft L3 / Continuity / Tor / Matrix promote **not** claimed  
**Parent:** [cut3-ui-vite-thin-shell-design-2026-11-09.md](./cut3-ui-vite-thin-shell-design-2026-11-09.md)

```text
HANDOFF ATOMIC STEP: Cut 3.4 CLOSED — next 3.5 Vite lab checklist
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass
CANONICAL OWNER:     dual-entry quarantine · production frontendDist = Next until cutover
PROOF:               cut3-dual-entry.contract · resolveDesktopLabEntry · no silent beta wipe
```

## Why

Cut 3.1–3.3 landed a Vite lab shell. Without quarantine, operators confuse:

| Surface | Role | Must not |
|---------|------|----------|
| **Next** (`apps/pwa`) | Production / published beta Tauri webview | Be deleted or swapped silently |
| **Vite** (`apps/desktop-ui`) | Private-trust lab entry (Cut 3) | Become accidental production default |

Kill residue: **K-DUAL-ENTRY** (no first-class Vite lab entry) is closed for *lab*; production remains Next until 3.5+ cutover.

## Entry matrix

| Entry | Tauri overlay | Web origin | When |
|-------|---------------|------------|------|
| **next** (beta) | `tauri.conf.json` / `tauri.dev.conf.json` / `tauri.live.dev.conf.json` | `apps/pwa/out` or Next `:3340` | Default product · `pnpm build` · `dev:desktop*` |
| **vite** (lab) | `tauri.vite.lab.conf.json` | Vite `:3350` / `apps/desktop-ui/dist` | Lab flag / `dev:desktop:lab` |

## Lab flag (default Vite when on)

```bash
# Preferred lab runner — defaults to Vite:
pnpm dev:desktop:lab
# ≡ OBSCUR_TAURI_LAB_UI=1 → Vite overlay

# Explicit override back to Next lab webview:
OBSCUR_DESKTOP_LAB_ENTRY=next pnpm dev:desktop:lab

# Direct Vite overlay (unchanged):
pnpm -C apps/desktop dev:vite-lab
```

Resolver: `scripts/obscur-desktop-lab-entry.mjs`

| Env | Effect |
|-----|--------|
| `OBSCUR_TAURI_LAB_UI=1` | Lab context on → default **vite** |
| `OBSCUR_DESKTOP_LAB_ENTRY=vite\|next` | Explicit override (wins) |
| unset + production `tauri build` | **next** · `frontendDist=../../pwa/out` |

## Hard rules (no silent beta wipe)

1. Default `apps/desktop/src-tauri/tauri.conf.json` `frontendDist` stays `../../pwa/out`.  
2. `apps/desktop` `build` script must **not** pass `tauri.vite.lab.conf.json`.  
3. Vite overlay may set `frontendDist` to `../../desktop-ui/dist` **only** under lab config.  
4. Do not delete `apps/pwa` or flip production dist in this slice.  
5. Soft L3 Fixed · Continuity Pass · Tor Verified · Matrix promote remain **out of band**.

## L1 proof

```bash
pnpm verify:cut3-4
```

## Not claimed

- Soft L3 Fixed · packaged NSIS Vite cutover (L4) · Continuity / F-sync  
- “Rewrite finished” from dual-entry docs alone  
