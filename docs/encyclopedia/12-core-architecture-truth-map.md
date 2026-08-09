# 12 Core Architecture Truth Map

_Last reviewed: 2026-07-31 (backend parallel-path audit)._

This document is the architecture contract for **release / parity** development.  
**Product decentralization** (network) ≠ **codebase decentralization** (one owner per lifecycle).

Companion docs:

1. `docs/encyclopedia/13-relay-and-startup-failure-atlas.md`
2. `docs/encyclopedia/14-module-owner-index.md`
3. `specs/backend/backend-parallel-path-audit-2026-07.md`
4. `docs/program/obscur-backend-engine-roadmap.md`

## Canonical Owner Table (2026-07)

| # | Lifecycle | Canonical owner | Must not |
|---|-----------|-----------------|----------|
| 0 | Client mutation / local read gate | `getResolvedClientGateway()` — `@dweb/client-gateway` + `client-gateway-adapter.ts` | Branch on `isTauri` in product features |
| 1 | Window lifecycle | `window-runtime-supervisor.ts` | Second window supervisor |
| 2 | Profile / window bind | `desktop-profile-runtime` (+ boot payload sync inject) | Ambient profileId singletons |
| 3 | Auth boot restore (cold + F5) | `auth-kernel-boot-owner.ts` + Rust `auth_boot_snapshot` / session | Dev Lab programmatic unlock · AUTH-SESSION-1 scatter |
| 4 | Auth identity mutations | `auth-kernel` ports → `auth-kernel-legacy-delegates` (single bridge) | Parallel unlock stacks in gateway |
| 5 | DM persist read/write/delete | `@obscur/dm-engine` via Tauri `engine_invoke` | Bare `db_get_messages` / `db_insert_message` on non-PAUSED paths |
| 6 | Relay **product** pool + publish (desktop) | `@obscur/conduit-mesh` via `useConduitMeshRelayPool` (`relay-pool-hook-port.ts`) | Product UI wiring to `relay-browser-pool-runtime` |
| 7 | Transport publish **policy** | `transport-kernel-publish-port.ts` (native ≠ legacy browser standalone) | Host publish shim without Dev Lab (tombstoned) |
| 8 | Relay recovery projection | `relay-runtime-supervisor.ts` | Treating UI “connected” as network truth |
| 9 | Checkpoints / vault media / call / search-wipe | `transport.*` / `persistence.*` via `engine_invoke` | Re-adding bare `db_*` for those domains |
| 10 | Account backup / sync orchestration | `encrypted-account-backup-service` / `use-account-sync` | Dual backup writers without subtract |
| 11 | Chat UI mirror (pin/hide/unread) | `chat-state-store.ts` — **UI mirror only**, not DM read authority | Using chat-state as sole thread truth |
| 12 | Groups / community membership + group SQLite | **CHARTERED / SOAK-ACTIVE** — engine + membership port + Slice C (U1–U6 lab Done); production proof = [CU-P1](../program/community-production-unpause-charter-2026-08.md) | Free `groups/**` churn · COM-RUN-02 restore · claiming Verified without packaged matrix |

Hard rules:

1. Do not add a second owner for any row above.  
2. Remove or isolate parallel mutation paths **before** behavior fixes.  
3. Dev Lab is **tombstoned** — never a proof surface (`specs/backend/production-rewrite-and-devlab-tombstone-2026-07.md`).  
4. Truth surface = **release / parity desktop** + `engine_invoke` / Rust mesh.

## Non-product residue (do not treat as owners)

| Path | Role |
|------|------|
| `relay-browser-pool-runtime.ts` | Web / standalone non-UI residue (RUST-4c) |
| `enhanced-relay-pool-types.ts` | Shared **types** only — not a runtime owner |
| `publishToUrlsStandalone` + subtracted port | Policy-routed; native must not use browser pool |
| `app/features/dev-lab/**` | Dead / tombstoned |
| Invite / group bare `db_*` | Tombstoned residue — do not re-warm (U2) |

## Interim multiplicity (shrink, do not expand)

### DM thread hydrate (R1)

| Surface | Owner |
|---------|--------|
| **Product (desktop / dm-kernel)** | `useThreadMessages` → `useDmKernelThread` → `loadDmKernelThread` → `fetchDmThreadRows` |
| **Web strict** | `useThreadMessages` → `useInertConversationMessages` |
| UI hydrate tree | **Deleted** (`use-conversation-messages-legacy` gone; native owner refuse-only tombstone) |
| Gateway / helpers | **Deleted Wave 2+3** — stub only; indexed/read-model/materialization/native hydrate gone |
| Kept | `ThreadHistoryPort` types · `read-model.ts` finalize/retry policies · refuse tombstone owner |

**Do not** add another React filter layer.

### Community visible participants (R2 — CHARTERED)

Live cross-profile roster **parity** is **not** a ship goal (COM-RUN-01 / ACC-02). U5 honesty landed; production claims need [CU-P1 soak](../program/community-production-unpause-charter-2026-08.md) Pass.

## Critical Runtime Invariants

1. Identity/profile scope resolves before account-scoped stores mount.  
2. Signed-out windows stay light (no heavy sync/transport ownership).  
3. Recovery completion is never inferred from timeout-only signals.  
4. Local state ≠ network truth; UI success needs evidence.  
5. Startup must fail-open to actionable state (`locked`, `degraded`, `fatal`).  
6. Relay runtime truth and window runtime truth are separate.  
7. One canonical path per user action on release exe.

## Startup and Runtime Flow (Current)

1. `AppProviders` composes startup path.  
2. Desktop window boot + profile bind.  
3. `AuthGateway` + identity + **auth-kernel boot restore**.  
4. `UnlockedAppRuntimeShell` mounts relay (mesh pool) / messaging / network.  
5. `RuntimeActivationManager` emits ready/degraded transitions.

## Required Diagnostics (Do Not Remove)

1. Runtime digest / `logAppEvent` for auth boot + transport.  
2. Mesh / session invokes for L3 soaks on release exe.  
3. Boundary catalogs for `engine_invoke` ACL.

## Change control

Before editing a lifecycle: quote this table’s owner. If your change does not touch that owner, you are likely on a parallel path — stop and subtract.
