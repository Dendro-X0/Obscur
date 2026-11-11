# Cut 3.5 — Lab milestone checklist (Vite thin shell)

**Date:** 2026-11-09  
**Status:** documented + headless Vite-shell soak · **≠ Soft L3 Fixed** · **≠ Tor Verified** · **≠ Matrix promote** · **≠ Continuity Pass**  
**Parent:** [cut3-ui-vite-thin-shell-design-2026-11-09.md](./cut3-ui-vite-thin-shell-design-2026-11-09.md) · [cut3-dual-entry-quarantine-2026-11-09.md](./cut3-dual-entry-quarantine-2026-11-09.md)

```text
HANDOFF ATOMIC STEP: Cut 3 CLOSED (3.0–3.5 L1 + checklist) — next NARROW via maintainer
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass
CANONICAL OWNER:     ENGINE-LAB / Vite desktop-ui lab entry
PROOF:               checklist below · cut3-lab-vite-shell-soak.mjs · ≠ Soft L3
```

## Goal

Operator soaks **Cut 3 Vite lab entry** on desktop: Tauri loads `apps/desktop-ui`, unlock uses the shared shell-ready gate, private-trust home shows H-dc·T3 chrome, and production Next beta remains untouched.

Builds on Cut 1 authority + Cut 2 product face (ports/policy shared; Next still beta until explicit cutover).

## Product face on Vite (required)

| Concern | Owner |
|---------|--------|
| Lab entry | `pnpm dev:desktop:lab` → Vite overlay (`tauri.vite.lab.conf.json`) |
| Auth door | `DeviceUnlockPort` + `resolveAuthShellReady` (same gate as AuthGateway) |
| Protocols / compose | `PrivateTrustHome` · shared `@obscur/private-trust-engine` compose-face |
| Send guard | Silent Nostr refused while `private_dc` (`private_dc_silent_nostr_fallback_refused`) |
| Production beta | `tauri.conf.json` `frontendDist=../../pwa/out` — **no silent wipe** |

## Kill list (Cut 3)

| Kill ID | Residue | Native rule |
|---------|---------|-------------|
| **K-NEXT-MONOLITH** | Product face only in Next mega-tree | Vite lab entry exists (strangler of *entry*) |
| **K-UI-AS-BACKEND** | UI invents durability/owners | Injected PAL/kernel ports only in desktop-ui |
| **K-DUAL-ENTRY** | No first-class Vite lab entry | Lab flag / `dev:desktop:lab` defaults Vite |
| **K-SHELL-INVENT** | Parallel PDK / chat-state in Vite tree | no-PDK-invent + home-boundary contracts |

## Preconditions

- [ ] Cut 3.1–3.4 L1 green (`pnpm verify:cut3-4` or soak below)
- [ ] Soft L3 contact Pass remains **paused** (B4)
- [ ] Optional L2: native auth-kernel `DeviceUnlockPort` + real H-dc/T3 wire (not required to close Cut 3 L1)
- [ ] Production/beta workflows still use Next (`dev:desktop*` / `tauri build`) unless lab flag set

## Soak steps (L2 — desktop · Vite entry)

| # | Step | Expect | Not claim |
|---|------|--------|-----------|
| 1 | `pnpm dev:desktop:lab` (or `dev:vite-lab`) | Tauri webview on Vite `:3350` | Production cutover |
| 2 | Unlock with lab passphrase / wired DeviceUnlockPort | Shell ready via `resolveAuthShellReady` | Continuity |
| 3 | See Private-trust home | Protocol chips; **H-dc · T3** when Private DC | Soft L3 Fixed |
| 4 | Send on private_dc lab port | Home **accepted** ≠ delivered (lab/in-memory or T3) | Read receipt · Soft L3 |
| 5 | Attempt silent Nostr carrier while private_dc | Refused with `private_dc_silent_nostr_fallback_refused` | Soft L3 invite Pass |
| 6 | Confirm production path still Next | `tauri.conf.json` → `pwa/out`; `pnpm -C apps/desktop build` unchanged | Silent beta wipe |
| 7 | Optional: `OBSCUR_DESKTOP_LAB_ENTRY=next` | Lab runner can opt back to Next webview | Matrix promote |
| 8 | Optional dual-profile | Isolation still Cut 0/1 owners | Soft L3 dual CDP |

## L1 evidence already landed (3.1–3.4)

| Slice | Proof |
|-------|-------|
| 3.1 | `apps/desktop-ui` scaffold · `tauri.vite.lab.conf.json` · `cut3-no-pdk-invent` |
| 3.2 | `resolveAuthShellReady` · AuthDoor · `auth-door-session` |
| 3.3 | `PrivateTrustHome` · compose-face package · home-boundary contract |
| 3.4 | dual-entry quarantine · `obscur-desktop-lab-entry` · production `pwa/out` |

### Headless command (L1 gate)

```bash
node scripts/cut3-lab-vite-shell-soak.mjs
```

Runs Cut 3.1–3.4 L1 gates (lab entry selftest + desktop-ui contracts + vite build). **≠ Soft L3 Fixed.**

## Forbidden claims after soak

- Soft L3 Fixed / contact Pass  
- Tor Verified · Matrix promote · Continuity Pass  
- “Cut UI / rewrite finished” from headless alone (desktop L2 steps 1–8 still operator)  
- Production frontendDist flipped to Vite without maintainer cutover  
- Native auth-kernel + live H-dc T3 from Vite claimed without L2 evidence  

## NEXT after 3.5

Maintainer may charter next NARROW cut (native DeviceUnlockPort wire · live H-dc T3 from Vite · packaged L4 · Soft L3 resume). Soft L3 remains paused until separately resumed.
