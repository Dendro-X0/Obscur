# DM Read Model Ownership Extraction Contract

_Last reviewed: 2026-04-22 (baseline commit a3f16b10)._

Status: active rewrite workstream

## Purpose

This workstream defines how to extract DM list and timeline truth from the
current mixed messaging stack into one explicit read-model owner.

It exists because the current DM experience still overlaps across:

1. projection selectors,
2. persisted chat-state fallback,
3. indexed message storage,
4. conversation list authority,
5. conversation history authority,
6. provider-local hydration behavior.

The goal is to preserve all DM features while ending sidebar/timeline restore
drift.

## Current Owner Set

Current primary owners and participants:

1. `apps/pwa/app/features/messaging/providers/messaging-provider.tsx`
2. `apps/pwa/app/features/messaging/hooks/use-conversation-messages.ts`
3. `apps/pwa/app/features/messaging/services/conversation-list-authority.ts`
4. `apps/pwa/app/features/messaging/services/conversation-history-authority.ts`
5. `apps/pwa/app/features/account-sync/services/account-projection-selectors.ts`

Supporting modules:

1. `apps/pwa/app/features/account-sync/services/account-projection-read-authority.ts`
2. `apps/pwa/app/features/messaging/services/chat-state-store.ts`
3. `apps/pwa/app/features/messaging/services/message-persistence-service.ts`
4. `apps/pwa/app/features/messaging/services/message-delete-tombstone-store.ts`
5. `apps/pwa/app/features/messaging/services/message-identity-alias-contract.ts`

## Current Failure Classes

This workstream is responsible for eliminating:

1. sidebar/list and timeline disagreement,
2. partial restore where the timeline is richer than the list or vice versa,
3. projection cutover that happens before runtime parity is safe,
4. message identity alias drift during delete/restore,
5. cross-device history thinning after hydration or replay.

## Future Owner Set

The future architecture should converge on one DM read-model owner stack:

1. `dm-list-read-model owner`
2. `dm-timeline-read-model owner`
3. `message-identity reconciliation owner`
4. `delete convergence owner`
5. `projection-to-ui adapter`

The critical property is unified authority:

1. the list and timeline must derive from the same read-model contract,
2. projection and compatibility inputs must feed one precedence rule,
3. UI adapters must not improvise their own authority logic.

## Required Future Contracts

This workstream should ultimately produce:

1. `dm-list-read-model-contracts`
2. `dm-timeline-read-model-contracts`
3. `message-identity-alias-contracts`
4. `dm-restore-parity-contracts`
5. `delete-convergence-contracts`

Minimum contract fields should cover:

1. conversation id,
2. peer identity,
3. message identity aliases,
4. selected read authority,
5. projection readiness,
6. persisted/indexed richness evidence,
7. delete suppression state.

## Extraction Sequence

### Phase 1. Contract Lock

Lock the read-model outputs and authority reasons into explicit contracts.

Outputs:

1. list authority contract,
2. timeline authority contract,
3. shared reason-code vocabulary,
4. list/timeline parity diagnostics shape.

### Phase 2. Identity and Alias Consolidation

Move message identity alias handling into one explicit module that both list
and timeline owners consume.

Outputs:

1. canonical alias contract,
2. delete-target resolution contract,
3. dedupe contract for restored and replayed messages.

### Phase 3. Read Authority Unification

Reduce `messaging-provider` and `use-conversation-messages` to thin adapters
over one richer-than-projection decision model.

Outputs:

1. one list parity rule,
2. one timeline parity rule,
3. one cutover gate policy,
4. shared restore parity diagnostics.

### Phase 4. Compatibility Retirement

Retire ad hoc list/timeline differences only after runtime replay proves the
shared read model is complete.

Outputs:

1. bridge retirement checklist,
2. retained-compatibility registry,
3. replay proof that no thinner-after-restore regression remains.

## Compatibility Retirement Sequence

Retire in this order:

1. divergent list/timeline authority rules,
2. local hydration branches that bypass the shared read model,
3. projection read cutover assumptions that outrun runtime truth,
4. remaining restore-only coverage repairs that duplicate canonical inputs.

Do not retire compatibility until:

1. fresh restore keeps the same list and timeline truth,
2. delete convergence survives restore and replay,
3. same-account second-window replay stays stable.

## Test Ladder

Minimum test set:

1. unit tests for list authority,
2. unit tests for history authority,
3. unit tests for alias/delete identity handling,
4. provider hydration-scope integration tests,
5. conversation hook integration tests,
6. cross-device restore replay.

Current tests to preserve and extend:

1. `apps/pwa/app/features/messaging/services/conversation-list-authority.test.ts`
2. `apps/pwa/app/features/messaging/services/conversation-history-authority.test.ts`
3. `apps/pwa/app/features/messaging/providers/messaging-provider.hydration-scope.test.tsx`
4. `apps/pwa/app/features/messaging/hooks/use-conversation-messages.integration.test.ts`

## Minimum Runtime Acceptance Packet

This workstream is only complete when runtime replay proves:

1. restored DM sidebar rows and open timeline agree,
2. full restored history survives later hydration,
3. projection cutover does not silently shrink either surface,
4. delete-for-me / delete-for-everyone suppression survives replay,
5. second-window login preserves the same DM truth as the first.

Primary evidence probes:

1. `window.obscurAppEvents.findByName("messaging.conversation_list_authority_selected", 30)`
2. `window.obscurAppEvents.findByName("messaging.conversation_history_authority_selected", 30)`
3. `window.obscurAppEvents.findByName("messaging.conversation_hydration_diagnostics", 30)`
4. `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.selfAuthoredDmContinuity`

## Definition Of Done

This workstream is done only when:

1. list and timeline share one authority model,
2. message alias/delete handling is explicit,
3. restore parity is runtime-verified,
4. thinner-after-restore regressions are blocked by ratchets,
5. future threads can continue from docs alone.
