# Runtime Contracts and Invariants

_Last reviewed: 2026-03-03 (baseline commit 7f57b32)._


This document defines behavior that must remain true across refactors.

## 1) Messaging Bus Contract

Source: `apps/pwa/app/features/messaging/services/message-bus.ts`

Event types:

- `new_message`
- `message_updated`
- `message_deleted`

Required invariants:

1. `message.id` is globally stable for dedupe.
2. `conversationId` is the routing key for active view updates.
3. Delete events must remove matching message id from active state and persistence.
4. Subscriber failures must not break bus fanout (handler exceptions are isolated).

## 2) Conversation State Invariants

Source: `apps/pwa/app/features/messaging/hooks/use-conversation-messages.ts`

1. Message list remains chronologically sorted ascending by timestamp.
2. Within a batch window, last write for same id wins.
3. Deletes are applied atomically with new/update events in the same flush.
4. When `chatPerformanceV2=true` and history is not explicitly expanded:

- soft live window cap is 120 messages.

5. When history is expanded via `loadEarlier`, soft cap is not applied to truncate read context.

## 3) Persistence Invariants

Sources:

- `apps/pwa/app/features/messaging/services/message-persistence-service.ts`
- `packages/dweb-storage/src/indexed-db.ts`

1. Message record key is `id` in the `messages` store.
2. Persisted message includes `conversationId` and numeric `timestampMs`.
3. In performance mode, writes are batched and deduped by id per flush.
4. Flush must run on hidden/unload lifecycle paths to minimize loss window.

## 4) Group Realtime Invariants

Source: `apps/pwa/app/features/groups/hooks/use-sealed-community.ts`

1. Incoming group events are deduped by event id.
2. Group message state remains descending by `created_at`.
3. Relay-scope filtering is enforced before accepting events.
4. Community binding tags must match expected group scope.

## 5) Settings Flag Propagation Contract

Source of truth:

- `apps/pwa/app/features/settings/services/privacy-settings-service.ts`

Propagation event:

- browser event `privacy-settings-changed`

Required behavior:

1. Settings save emits `privacy-settings-changed`.
2. Consumers refresh local flag state from service on this event.
3. Default for `chatPerformanceV2` remains `false` unless rollout decision changes.

## 6) Dev Performance Tooling Contract

Source:

- `apps/pwa/app/features/messaging/dev/chat-performance-dev-tools.ts`

1. Tooling is available only outside production mode.
2. Tooling is safe to call repeatedly (idempotent install guard).
3. Tooling does not alter production runtime behavior.

## 7) Compatibility Expectations

1. PWA and desktop should preserve messaging correctness semantics.
2. Runtime-specific optimizations must not change event correctness.
3. Any contract change here requires matching test updates and changelog mention.
