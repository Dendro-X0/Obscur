# Design — Cut 10 Continuity M4 device-to-device transfer (F-sync C2)

**Date:** 2026-11-10  
**Status:** **CLOSED** (2026-11-10) · **10.0–10.5 L1 + checklist** · Continuity Pass still not claimed  
**Parents:** [20-cross-device-profile-sync-e2ee.md](../../docs/exploration/feasibility/20-cross-device-profile-sync-e2ee.md) · [cut9-continuity-m2-auto-dc-design-2026-11-10.md](./cut9-continuity-m2-auto-dc-design-2026-11-10.md) · Cuts 0–9

```text
HANDOFF ATOMIC STEP: Cut 10 Continuity M4 device transfer (user continue after Cut 9 CLOSED)
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass · M5 linked devices
CANONICAL OWNER:     Continuity Plane 3 · M4 offer/accept · desktop-ui Continuity door
PROOF BEFORE DONE:   per-slice L1; ≠ Continuity Pass · ≠ Soft L3
SURFACE:             NARROW offer/accept carrier over Cut 8 sealed Continuity M1 (clipboard/sneakernet)
ACK 10.0:            2026-11-10 — proceed 10.1 (user continue; Soft L3 stays paused)
```

## 1. Why this cut (after Cut 9)

F-sync C0 (M1 file) and C1 (M2 home) landed. C2 = **M4 when both devices present**. Users still lack an explicit “transfer to this other device now” path that is not “save a file” or “hope home is online.”

| Residue | As-built | Why unviable |
|---------|----------|--------------|
| **K-FILE-ONLY-PAIR** | M1 download/import only | Awkward for desktop↔phone when both awake |
| **K-HOME-REQUIRED** | M2 needs private DC session | Pair transfer should work offline/LAN-absent |
| **K-LAN-OVERBUILD** | Temptation to ship WebRTC/LAN discovery day one | Out of NARROW; Soft L3 distraction |

**Not this cut:** Continuity Pass · Soft L3 Fixed · M5 live linked devices · auto LAN discovery · Tor Verified · Matrix promote · Vite product-depth mega-UI.

## 2. Goal

Ship a **NARROW Continuity M4 offer/accept**:

1. **Same sealed Continuity M1** as Cut 8 inside the offer (no second crypto format).  
2. **Short transfer code** required to accept (mitigates casual clipboard paste mistakes).  
3. **TTL** on offers (default 15 minutes).  
4. ContinuityDoor: create offer / accept offer (paste JSON + code).  
5. Soft L3 / Tor / Matrix stay **paused**. **≠ Continuity Pass**.

## 3. Deliver (slices)

| Slice | Deliver | Proof |
|-------|---------|-------|
| **10.0** | This design **ACK** | Maintainer/continue ACK · **DONE 2026-11-10** |
| **10.1** | `ContinuityM4Offer` create/parse/verify (+ TTL + code) | L1 · **DONE** (`verify:cut10-1`) |
| **10.2** | ContinuityPorts `createDeviceTransferOffer` / `acceptDeviceTransferOffer` | L1 · **DONE** (`verify:cut10-2`) |
| **10.3** | Vite ports wire (reuse M1 seal/import) | L1 · **DONE** (`verify:cut10-3`) |
| **10.4** | ContinuityDoor M4 UX | L1 · **DONE** (`verify:cut10-4`) |
| **10.5** | Lab checklist · **≠ Continuity Pass** | Soak · **DONE** (`verify:cut10-5`) |

## 4. Continuity M4 law (additive)

```text
1. M4 carries opaque sealed Continuity M1 — Continuity passphrase still required to unseal.
2. Transfer code is a second factor for accept — not a replacement for Continuity passphrase.
3. Offers expire; expired offers refuse accept.
4. Unlock ≠ Continuity; successful M4 ≠ Continuity Pass · ≠ Soft L3 Fixed.
5. No apps/pwa mega-import · no Soft L3 lookback CRM invent.
6. LAN/WebRTC discovery deferred — clipboard/sneakernet carrier is enough for C2 NARROW.
```

## 5. Offer shape

```text
ContinuityM4Offer
  version: 1
  format: "obscur.continuity_m4.offer.v1"
  transferCode: "######"          // numeric, generated
  publicKeyHexHint?: string
  sealedEnvelopeJson: string      // Cut 8 sealed M1
  createdAtUnixMs
  expiresAtUnixMs
```

## 6. Non-goals

- Continuity Pass  
- Soft L3 Fixed  
- M5 enroll/revoke  
- Automatic LAN/mDNS/WebRTC pipe  
- Background auto-publish  

## 7. Proof plan

| Layer | Cut 10 “done” |
|-------|----------------|
| **L1** | Offer verify · ports · door contracts |
| **L2** | Optional dual-device clipboard handoff |
| **L3** | Optional packaged |
| **L4** | Deferred |

## 8. Risks

- Agents claim Continuity Pass from green vitest.  
- Treating transfer code as encryption (it is not).  
- Soft L3 resume smuggled as “pair sync.”  

## 9. References

- F-sync C2 — `docs/exploration/feasibility/20-cross-device-profile-sync-e2ee.md`  
- Cut 8 seal — `cut8-native-continuity-m1-adapter-design-2026-11-10.md`  
- Cut 9 home — `cut9-continuity-m2-auto-dc-design-2026-11-10.md`  
