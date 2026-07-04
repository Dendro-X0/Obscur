# Conduit Mesh C1 — contracts charter

**Status:** **Active** — types + doc tests only; no runtime  
**Last updated:** 2026-06-26  
**Parent:** [obscur-conduit-mesh-concept-2026-06.md](./obscur-conduit-mesh-concept-2026-06.md)  
**Package:** `@obscur/conduit-mesh-contracts`

---

## Slice goal

Pin the **type surface** for Conduit Mesh before any runtime (`@obscur/conduit-mesh` C2). Kernel engines and dialect adapters compile against these contracts only.

**In scope:** `Envelope`, `Evidence`, `ConduitDescriptor`, `MeshSnapshot`, `MeshPort`, `ConduitDriverPort`, `custom` gateway minimum HTTP contract (types + constants).  
**Out of scope:** WebSocket drivers, React hooks, SQLite evidence persistence, Nostr wire encoding.

---

## Maintainer decisions (pinned for C1)

| # | Decision | C1 choice |
|---|----------|-----------|
| 1 | Package name | **`@obscur/conduit-mesh-contracts`** (separate from `@obscur/transport-engine`) |
| 2 | Nostr requirement | **None** — mesh types do not reference `@dweb/nostr` |
| 3 | Scope key | Reuse `EngineScope.profileId` from `@obscur/engine-contracts` |
| 4 | TransportPort relation | `MeshPort` **supersedes** community-only `TransportPort` for new code; legacy adapter mapping deferred to C4 |
| 5 | Custom conduit | Minimum **HTTP pull/publish** contract pinned in package (`CUSTOM_CONDUIT_HTTP_V1`) |

---

## Proof

| Layer | Command |
|-------|---------|
| L1 | `pnpm verify:conduit-mesh-c1` |
| L2 | Package boundary — no `apps/pwa` imports (included in engine-lab packages-boundary when wired) |

---

## Next slice

**C2** — headless `@obscur/conduit-mesh` runtime with mock `custom` + `team_relay` drivers; charter separate.
