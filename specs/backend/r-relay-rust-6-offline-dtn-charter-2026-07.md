# Charter — R-RELAY-RUST-6 Offline / DTN transfer

**Status:** RUST-6d L1 Pass · offline band complete (optional UX)  
**Prior:** [RUST-5 SSH](./r-relay-rust-5-ssh-underlay-design-2026-07.md) (5a–5d Pass) · [mesh charter](./r-relay-rust-mesh-charter-2026-07.md)  
**Charter slot:** P3 reserved → **Offline transfer** dialects (mesh G8)

---

## Session gate

```text
HANDOFF ATOMIC STEP:  Optional RUST-6 offline charter
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab
CANONICAL OWNER (target): Rust mesh offline dialect + import/export pack owner (new modules)
PROOF BEFORE DONE:    This charter Pass · no impl until 6a design slice
OUT OF SCOPE NOW:     BLE/QR/USB impl · community · claim air-gap fixed · thicken browser pool
```

---

## Goal

Move **ciphertext envelopes** between Obscur profiles when **no live network conduit** is viable: export a signed offline pack on the sender, transfer out-of-band (USB / file share / QR chunk later), import on the receiver with evidence class **`imported` / `accepted_when_imported`** — never pretend `socket_open` or live `accepted`.

Invariant (charter): **dialect ≠ underlay**. Offline is a **dialect** (`store_forward` / `offline_import`), not an underlay rewrite of SSH/Tor. Kernel and dm-engine stay dialect-agnostic.

---

## Why now (preconditions met)

| Check | Evidence |
|-------|----------|
| Local/private mesh L3 | Pass |
| Legacy product pool subtracted | RUST-4c |
| SSH underlay L3 + preset | RUST-5c / 5d |
| Contracts stub | `store_forward` dialect + capability already in TS/Rust enums |
| Concept | Mesh G8 experimental surface |

SSH and clearnet paths do not cover air-gap / sneakernet. Offline is the next reserved capability, not a parallel transport owner.

---

## Inventory (today)

| Surface | State |
|---------|--------|
| `ConduitDialect::StoreForward` / `"store_forward"` | Enum only — not dialable |
| Capability `store_forward` | Enum only |
| Evidence classes | Need explicit `imported` / `accepted_when_imported` (UI must not map to live OK) |
| Product UI | No export/import pack flow |
| TS `createConduitMesh` | No offline driver |
| Rust mesh | No offline module |

---

## Mental simulation

1. **Sender** (offline or preferring air-gap): compose DM → encrypt as today → instead of mesh publish, **export offline pack** (one or more envelopes + metadata) to a file.
2. **Human / courier**: copy file via USB, SD, encrypted archive, or (later) QR chunks.
3. **Receiver**: **import pack** → validate profile scope, signatures, expiry → persist via dm-engine → emit evidence `imported` (not live relay OK).
4. **UI**: show “imported offline” / pending ack — never green “delivered on relay.”
5. **Fail closed:** corrupt/expired/wrong-profile pack → soft reject with reason codes; no silent drop into wrong vault.
6. **Neighbor:** live mesh, Tor, SSH underlays unchanged; offline queue does not become a second failover owner in TS.

---

## Contract sketch (charter-level)

### Dialect / underlay

| Role | Choice |
|------|--------|
| Dialect | `store_forward` (existing) + import path tagged `offline_import` capability or method |
| Underlay | `clearnet` unused for dial; transfer medium is **out of band** (file), not mesh dial |
| Endpoints | Optional opaque `file://` / pack URI for registry display only — **never** auto-dial |

### Pack format (MVP direction)

Versioned JSON (or CBOR later) envelope pack:

```text
obscur-offline-pack/v1
  profileIdHint (non-secret label only)
  createdAtUnixMs
  expiresAtUnixMs?
  envelopes[]: MeshEnvelope wire (ciphertext + audience + evidenceClass)
  packMac / signature over envelopes (device key or profile signing key — design 6a picks)
```

**Not in MVP:** BLE GATT framing, QR chunking, mixnet dead-drop servers.

### Evidence

| Class / reason | Meaning |
|----------------|---------|
| `imported` | Pack validated and envelopes accepted into local store |
| `import_rejected` | Bad MAC, expired, wrong profile, schema |
| `export_ready` | Local file written (sender-side only) |

`imported` ≠ live `accepted_by_operator`.

---

## Canonical owners (target)

| Concern | Owner |
|---------|--------|
| Pack encode/decode + MAC | **New** `packages/obscur-offline-pack` (or mesh-contracts extension) — types first |
| Export/import IPC | Rust desktop `mesh/offline/` or vault-adjacent command — **not** relay pool |
| Persist after import | Existing dm-engine / message write path (explicit `profileId`) |
| UI entry | Settings / thread action — **after** 6a–6b backend Pass (ui-taste) |
| Live mesh scheduler | Unchanged — offline is not a pad failover substitute without explicit user action |

**Subtract / forbid:** exporting plaintext; importing into ambient “current user”; using offline packs as fake Nostr EVENT publishes; BLE “because cool” before file MVP.

---

## Slice plan (when implement chartered)

| Slice | Deliverable | Proof |
|-------|-------------|-------|
| **RUST-6a** | Pack schema + encode/decode + reject reasons (TS and/or Rust) · no UI | Unit L1 |
| **RUST-6b** | Desktop export file + import file IPC · evidence on import · profile scoped | cargo + vitest L1 |
| **RUST-6c** | L3: two profiles / two data roots — export → copy → import → message visible | Named L3 recipe + evidence md |
| **RUST-6d** | Optional QR chunk / USB helper UX | Frontend spec after 6c |
| **Later** | BLE / dead-drop under G8 flag only | Separate charter |

This file charters **6a–6c**; **no code until maintainer says implement 6a**.

---

## Proof plan

| Layer | When |
|-------|------|
| L1 | Schema round-trip · reject expired/wrong MAC · profile scope |
| L3 | Two-profile sneakernet recipe (file copy) |
| L4 | Not required for charter |

**Claim language**

| May say | When |
|---------|------|
| RUST-6 Chartered / Design Pass | This file + handoff |
| Offline transfer implemented | 6b L1 |
| Offline path fixed | 6c L3 |
| Air-gap product complete | Never from file MVP alone |

---

## Feasibility notes

| Risk | Mitigation |
|------|------------|
| Pack becomes plaintext leak | Ciphertext-only envelopes; no keys in pack |
| Wrong-profile import | Explicit `profileId` on import IPC; soft reject |
| Users think “sent” | Distinct evidence class + UI copy |
| Scope creep (BLE/QR) | File MVP first; G8 flag for experimental |

---

## Forbidden without later slice

- Implementing BLE/QR/USB drivers in the same PR as 6a schema  
- Silent live publish of offline packs to public Nostr  
- Second TS failover owner for “offline queue auto-flush” without design  
- Community / AUTH-SESSION-1 / Dev Lab  

---

## Next atomic step

**Hold** — offline 6a–6d complete. Next: Slice 17 R-VAULT alternate · or optional web L3.

**6d evidence (L1 Pass):** [frontend spec](../frontend/r-relay-rust-6d-offline-ux-spec-2026-07.md) · vitest offline helper **8 Pass** · `verify:ui-archive` **3 Pass**.

**May claim:** offline helper UX landed (USB + QR chunks).  
**Not claimed:** air-gap product complete · BLE · camera QR.
