# Cut 4.4 — Lab milestone checklist (Vite native ports)

**Date:** 2026-11-10  
**Status:** documented + headless native-port soak · **≠ Soft L3 Fixed** · **≠ Tor Verified** · **≠ Matrix promote** · **≠ Continuity Pass**  
**Parent:** [cut4-vite-native-port-wire-design-2026-11-09.md](./cut4-vite-native-port-wire-design-2026-11-09.md)

```text
HANDOFF ATOMIC STEP: Cut 4 CLOSED (4.0–4.4 L1 + checklist) — Soft L3 still paused
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass
CANONICAL OWNER:     ENGINE-LAB / Vite desktop-ui native adapters
PROOF:               checklist below · cut4-lab-vite-native-soak.mjs · ≠ Soft L3
```

## Goal

Operator soaks **Cut 4 Vite native path** on desktop: prefer-native when Tauri is present, passphrase DeviceUnlock (crypto identity), H-dc session envelope deliver, HostEnginePort list/send — without importing Next mega-providers. Production Next beta stays untouched.

## Product face on Vite (required)

| Concern | Owner |
|---------|--------|
| Selection | `resolveDesktopUiAdapterSource` — lab only if `OBSCUR_DESKTOP_UI_LAB_STUBS=1` or host absent |
| Unlock | `createVitePassphraseDeviceUnlockHandlers` · `obscur.identity.record::profileId` · no PDK invent |
| Home list/send | `createNativePrivateTrustHomePorts` · HostEnginePort · `sendPrivateTrustT3ViaHost` |
| H-dc deliver | `createViteHomeEnvelopeDeliver` · session env/`localStorage` · package `sendPrivateDcHomeEnvelope` |
| Production beta | `tauri.conf.json` `frontendDist=../../pwa/out` — **no silent wipe** |

## Kill list (Cut 4)

| Kill ID | Residue | Native rule |
|---------|---------|-------------|
| **K-LAB-UNLOCK** | Hardcoded lab passphrase only | Passphrase handlers on native path (crypto identity) |
| **K-LAB-HOME** | In-memory home only | HostEnginePort + T3 when Tauri |
| **K-PWA-MEGA-IMPORT** | Import AuthGateway / MessagingProvider | Contracts forbid apps/pwa feature imports |
| **K-VITE-L2-GAP** | No Vite L2 checklist | This checklist + soak |

## Preconditions

- [ ] Cut 4.0–4.3 L1 green (`pnpm verify:cut4-3` or soak below)
- [ ] Soft L3 contact Pass remains **paused** (B4)
- [ ] Optional operator: identity record + H-dc session configured for live send
- [ ] Production/beta workflows still use Next unless lab flag set

## Soak steps (L2 — desktop · Vite entry)

| # | Step | Expect | Not claim |
|---|------|--------|-----------|
| 1 | `pnpm dev:desktop:lab` | Tauri webview on Vite `:3350` | Production cutover |
| 2 | Ensure `obscur.identity.record::<profile>` present | Passphrase unlock → shell-ready | Continuity · full PDK/SQLite vault |
| 3 | Set H-dc session (`OBSCUR_PRIVATE_DC_BASE_URL` or LS) | Home deliver no longer fail-closed | Soft L3 Fixed |
| 4 | Unlock → Private-trust home | Protocol chips; **H-dc · T3** | Soft L3 invite Pass |
| 5 | Send on `private_dc` | prepareT3 → home **accepted** ≠ delivered → completeT3HomeAck | Read receipt |
| 6 | List conversations/messages | HostEnginePort relationship_edge / dm.getThread | Soft L3 dual CDP |
| 7 | Attempt silent Nostr while private_dc | `private_dc_silent_nostr_fallback_refused` | Matrix promote |
| 8 | Confirm production path still Next | `frontendDist` → `pwa/out` | Silent beta wipe |

## L1 evidence already landed (4.1–4.3)

| Slice | Proof |
|-------|-------|
| 4.1 | `@obscur/auth-engine` delegating DeviceUnlock · no pwa unlock import |
| 4.2 | native PrivateTrustHomePorts · T3 helpers · silent-Nostr refuse |
| 4.3 | App prefer-native selection · stubs flag / host absent → lab |

### Headless command (L1 gate)

```bash
node scripts/cut4-lab-vite-native-soak.mjs
```

Runs Cut 4.1–4.4 L1 gates (contracts + package home client + vite build). **≠ Soft L3 Fixed.**

## Forbidden claims after soak

- Soft L3 Fixed / contact Pass  
- Tor Verified · Matrix promote · Continuity Pass  
- “Vite replaced production” / `frontendDist` flipped without cutover charter  
- Full PDK / storage-at-rest invent from desktop-ui (still forbidden)  
- Soft L3 dual CDP from a successful T3 lab send  

## NEXT after 4.4

Maintainer may charter next NARROW cut (packaged L4 · Soft L3 resume · Continuity · production Vite cutover). Soft L3 remains paused until separately resumed.
