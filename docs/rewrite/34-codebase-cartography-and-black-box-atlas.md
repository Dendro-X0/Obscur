# 34 Codebase Cartography and Black-Box Atlas

_Last reviewed: 2026-04-22 (baseline commit a3f16b10)._

Status: active exploration and rewrite-memory contract

## Purpose

This document turns the current repository from a black box into navigable
architecture memory.

It is meant to help future limited-context threads answer:

1. what exists,
2. where complexity is concentrated,
3. which owner files matter most,
4. which domains are most entangled,
5. where systematic refactoring should start.

## Repository Shape

Top-level surfaces:

1. `apps/pwa`
   - primary product/runtime composition surface,
   - contains the majority of fragile feature behavior.
2. `apps/desktop`
   - Tauri host,
   - native session, relay, proxy/Tor, protocol, upload boundaries.
3. `apps/coordination`
   - invite coordination and utility worker surface.
4. `apps/relay-gateway`
   - optional relay edge/proxy surface.
5. `apps/website`
   - public site and release surface.
6. `packages/dweb-*`, `packages/ui-kit`
   - shared TS primitives and contracts.
7. `packages/libobscur`
   - shared Rust protocol and native-network core.

## Complexity Distribution

Approximate repository concentration:

| Area | Approx. files | Notes |
| --- | ---: | --- |
| `apps/pwa` | 971 | Dominant source of product complexity |
| `apps/desktop` | 137 | Native host and command boundary |
| `packages/libobscur` | 50 | Shared Rust protocol/network core |
| Other apps and packages | much smaller | Secondary support layers |

Within `apps/pwa/app/features`, the largest domains are:

| Feature | Approx. files | Approx. size |
| --- | ---: | ---: |
| `messaging` | 270 | ~2271 KB |
| `groups` | 61 | ~594 KB |
| `account-sync` | 38 | ~564 KB |
| `invites` | 50 | ~428 KB |
| `relays` | 56 | ~341 KB |
| `main-shell` | 21 | ~279 KB |
| `auth` | 34 | ~203 KB |

Interpretation:

1. the repo is not uniformly large,
2. the black box is concentrated in a few high-risk domains,
3. future rewrite work should prioritize those domains first.

## Runtime Composition Roots

Current top-down product boot path:

1. `apps/pwa/app/layout.tsx`
2. `apps/pwa/app/components/providers.tsx`
3. `apps/pwa/app/features/profiles/components/desktop-profile-bootstrap.tsx`
4. `apps/pwa/app/features/auth/components/auth-gateway.tsx`
5. `apps/pwa/app/features/runtime/components/unlocked-app-runtime-shell.tsx`

Inside the unlocked runtime shell, the current owner stack is:

1. TanStack query runtime,
2. relay provider,
3. group provider,
4. network provider,
5. runtime activation manager,
6. messaging provider,
7. transport owner provider,
8. dialogs, main shell, and overlays.

Consequence:

1. product truth is recomposed dynamically during boot,
2. many user-visible failures originate from owner order and scope coupling,
3. startup is a prime refactor boundary.

## High-Value Owner Anchors

These are the files that matter most for future rewrite work:

| Domain | Canonical owner |
| --- | --- |
| Window lifecycle | `apps/pwa/app/features/runtime/services/window-runtime-supervisor.ts` |
| Startup auth gating | `apps/pwa/app/features/auth/components/auth-gateway.tsx` |
| Identity/session | `apps/pwa/app/features/auth/hooks/use-identity.ts` |
| Relay runtime/recovery | `apps/pwa/app/features/relays/services/relay-runtime-supervisor.ts` |
| Relay transport | `apps/pwa/app/features/relays/hooks/enhanced-relay-pool.ts` |
| Messaging sidebar state | `apps/pwa/app/features/messaging/providers/messaging-provider.tsx` |
| DM timeline state | `apps/pwa/app/features/messaging/hooks/use-conversation-messages.ts` |
| Account backup/restore | `apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.ts` |
| Community membership durability | `apps/pwa/app/features/groups/providers/group-provider.tsx` |
| Community live ingest/runtime | `apps/pwa/app/features/groups/hooks/use-sealed-community.ts` |
| Community write-side event construction | `apps/pwa/app/features/groups/services/group-service.ts` |
| Desktop native host | `apps/desktop/src-tauri/src/lib.rs` |
| Desktop relay/proxy runtime | `apps/desktop/src-tauri/src/relay.rs`, `apps/desktop/src-tauri/src/net.rs` |

## Black-Box Hotspots

The most behavior-dense files currently are:

1. `apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.ts`
2. `apps/pwa/app/features/main-shell/main-shell.tsx`
3. `apps/pwa/app/features/messaging/components/message-list.tsx`
4. `apps/pwa/app/features/messaging/hooks/use-conversation-messages.ts`
5. `apps/pwa/app/features/relays/hooks/enhanced-relay-pool.ts`
6. `apps/pwa/app/features/messaging/controllers/incoming-dm-event-handler.ts`
7. `apps/pwa/app/features/auth/components/auth-screen.tsx`
8. `apps/pwa/app/features/groups/hooks/use-sealed-community.ts`
9. `apps/pwa/app/features/groups/components/group-management-dialog.tsx`
10. `apps/desktop/src-tauri/src/lib.rs`

Why they are risky:

1. they often own more than one lifecycle,
2. they often mix contracts, persistence, runtime behavior, and UI adaptation,
3. they are where context windows get consumed fastest.

## Main Architectural Fault Lines

### 1. Session and Startup

Files:

1. `apps/pwa/app/features/auth/hooks/use-identity.ts`
2. `apps/pwa/app/features/auth/services/session-api.ts`
3. `apps/pwa/app/features/auth/components/auth-gateway.tsx`
4. `apps/pwa/app/features/profiles/components/desktop-profile-bootstrap.tsx`

Current fault:

1. session truth is split across stored identity,
2. native session state,
3. remember-me storage,
4. profile binding,
5. runtime auth phases.

### 2. Restore and Projection

Files:

1. `apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.ts`
2. `apps/pwa/app/features/account-sync/services/account-projection-read-authority.ts`
3. `apps/pwa/app/features/messaging/providers/messaging-provider.tsx`
4. `apps/pwa/app/features/messaging/hooks/use-conversation-messages.ts`

Current fault:

1. restore import,
2. compatibility chat-state restore,
3. canonical event append,
4. projection reads,
5. persisted/indexed fallback

still overlap.

### 3. Community Membership and Projection

Files:

1. `apps/pwa/app/features/groups/providers/group-provider.tsx`
2. `apps/pwa/app/features/groups/hooks/use-sealed-community.ts`
3. `apps/pwa/app/features/groups/services/community-membership-recovery.ts`
4. `apps/pwa/app/features/groups/services/community-member-roster-projection.ts`
5. community page and management surfaces under `apps/pwa/app/groups` and `apps/pwa/app/features/groups/components`

Current fault:

1. relay roster,
2. DM invite evidence,
3. persisted group rows,
4. known-participant directory,
5. page-local visibility logic

have historically disagreed.

### 4. Relay Runtime and Native Transport

Files:

1. `apps/pwa/app/features/relays/services/relay-runtime-supervisor.ts`
2. `apps/pwa/app/features/relays/hooks/enhanced-relay-pool.ts`
3. `apps/pwa/app/features/relays/hooks/native-relay.ts`
4. `apps/desktop/src-tauri/src/net.rs`
5. `apps/desktop/src-tauri/src/relay.rs`

Current fault:

1. direct transport,
2. fallback relays,
3. native wrappers,
4. proxy/Tor routing,
5. subscription replay

all influence runtime truth.

## Effective Subsystems

The repo is easier to reason about as these subsystems:

1. presentation shell,
2. identity and session,
3. transport runtime,
4. account state and restore,
5. DM system,
6. community system,
7. media and vault,
8. native host and protocol core.

## Recommended Exploration Order

When context is limited, use this order:

1. runtime composition roots,
2. owner docs (`12`, `14`, current handoff),
3. owner file for the failing domain,
4. adjacent contract/reducer/persistence files,
5. focused tests for that owner,
6. only then route/UI files.

Suggested reading order by domain:

### Session/Auth

1. `apps/pwa/app/features/auth/components/auth-gateway.tsx`
2. `apps/pwa/app/features/auth/hooks/use-identity.ts`
3. `apps/pwa/app/features/auth/services/session-api.ts`
4. `apps/pwa/app/features/profiles/components/desktop-profile-bootstrap.tsx`

### Restore/Projection

1. `apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.ts`
2. `apps/pwa/app/features/account-sync/services/account-projection-read-authority.ts`
3. `apps/pwa/app/features/messaging/providers/messaging-provider.tsx`
4. `apps/pwa/app/features/messaging/hooks/use-conversation-messages.ts`

### Communities

1. `apps/pwa/app/features/groups/providers/group-provider.tsx`
2. `apps/pwa/app/features/groups/hooks/use-sealed-community.ts`
3. `apps/pwa/app/features/groups/services/community-membership-recovery.ts`
4. `apps/pwa/app/features/groups/services/community-member-roster-projection.ts`

### Relay/Native

1. `apps/pwa/app/features/relays/services/relay-runtime-supervisor.ts`
2. `apps/pwa/app/features/relays/hooks/enhanced-relay-pool.ts`
3. `apps/desktop/src-tauri/src/relay.rs`
4. `apps/desktop/src-tauri/src/net.rs`

## What The Repo Already Does Well

Despite fragility, the repo already has strong assets:

1. an active documentation culture,
2. many focused tests,
3. clear monorepo separation between apps and packages,
4. typed TS and Rust boundaries,
5. existing diagnostics surfaces,
6. early shared contracts in `packages/dweb-core`.

That means the repo is usable as a reference mine and migration source.

## What Makes It Hard To Finish

The codebase becomes a black box when:

1. one file owns multiple planes,
2. runtime truth is split across relay input, local storage, restore payloads,
   projections, and UI fallback,
3. product behavior is inferred from transport state instead of explicit
   contracts,
4. context windows are spent rediscovering structure instead of building on
   durable memory.

## How To Use This Document

Use this atlas as:

1. the first navigation file for future deep dives,
2. the map for deciding rewrite module boundaries,
3. the reference for deciding which oversized owner files to split first.

It is an orientation document, not completion proof.
