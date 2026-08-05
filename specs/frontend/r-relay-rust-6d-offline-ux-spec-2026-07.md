# Frontend spec — R-RELAY-RUST-6d Offline pack USB / QR helper UX

**Status:** RUST-6d L1 Pass · USB/QR helper UX landed  
**Prior:** [RUST-6c L3](../backend/r-relay-rust-6c-offline-sneakernet-l3-design-2026-07.md) · [charter](../backend/r-relay-rust-6-offline-dtn-charter-2026-07.md)  
**Surface:** Settings → Relays (thin helper) · headless transport-kernel modules

---

## Session gate

```text
HANDOFF ATOMIC STEP:  RUST-6c L3 Pass · optional 6d when requested
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab
CANONICAL OWNER:      apps/pwa/app/features/transport-kernel/offline-pack-*
PROOF BEFORE DONE:    vitest helpers + panel · verify UI archive still green
OUT OF SCOPE:         BLE · camera QR scanner · thicken browser pool · ambient profileId
```

---

## Goal

Give operators a **desktop helper** to move offline packs without pretending live delivery:

1. **USB / file** — export pack to `.obscur-offline-pack.json` · import from absolute path · optional `persistToDm`
2. **QR chunks** — split/reassemble pack JSON into copyable chunks (`obscur-offline-qr/v1`) for phone/camera workflows later
3. **Copy** — always show “imported offline ≠ delivered on relay”

UI archive: no new product feature domains; mount beside transport presets (same exception pattern as RUST-5d). No Dev Lab.

---

## Mental simulation

1. Operator unlocks profile `bob` on desktop.
2. Opens Settings → Relays → Offline pack helper.
3. Pastes pack key hex + optional lab ciphertext · Export → file written · evidence `offline_export_ready`.
4. Optionally opens “QR chunks” and copies chunk 1/N for out-of-band transfer.
5. On another vault: Import path + same key + Persist receipts → evidence `imported_offline` · never green “relay OK”.
6. Wrong profile / bad MAC → soft reject message with reason code.

---

## Wiring table

| UI control | Owner / API |
|------------|-------------|
| Export | `exportOfflinePackViaHost` → `transport.exportOfflinePack` |
| Import | `importOfflinePackViaHost` → `transport.importOfflinePack` (+ `persistToDm`) |
| QR split | `chunkOfflinePackJson` / `assembleOfflinePackJson` (pure) |
| Profile | `getResolvedProfileId()` passed as prop — never ambient singleton in helpers |

---

## Visual / copy

- One bordered section under transport presets (same density as catalog panel).
- Banner: muted warning tone — offline evidence language.
- No cards-in-hero; no BLE affordances; no “Sent ✓” success for import.

---

## Proof

| Layer | Command |
|-------|---------|
| L1 | vitest offline-pack-qr / offline-pack-invoke / panel |
| Archive | `pnpm verify:ui-archive` (no new engine→pwa imports) |

**Claim:** Offline helper UX landed (USB + QR chunk).  
**Not claimed:** air-gap product complete · camera QR · BLE.

---

## Next

Handoff → R-VAULT alternate or hold.
