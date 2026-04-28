# 37 Owner-Aligned Extraction Workstreams

_Last reviewed: 2026-04-22 (baseline commit a3f16b10)._

Status: active rewrite-execution contract

## Purpose

This document translates the current black-box repo into future rewrite
workstreams.

It exists to answer:

1. which current modules map to which future owners,
2. what each workstream is responsible for,
3. what order the workstreams should be executed in,
4. what each workstream must produce before the next one begins.

This is not a feature-cut plan.

It is a full-scope rewrite sequencing contract that preserves the product goal
while reducing architectural ambiguity.

## Relationship to Existing Docs

Use together with:

1. `docs/rewrite/34-codebase-cartography-and-black-box-atlas.md`
2. `docs/rewrite/35-data-sovereignty-and-unified-backend-rewrite-target.md`
3. `docs/rewrite/36-resilient-infrastructure-and-technical-protocols.md`
4. `docs/12-core-architecture-truth-map.md`
5. `docs/14-module-owner-index.md`

Those files define:

1. what exists now,
2. what the future architecture should be,
3. which files currently own fragile behavior.

This file defines how to move from current owners to future owners.

## Extraction Rules

Every workstream must follow these rules:

1. one future owner per truth surface,
2. contracts first, adapters second, replacement third,
3. no new UI-layer fallback truth,
4. no feature cuts,
5. no claiming completion from tests alone when runtime behavior is still
   divergent.

## Workstream Inventory

### 1. Session and Startup Ownership

Current primary modules:

1. `apps/pwa/app/features/auth/hooks/use-identity.ts`
2. `apps/pwa/app/features/auth/services/session-api.ts`
3. `apps/pwa/app/features/auth/components/auth-gateway.tsx`
4. `apps/pwa/app/features/profiles/components/desktop-profile-bootstrap.tsx`
5. `apps/pwa/app/features/runtime/components/profile-bound-auth-shell.tsx`

Future owner goal:

1. one session/bootstrap owner for:
   - stored identity,
   - native session state,
   - remember-me state,
   - profile binding,
   - startup auth decision.

Required outputs:

1. session contracts,
2. startup state machine,
3. profile-bound session restore adapter,
4. mismatch and degraded-state diagnostics,
5. relaunch continuity replay packet.

### 2. Restore and Import Ownership

Current primary modules:

1. `apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.ts`
2. `apps/pwa/app/features/account-sync/services/account-sync-migration-policy.ts`
3. `apps/pwa/app/features/account-sync/services/account-projection-read-authority.ts`
4. `apps/pwa/app/features/messaging/services/chat-state-store.ts`
5. `apps/pwa/app/features/messaging/services/message-persistence-service.ts`

Future owner goal:

1. one restore/import owner for:
   - backup parsing,
   - compatibility restore boundaries,
   - canonical event reconstruction,
   - projection materialization,
   - restore diagnostics.

Required outputs:

1. restore-import contracts,
2. import precedence rules,
3. explicit compatibility bridge list,
4. import-to-projection pipeline,
5. fresh-device restore replay packet.

### 3. DM Read Model Ownership

Current primary modules:

1. `apps/pwa/app/features/messaging/providers/messaging-provider.tsx`
2. `apps/pwa/app/features/messaging/hooks/use-conversation-messages.ts`
3. `apps/pwa/app/features/messaging/services/conversation-list-authority.ts`
4. `apps/pwa/app/features/messaging/services/conversation-history-authority.ts`
5. `apps/pwa/app/features/account-sync/services/account-projection-selectors.ts`

Future owner goal:

1. one DM read-model owner for:
   - conversation list,
   - conversation timeline,
   - message identity reconciliation,
   - restore/live parity,
   - delete convergence.

Required outputs:

1. DM read-model contracts,
2. sidebar authority contract,
3. timeline authority contract,
4. message identity alias contract,
5. cross-device DM replay packet.

### 4. Community Membership and Directory Ownership

Current primary modules:

1. `apps/pwa/app/features/groups/providers/group-provider.tsx`
2. `apps/pwa/app/features/groups/hooks/use-sealed-community.ts`
3. `apps/pwa/app/features/groups/services/community-membership-recovery.ts`
4. `apps/pwa/app/features/groups/services/community-member-roster-projection.ts`
5. `apps/pwa/app/features/groups/services/community-known-participant-directory.ts`
6. `apps/pwa/app/groups/[...id]/group-home-page-client.tsx`
7. `apps/pwa/app/features/groups/components/group-management-dialog.tsx`

Future owner goal:

1. one community read owner for:
   - joined membership,
   - participant directory,
   - roster projection,
   - room-key/sendability prerequisites,
   - governance-visible state.

Required outputs:

1. community membership contracts,
2. community directory contracts,
3. one projection-backed participant list owner,
4. explicit live roster vs removal evidence rules,
5. two-user participant visibility replay packet.

### 5. Relay Runtime and Transport Ownership

Current primary modules:

1. `apps/pwa/app/features/relays/services/relay-runtime-supervisor.ts`
2. `apps/pwa/app/features/relays/hooks/enhanced-relay-pool.ts`
3. `apps/pwa/app/features/relays/hooks/native-relay.ts`
4. `apps/pwa/app/features/relays/services/sticky-relay-recovery.ts`
5. `apps/desktop/src-tauri/src/net.rs`
6. `apps/desktop/src-tauri/src/relay.rs`

Future owner goal:

1. one transport owner for:
   - connection lifecycle,
   - retry and replay cadence,
   - proxy/Tor routing mode,
   - scoped publish truth,
   - transport diagnostics.

Required outputs:

1. transport-routing contracts,
2. native transport capability contract,
3. replay-subscription contract,
4. proxy/Tor calibration contract,
5. degraded transport replay packet.

### 6. Coordination Backend Ownership

Current primary modules and references:

1. `apps/coordination/src/index.ts`
2. `apps/relay-gateway/src/index.ts`
3. `apps/pwa/app/features/search`
4. `apps/pwa/app/features/invites`
5. `docs/rewrite/35-data-sovereignty-and-unified-backend-rewrite-target.md`
6. `docs/rewrite/36-resilient-infrastructure-and-technical-protocols.md`

Future owner goal:

1. one modular coordination backend for:
   - session continuity metadata,
   - invite workflows,
   - community membership coordination,
   - restore indexing support,
   - search and discovery coordination.

Required outputs:

1. service boundary map,
2. backend contracts,
3. privacy and plaintext boundary rules,
4. deployment topology options,
5. backend bootstrap plan.

## Execution Order

The rewrite should proceed in this order:

1. Session and Startup Ownership
2. Restore and Import Ownership
3. DM Read Model Ownership
4. Community Membership and Directory Ownership
5. Relay Runtime and Transport Ownership
6. Coordination Backend Ownership

Reason:

1. startup must become deterministic before any deeper feature work can be
   trusted,
2. restore/import must become singular before read models are stable,
3. DM and community read models are the highest-value user-facing truth planes,
4. transport should support those truth planes, not continue redefining them,
5. backend coordination should be designed after local truth owners are clear.

## Per-Workstream Deliverables

Every workstream should produce:

1. one contract doc,
2. one owner map,
3. one compatibility bridge list,
4. one focused test ladder,
5. one runtime replay checklist,
6. one explicit “not yet migrated” section.

## Extraction Style

Work should be extracted by planes, not by file count.

Good extraction:

1. contract module,
2. reducer or authority module,
3. persistence adapter,
4. UI adapter.

Bad extraction:

1. splitting giant files randomly by size,
2. moving helpers without clarifying ownership,
3. creating a second projection or second restore path.

## Definition Of Done Per Workstream

A workstream is only considered mature when:

1. the future owner is explicit,
2. the current owner overlap is named,
3. compatibility bridges are bounded,
4. focused tests exist,
5. runtime replay exists,
6. future threads can continue from docs alone.

## What Must Not Happen Next

Do not:

1. continue broad behavior patches without mapping them to one of these
   workstreams,
2. keep adding UI continuity heuristics indefinitely,
3. treat relays as universal truth owners again,
4. design a new backend without preserving data sovereignty guarantees.

## Immediate Next Step

The next documentation phase should produce one doc per workstream:

1. current owner set,
2. future owner set,
3. extraction sequence,
4. compatibility retirement sequence,
5. minimum runtime acceptance packet.

That converts the rewrite from “good intention” into executable work.
