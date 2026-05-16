# Client unified gateway (R0)

**Last updated:** 2026-05-15  
**Status:** R0/R1/R2 engineering exit — DM materialization + community roster routed via `ClientGateway`; Phase 3 membership ingress landed (see `docs/program/v1.5.0-phase3-scope.md`).

## Problem

Decentralization belongs at the **application/protocol** layer (immutable events, relays, per-device interpretation). When the same concern is decentralized **in code** — parallel hydrators, `isTauri` branches in features, direct singleton imports — the client exhibits the same failures after every rewrite:

- Delete-for-me vs projection vs IndexedDB vs SQLite
- Community roster vs relay snapshot vs directory vs sealed-community state

Incremental debugging cannot converge while multiple pathways own the same UI truth.

## Decision

All **client-side mutations and local read gates** (Web/PWA, desktop Tauri, mobile shell) route through one object:

**`ClientGateway`** (`@dweb/client-gateway`) installed at profile runtime bootstrap.

Feature code calls:

```typescript
import { getResolvedClientGateway } from "@/app/features/profiles/services/resolve-client-gateway";

const gateway = getResolvedClientGateway();
await gateway.localDmVisibility.executeDeleteForMe({ ... });
gateway.messageDeleteTombstones.isMessageDeleteSuppressed(messageId, Date.now(), profileId);
```

React code may use `useResolvedClientGateway()` from `ProfileRuntimeProvider`.

## Rules (enforced by review; ESLint to follow)

1. **No hybrid paths** — Do not call `localDmVisibilityOwner`, `getResolvedStoragePorts()`, or `isTauri()` inside `apps/pwa/app/features/**` for product behavior. Platform branching lives in `client-gateway-adapter.ts` and store implementations only.
2. **Explicit scope** — Gateway carries `profileId` (and `publicKeyHex` when known). Ports receive `profileId` on every call.
3. **Subtract, don't add** — New behavior extends `ClientGateway` ports or replaces a legacy path; do not add a fourth hydrator.
4. **Different errors** — Prefer a single wrong owner with clear diagnostics over three owners that fail the same way.

## Package layout

| Module | Role |
| --- | --- |
| `@dweb/client-gateway` | Contracts + `buildClientGateway` (no app imports) |
| `apps/pwa/app/features/runtime/services/client-gateway-adapter.ts` | Platform + capability resolution; binds PWA owners |
| `apps/pwa/app/features/profiles/services/resolve-client-gateway.ts` | `getResolvedClientGateway()` for services |
| `ProfileRuntimeProvider` | Installs `clientGateway` on `setProfileRuntimeScope` |

## Port rollout (execution order)

| Port | Status | Replaces |
| --- | --- | --- |
| `messageDeleteTombstones` | Routed | `getResolvedStoragePorts().messageDeleteTombstones` in features |
| `localDmVisibility` | Routed | Direct `localDmVisibilityOwner` in features |
| `dmConversationMaterialization` | **Routed** | hydrate, projection evidence/merge, load-earlier, **`applyRealtimeBufferedEvents`** — `dm-conversation-materialization-*.ts` |
| `communityRoster` | **Routed** | seed/active/snapshot, author evidence, **`stabilizeMemberPubkeys`**, persist* — `community-roster-materialization-*.ts` |

**App extension type:** `AppClientGateway` = `FullClientGateway<DmConversationMaterializationPort, CommunityRosterMaterializationPort>` (`apps/pwa/app/features/runtime/types/app-client-gateway.ts`).

**Package contracts:** `@dweb/client-gateway/community-roster` (typed R2), `@dweb/client-gateway/dm-materialization` (generic R1 hydrate result), `@dweb/client-gateway/messaging-diagnostics` (`toConversationIdDiagnosticLabel` — single source for hydrate, persistence, restore, and projection logs).

**ESLint (R0 exit):** `apps/pwa/eslint.config.mjs` blocks hybrid imports in `app/features/**` (tests and owner modules exempt).

**CI grep guard:** `pnpm gateway:boundaries:check` — mirrors ESLint forbidden symbols in `app/features/**`.

## Related docs

- `docs/program/v1.5.0-architecture-refactor-queue.md` — R0 → R1 → R2 order
- `docs/encyclopedia/12-core-architecture-truth-map.md` — owner table (gateway row)
- `docs/messaging/deletion-roster-limitations.md` — prior symptoms until R1/R2 exit
