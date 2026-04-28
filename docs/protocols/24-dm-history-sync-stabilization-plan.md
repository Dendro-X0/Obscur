# 24 DM History Sync Stabilization Plan

_Last reviewed: 2026-04-18 (baseline commit a3f16b10)._

This document defines the implementation plan for fixing Obscur's direct-message
history synchronization and same-device account-scope isolation.

## Problem Statement

Current behavior does not meet the product contract:

1. the same account can show different DM history on different devices or runtimes,
2. fresh-device restore can surface partial history, blank timelines, or metadata
   without materialized messages,
3. same-device account/profile switching still carries overwrite/leak risk because
   multiple caches and stores can rehydrate under ambient scope.

The root issue is overlapping history ownership. DM history can currently be
materialized from:

1. encrypted backup restore,
2. canonical account-event projection,
3. legacy persisted chat-state,
4. IndexedDB `messages` migration,
5. UI fallback heuristics choosing whichever source appears richer.

That owner overlap is the failure, not just a single restore bug.

## Target Outcome

The solution is complete only when both statements are true:

1. logging into the same account on different devices converges on the same
   account data without DM/media/Vault drift,
2. logging into a different account on the same device never leaks, merges,
   overwrites, or reuses prior-account state.

## Chosen Direction

Adopt a projection-first stabilization path with a hard fallback:

1. immediate work will reduce overlapping history owners and make scope
   explicit at restore/cache boundaries,
2. the long-term target is one canonical DM history authority,
3. if projection-first stabilization cannot fully demote the competing owners,
   we escalate to a full history-owner rewrite instead of adding more fallback
   layers.

## Canonical Future Owner Model

### Single Source of Truth

DM history must converge on one canonical private account history lane:

1. one private account event ledger per `profileId + accountPublicKeyHex`,
2. one deterministic projection derived from that ledger,
3. one canonical UI read path for DM sidebar and DM timeline.

### Non-Canonical Roles

The following may exist only as import or cache layers:

1. encrypted backup payloads,
2. persisted chat-state blobs,
3. IndexedDB `messages`,
4. Vault/media aggregation indexes,
5. conversation preview caches.

They must not compete as live truth sources.

## Implementation Phases

### Phase 1: Scope Hardening

Goal:
1. stop same-device account/profile scope drift from rewriting the wrong cache
   or reacting to the wrong restore event.

Required changes:
1. pass `profileId` explicitly into restore/write boundaries that currently
   resolve scope ambiently,
2. include `profileId` in chat-state replacement and message-index rebuild
   event details,
3. make event listeners ignore cross-profile restore/index events,
4. make migration/rebuild paths use explicit scope when supplied.

Exit criteria:
1. restore/write events are explicitly profile-scoped,
2. same-device scope listeners do not react to another profile's restore,
3. focused tests lock the new scope contract.

### Phase 2: Canonical Read Convergence

Goal:
1. remove runtime heuristics where sidebar/timeline choose among projection,
   chat-state, and indexed rows as competing truths.

Required changes:
1. choose one canonical DM read authority,
2. reduce non-canonical read paths to bounded recovery-only or cache-only roles,
3. emit diagnostics whenever fallback is used so fallback becomes temporary and
   measurable instead of normal behavior.

Exit criteria:
1. DM list and DM timeline both read through the same authority,
2. blank-body-with-sidebar-metadata no longer occurs under nominal restore,
3. incoming/outgoing asymmetry no longer depends on local richer cache state.

### Phase 3: Restore As Import, Not Truth

Goal:
1. make encrypted backup restore feed the canonical history owner instead of
   racing it.

Required changes:
1. encrypted backup restore imports canonical account events and required
   non-message domains,
2. chat-state direct writes become cache rebuilds or temporary compatibility
   bridges with explicit retirement conditions,
3. durable delete and media ownership continue through the same canonical lane.

Exit criteria:
1. fresh-device restore no longer produces thinner history than canonical
   account truth,
2. restore and relay catch-up no longer fight over visible DM history.

### Phase 4: Cache Schema Hardening

Goal:
1. ensure derived local stores cannot collide across account/profile scope.

Required changes:
1. all derived message/media caches carry explicit scope,
2. cache rebuilds and reads are keyed by explicit account/profile ownership,
3. stale prior-account rows are not query-visible after scope change.

Exit criteria:
1. same-device account switch cannot resurrect prior-account DM/media state,
2. stale cache rows become unaddressable outside their scope.

### Phase 5: Verification and Freeze

Goal:
1. ratchet the repaired lane so future work cannot silently break it.

Required changes:
1. finalize the sync/history spec,
2. lock focused tests and runtime replay packet,
3. record release truth only after runtime evidence is captured.

Exit criteria:
1. the lane has a canonical owner doc,
2. focused suites are mandatory gates,
3. runtime replay proves two-device convergence and same-device isolation.

## Acceptance Criteria

The lane is considered fixed only when all are true:

1. desktop, native, and fresh-window login show the same DM history for the
   same account,
2. media and Vault entries converge with the same account history,
3. deleted rows stay deleted after restore and catch-up,
4. account switch on the same device does not show previous-account chats,
   previews, or Vault items,
5. diagnostics confirm that scope mismatch and fallback usage are no longer
   the steady-state path.

## Immediate Slice

Implement Phase 1 first:

1. explicit `profileId` in restore-driven chat-state replacement and message
   index rebuild,
2. explicit `profileId` filtering in listeners reacting to restore/rebuild
   events,
3. focused tests for cross-profile ignore behavior.

This does not solve full cross-device convergence by itself, but it removes one
major class of same-device overwrite/conflict risk and creates a cleaner base
for the canonical-history cutover.
