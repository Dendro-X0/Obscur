# Cut 8.5 — Lab milestone checklist (native Continuity M1 adapter)

**Date:** 2026-11-10  
**Status:** documented + headless soak · **≠ Continuity Pass** · **≠ Soft L3 Fixed** · **≠ Tor Verified** · **≠ Matrix promote**  
**Parent:** [cut8-native-continuity-m1-adapter-design-2026-11-10.md](./cut8-native-continuity-m1-adapter-design-2026-11-10.md)

```text
HANDOFF ATOMIC STEP: Cut 8 native Continuity M1 adapter — Continuity Pass still not claimed
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass · M5 linked devices
CANONICAL OWNER:     Continuity Plane 3 · createViteContinuityPorts
PROOF:               checklist below · cut8-lab-continuity-m1-soak.mjs · ≠ Continuity Pass
```

## Goal

Operator soaks **Vite-native Continuity M1 seal + ports** without claiming Continuity Pass. Next Settings portable bundle may remain for full payload parity.

## Preconditions

- [x] Cut 7 CLOSED
- [x] Cut 8.0–8.4 L1 green
- [ ] Soft L3 remains **paused**
- [ ] Unlock ≠ Continuity understood by operator

## Soak steps

| # | Step | Expect | Not claim |
|---|------|--------|-----------|
| 1 | `pnpm verify:cut8-5` | Headless L1 Pass | Continuity Pass |
| 2 | Tauri Vite shell → Continuity panel | Honesty + passphrase fields | Soft L3 Fixed |
| 3 | Export sealed snapshot (native host) | JSON download · honesty=partial | Continuity Pass |
| 4 | Optional wipe localStorage → import file | Identity + peerTrust restored | Soft L3 lookback OK |
| 5 | Confirm no chat-state in vite Continuity ports | Cut 8.2 contract | Soft L3 Fixed |

### Headless command

```bash
node scripts/cut8-lab-continuity-m1-soak.mjs
# or: pnpm verify:cut8-5
```

## Forbidden claims

- Continuity Pass  
- Soft L3 Fixed · Tor Verified · Matrix promote  
- Unlock recreates wiped PC  
- Live multi-device (M5) shipped  
- Full EncryptedAccountBackupPayload parity  

## NEXT after 8.5

Maintainer may charter M2 auto-DC · Soft L3 resume · Vite product-depth · Continuity Pass promote cut. Continuity Pass remains unclaimed until explicit promote.
