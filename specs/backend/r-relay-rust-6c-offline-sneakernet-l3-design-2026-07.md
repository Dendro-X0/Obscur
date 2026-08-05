# Design — R-RELAY-RUST-6c Offline sneakernet L3

**Status:** RUST-6c L3 Pass · offline path fixed (lab)  
**Prior:** [RUST-6b](./r-relay-rust-6b-offline-export-import-design-2026-07.md) L1 Pass · [charter](./r-relay-rust-6-offline-dtn-charter-2026-07.md)  
**Slice:** Two profiles / two data roots — export → copy → import → message visible

---

## Session gate

```text
HANDOFF ATOMIC STEP:  RUST-6b L1 Pass · next 6c when requested
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab
CANONICAL OWNER:      mesh/offline persist + dm.insertMessage (explicit profileId)
PROOF BEFORE DONE:    cargo test l3_offline_sneakernet · node scripts/l3-mesh-offline-sneakernet.mjs
OUT OF SCOPE:         BLE/QR · UI · live Nostr · claim air-gap product complete
```

---

## Goal

Prove the **file sneakernet path** end-to-end in lab:

1. **Data root A** exports an offline pack addressed to profile `bob`
2. **Courier** copies the pack file (no network)
3. **Data root B** imports as `bob` → evidence `imported_offline` → **persist** via dm-engine
4. **Message visible** — `dm.getThread` returns the imported row for `bob`
5. **Fail closed** — import as `alice` on any root rejects (`profile_scope_mismatch`); alice thread empty

Invariant: pack `profileIdHint` + envelope `profileId` = **destination vault** (importer), not ambient current-user. Ciphertext stays opaque; thread shows an `imported_offline` receipt (not live relay OK).

---

## Mental simulation

| Actor | Action |
|-------|--------|
| Sender machine (root A) | `export_offline_pack(bob, …)` → `root_a/outbox/*.obscur-offline-pack.json` |
| Courier | `fs.copyFile` root_a → courier → root_b |
| Receiver (root B, bob) | `import_offline_pack(bob)` → `persist_imported_to_dm` → getThread sees receipt |
| Attacker / wrong vault | `import_offline_pack(alice)` → reject; no dm row |

---

## Contract additions (6c)

| Piece | Owner |
|-------|--------|
| `persist_imported_to_dm(db, profile_id, envelopes)` | `mesh/offline/persist.rs` |
| Conversation | `dm:offline-import` (lab receipt thread) |
| Plaintext receipt | `[imported_offline] envelope=<id>` — **not** decrypted body |
| Optional IPC | `importOfflinePack.persistToDm: true` uses unlocked `DbState` when present |

Subtract: no plaintext body in pack; no auto live publish; no browser pool.

---

## Proof plan

| Layer | Command |
|-------|---------|
| L3 | `cargo test l3_offline_sneakernet -- --nocapture` |
| Driver | `node scripts/l3-mesh-offline-sneakernet.mjs` → evidence under `docs/handoffs/` |

**Claim when Pass:** Offline path **fixed** (lab sneakernet).  
**Not claimed:** Air-gap product complete · BLE · UI.

---

## Next

RUST-6d optional UX **or** R-VAULT alternate — only after maintainer request.
