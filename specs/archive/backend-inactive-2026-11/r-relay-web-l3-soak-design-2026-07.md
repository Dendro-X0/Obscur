# Design — Optional web L3 soak (TS conduit mesh ↔ Docker `:7000`)

**Status:** L3 lab Pass · **Docker `:7000` parity Pass** (2026-07-31)  
**Evidence:** [web L3 soak](../../docs/handoffs/r-relay-web-l3-soak-2026-07-30.md) · mode=`docker_7000`  
**Prior:** Desktop [L3-product](../../docs/handoffs/r-relay-rust-l3-product-2026-07-30.md) Pass · RUST-4c–6d · ephemeral lab Pass earlier same day

---

## Session gate

```text
HANDOFF ATOMIC STEP:  Optional web L3 (maintainer pick)
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab
CANONICAL OWNER:      @obscur/conduit-mesh createConduitMeshRelayPoolRuntime + live NostrWsWire
PROOF BEFORE DONE:    node scripts/l3-mesh-web-soak.mjs · evidence under docs/handoffs/
OUT OF SCOPE:         public damus/primal fixed · Rust mesh re-proof · UI CDP · BLE
```

---

## Goal

Prove the **browser/TS** mesh pool can publish a signed Nostr EVENT to the **same** private relay Docker stack as desktop L3 (`ws://127.0.0.1:7000`), with mesh-active escape rejection — without claiming public Nostr.

| Layer | Owner |
|-------|--------|
| Wire | Node/`ws`-backed `NostrWsWirePort` (headless stand-in for `createConduitMeshNostrWsClient`) |
| Mesh | `createConduitMeshRelayPoolRuntime` |
| Relay | Docker `infra-nostr-relay-1` `:7000` |

---

## Mental simulation

1. Relay listens on `:7000`.
2. Web mesh configures only that URL for profile `web-l3`.
3. Publish signed EVENT frame via `publishToUrls` → relay OK → quorum met.
4. Request to `wss://relay.damus.io` while mesh-active is local-only → not accepted (no escape).
5. Evidence md records Pass/Fail; claim **web transport L3 (local)** only.

---

## Proof plan

| Check | How |
|-------|-----|
| Relay up | TCP/`ws` open to `:7000` |
| Raw EVENT→OK | Same as product soak (sanity) |
| Mesh publish | vitest soak file via script |
| Damus escape | publishToUrls outside configured set fails / zero success |

**Claim:** Web/TS local mesh path **fixed** (lab).  
**Not claimed:** Public Nostr · packaged PWA UI soak.

---

## Next

Handoff → P2 unlock→shell soak · LES R6 soak · or `pnpm dev:relay:docker` then re-run soak for `docker_7000` parity.
