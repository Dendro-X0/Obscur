# Cut 10.5 — Lab milestone checklist (Continuity M4 device transfer)

**Date:** 2026-11-10  
**Status:** documented + headless soak · **≠ Continuity Pass** · **≠ Soft L3 Fixed** · **≠ Tor Verified** · **≠ Matrix promote**  
**Parent:** [cut10-continuity-m4-device-transfer-design-2026-11-10.md](./cut10-continuity-m4-device-transfer-design-2026-11-10.md)

```text
HANDOFF ATOMIC STEP: Cut 10 Continuity M4 device transfer — Continuity Pass still not claimed
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass · M5
CANONICAL OWNER:     Continuity Plane 3 · createDeviceTransferOffer
PROOF:               checklist below · cut10-lab-continuity-m4-soak.mjs · ≠ Continuity Pass
```

## Goal

Operator soaks **Continuity M4 offer/accept** (clipboard/sneakernet) without claiming Continuity Pass. LAN/WebRTC discovery remains deferred.

## Preconditions

- [x] Cut 8–9 CLOSED (M1 seal · M2 home)
- [x] Cut 10.0–10.4 L1 green
- [ ] Soft L3 remains **paused**
- [ ] Unlock ≠ Continuity understood by operator

## Soak steps

| # | Step | Expect | Not claim |
|---|------|--------|-----------|
| 1 | `pnpm verify:cut10-5` | Headless L1 Pass | Continuity Pass |
| 2 | Continuity panel → Create device transfer offer | Code + offer JSON shown | Soft L3 Fixed |
| 3 | Accept on second profile/store with code + passphrase | Import ok · honesty=partial | Continuity Pass |
| 4 | Expired / wrong code refuse | reasonCode expired/wrong_code | Soft L3 lookback OK |

### Headless command

```bash
node scripts/cut10-lab-continuity-m4-soak.mjs
# or: pnpm verify:cut10-5
```

## Forbidden claims

- Continuity Pass  
- Soft L3 Fixed · Tor Verified · Matrix promote  
- Unlock recreates wiped PC  
- Live multi-device (M5) / LAN auto-discovery shipped  

## NEXT after 10.5

Maintainer may charter Soft L3 resume · Vite product-depth · M5 linked devices · Continuity Pass promote. Continuity Pass remains unclaimed until explicit promote.
