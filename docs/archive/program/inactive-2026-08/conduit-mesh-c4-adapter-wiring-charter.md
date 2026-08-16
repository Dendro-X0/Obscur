# Conduit Mesh C4 — real adapter wiring charter

**Status:** **Active**  
**Last updated:** 2026-06-26  
**Parent:** [conduit-mesh-c3-tor-policy-charter.md](./conduit-mesh-c3-tor-policy-charter.md)  
**Package:** `@obscur/conduit-mesh`

---

## Slice goal

Wire **production-shaped** `ConduitDriverPort` implementations for `team_relay` and `coordination_http` using injectable `fetch` — headless tests simulate `apps/coordination` + mesh HTTP v1 gateways **without** live wrangler or WebSocket.

---

## In scope

| Deliver | Detail |
|---------|--------|
| `createCustomHttpConduitDriver` | `CUSTOM_CONDUIT_HTTP_V1` publish + health probe |
| `createTeamRelayConduitDriver` | Delegates to mesh HTTP v1 on operator HTTP base URL |
| `createCoordinationHttpConduitDriver` | Probe `/health`; `coordination_head` evidence via membership head GET |
| `createConduitDriverFromDescriptor` | Dialect factory |
| Headless integration tests | Mock fetch router matching coordination paths |

## Out of scope

- Live `COORDINATION_LIVE_URL` gate (optional maintainer soak)
- WebSocket Nostr wire
- Tauri host invoke

---

## Proof

| Layer | Command |
|-------|---------|
| L1 | `pnpm verify:conduit-mesh-c4` |

---

## Next slice

**C5** — retire pool-orchestrator paths in archived UI harness (parity scenarios).
