# Owner conflict register — `salvage-obscur-T1-owner-conflicts`

Dual-owner lifecycles: **3** / 4 scanned. Top edges: 10.
Signal hygiene: **on** — noise writers filtered: **66** (PREC1).

## Dual-owner edges (top 10)

| Lifecycle | Writer A | Writer B |
|---|---|---|
| `relay-publish` | `apps/pwa/app/features/groups/hooks/use-community-relay-pool-writable.ts` | `apps/pwa/app/features/groups/services/local-workspace-relay-publish.ts` |
| `relay-publish` | `apps/pwa/app/features/groups/hooks/use-community-relay-pool-writable.ts` | `apps/pwa/app/features/groups/services/sealed-community-relay-publish-retry.ts` |
| `relay-publish` | `apps/pwa/app/features/groups/hooks/use-community-relay-pool-writable.ts` | `apps/pwa/app/features/relays/hooks/enhanced-relay-pool-port.ts` |
| `relay-publish` | `apps/pwa/app/features/groups/hooks/use-community-relay-pool-writable.ts` | `apps/pwa/app/features/relays/hooks/enhanced-relay-pool-types.ts` |
| `relay-publish` | `apps/pwa/app/features/groups/hooks/use-community-relay-pool-writable.ts` | `apps/pwa/app/features/relays/hooks/relay-pool-hook-port.ts` |
| `relay-publish` | `apps/pwa/app/features/groups/hooks/use-community-relay-pool-writable.ts` | `apps/pwa/app/features/relays/hooks/use-conduit-mesh-relay-pool.ts` |
| `relay-publish` | `apps/pwa/app/features/groups/hooks/use-community-relay-pool-writable.ts` | `apps/pwa/app/features/relays/hooks/use-enhanced-relay-pool-runtime.ts` |
| `relay-publish` | `apps/pwa/app/features/groups/hooks/use-community-relay-pool-writable.ts` | `apps/pwa/app/features/relays/hooks/use-relay-pool-ref.ts` |
| `relay-publish` | `apps/pwa/app/features/groups/hooks/use-community-relay-pool-writable.ts` | `apps/pwa/app/features/relays/hooks/use-relay-pool.ts` |
| `relay-publish` | `apps/pwa/app/features/groups/hooks/use-community-relay-pool-writable.ts` | `apps/pwa/app/features/relays/hooks/use-transport-kernel-relay-pool.ts` |

## Lifecycles

### `relay-publish` — Relay publish / pool (⚠️ dual-owner)
- Writers (21): `apps/pwa/app/features/groups/hooks/use-community-relay-pool-writable.ts`, `apps/pwa/app/features/groups/services/local-workspace-relay-publish.ts`, `apps/pwa/app/features/groups/services/sealed-community-relay-publish-retry.ts`, `apps/pwa/app/features/relays/hooks/enhanced-relay-pool-port.ts`, `apps/pwa/app/features/relays/hooks/enhanced-relay-pool-types.ts`, `apps/pwa/app/features/relays/hooks/relay-pool-hook-port.ts`, `apps/pwa/app/features/relays/hooks/use-conduit-mesh-relay-pool.ts`, `apps/pwa/app/features/relays/hooks/use-enhanced-relay-pool-runtime.ts`, `apps/pwa/app/features/relays/hooks/use-relay-pool-ref.ts`, `apps/pwa/app/features/relays/hooks/use-relay-pool.ts`, `apps/pwa/app/features/relays/hooks/use-transport-kernel-relay-pool.ts`, `apps/pwa/app/features/relays/services/relay-pool-runtime-port.ts`, `apps/pwa/app/features/relays/services/relay-publish-scope.ts`, `apps/pwa/app/features/relays/services/relay-publish-user-copy.ts`, `apps/pwa/app/features/relays/services/transport-relay-pool-hydration.ts`, `apps/relay-gateway/src/community-relay-hide-registry-persist.ts`, `apps/relay-gateway/src/community-relay-hide-suppress.ts`, `apps/relay-gateway/src/index.ts`, `apps/relay-gateway/src/mesh-http-server.ts`, `packages/obscur-conduit-mesh/src/conduit-mesh-relay-pool-runtime.ts`, `packages/obscur-conduit-mesh/src/resolve-relay-pool-conduit-descriptors.ts`
- Readers (2): `apps/pwa/app/features/relays/services/transport-relay-pool-subscribe.test.ts`, `apps/pwa/app/features/relays/services/transport-relay-pool-subscribe.ts`

### `profile-scope` — Profile / identity scope (⚠️ dual-owner)
- Writers (7): `apps/pwa/app/features/auth-kernel/auth-kernel-profile-scope.ts`, `apps/pwa/app/features/auth/components/auth-gateway.tsx`, `apps/pwa/app/features/auth/hooks/use-identity.ts`, `apps/pwa/app/features/profiles/services/profile-scope.ts`, `apps/pwa/app/features/profiles/services/resolve-desktop-window-profile-scope.ts`, `apps/pwa/app/features/search/hooks/use-identity-resolver.ts`, `apps/pwa/app/settings/settings-tab-panel-models/use-identity-settings-model.ts`
- Readers (0): _none_

### `dm-persist` — DM / outgoing message persist (⚠️ dual-owner)
- Writers (4): `apps/pwa/app/features/groups/services/sealed-group-message-persistence.ts`, `apps/pwa/app/features/messaging/components/message-persistence-durability-owner.tsx`, `apps/pwa/app/features/messaging/services/message-persistence-service.ts`, `apps/pwa/app/features/messaging/services/thread-history/workspace-group-message-persist-port.ts`
- Readers (0): _none_

### `session-hydrate` — Session hydrate / restore (ok)
- Writers (1): `apps/pwa/app/features/auth-kernel/auth-kernel-boot-owner.ts`
- Readers (0): _none_

## IDE contract

Refuse additive writers without subtracting one. No IDE patches until this register exists.

