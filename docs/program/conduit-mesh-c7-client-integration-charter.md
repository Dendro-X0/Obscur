# Conduit Mesh C7 — client integration charter

**Status:** **L1 landed (slice 0)**  
**Last updated:** 2026-07-14  
**Parent:** [conduit-mesh-c6-nostr-ws-charter.md](./conduit-mesh-c6-nostr-ws-charter.md)  
**Concept:** [obscur-conduit-mesh-concept-2026-06.md](./obscur-conduit-mesh-concept-2026-06.md)

---

## Slice goal

Wire **DM publish + subscribe** through Conduit Mesh when `NEXT_PUBLIC_OBSCUR_CONDUIT_MESH_POOL=1` — without importing `enhanced-relay-pool-legacy` into the mesh hook. Mesh owns orchestration and evidence; a thin **Nostr WebSocket client** owns REQ/EVENT/CLOSE wire I/O for `wss://` / `ws://` endpoints.

Headless proof first; live WebSocket in archived UI harness only (no new UI surfaces in this slice).

---

## In scope

| Deliver | Detail |
|---------|--------|
| `resolveRelayPoolConduitDescriptors` | `ws(s)://` → `nostr_ws`; `http(s)://` → `team_relay` / `custom` |
| Nostr EVENT **passthrough publish** | DM pipeline sends pre-built `["EVENT", …]` — mesh must not re-wrap as kind 31990 |
| `ConduitMeshNostrSubscriptionPort` | `subscribe` / `subscribeToMessages` / `sendToOpen` / `unsubscribe` contract |
| `createConduitMeshRelayPoolRuntime` | Accept shared `nostrWire` + use `mesh.publishEnvelope` for non-passthrough |
| `createConduitMeshNostrWsClient` (PWA) | Minimal multi-relay WebSocket owner for live client |
| `useConduitMeshRelayPool` | Wire subscription + connections; profile-scoped runtime |
| Headless C7 integration test | In-memory WS client + subscribe + passthrough publish |
| `verify:conduit-mesh-c7` | L1 gate |

## Out of scope

- Default-on mesh without `NEXT_PUBLIC_OBSCUR_CONDUIT_MESH_POOL=1` (C7b)
- Settings “Conduits” UX redesign
- Tor live SOCKS probes (C3 spec only)
- Physical deletion of `enhanced-relay-pool-legacy.ts`
- W53 maintainer `Decision: PASS`
- Community / workspace mesh routing

---

## Activation (C7 slice 0 — superseded by C7b default-on)

C7b makes mesh the **default** on native desktop (transport-kernel authority). Opt out only when debugging the legacy enhanced pool:

```bash
# Rollback to transport-kernel enhanced pool (enhanced-relay-pool-legacy hook)
NEXT_PUBLIC_OBSCUR_CONDUIT_MESH_POOL=0
```

Legacy web (no transport-kernel authority) is unchanged — still uses legacy WebSocket pool.

---

## C7b — default-on mesh pool

**Status:** **L1 landed**  
**Last updated:** 2026-07-14

| Deliver | Detail |
|---------|--------|
| Default mesh routing | `shouldUseConduitMeshRelayPoolHook()` true when transport-kernel owns hook |
| Opt-out | `NEXT_PUBLIC_OBSCUR_CONDUIT_MESH_POOL=0` → transport-kernel enhanced pool |
| Rollback surface | No deletion of enhanced pool; tri-route unchanged |

### Proof

| Layer | Command |
|-------|---------|
| L1 | `pnpm verify:conduit-mesh-c7b` |
| L3 | Maintainer dual-window DM on desktop default build — **not claimed** |

---

## C7c — Settings Conduits UX + L3 runbook

**Status:** **L1 landed**  
**Last updated:** 2026-07-14

| Deliver | Detail |
|---------|--------|
| `ConduitMeshSettingsPanel` | Settings → Relays: pool owner, E2EE honesty, dialect badges |
| `conduit-mesh-settings-snapshot` | Headless pool owner + dialect mapping for UI |
| L3 runbook | [conduit-mesh-c7-l3-soak-runbook.md](./conduit-mesh-c7-l3-soak-runbook.md) |

### Proof

| Layer | Command |
|-------|---------|
| L1 | `pnpm verify:conduit-mesh-c7c` |
| L3 | Maintainer soak runbook rows A–B — **not claimed** |

---

## Next slice

**C7 L3 sign-off** — maintainer dual-window DM evidence per runbook.
