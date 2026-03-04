# Messaging and Groups

_Last reviewed: 2026-03-03 (baseline commit 7f57b32)._


## Direct Message Flow (High Level)

1. Event/message enters app logic.
2. Message bus emits `new_message` / `message_updated` / `message_deleted`.
3. Conversation hook (`use-conversation-messages`) applies changes to active view state.
4. Persistence service syncs operations to IndexedDB.

## Group/Community Flow (High Level)

- Sealed community hook (`use-sealed-community`) processes relay events.
- Realtime events are deduped and merged into descending message state.
- Group messages are also emitted into the messaging bus for unified chat rendering.

## Key Implementation Files

- DM view state: `apps/pwa/app/features/messaging/hooks/use-conversation-messages.ts`
- Message persistence: `apps/pwa/app/features/messaging/services/message-persistence-service.ts`
- Group realtime: `apps/pwa/app/features/groups/hooks/use-sealed-community.ts`
- Chat rendering: `apps/pwa/app/features/messaging/components/message-list.tsx`

## Current Performance-Oriented Behavior

When `chatPerformanceV2 = true`:

- bus events are buffered and applied per animation frame,
- persistence flushes in timed/threshold batches,
- live-message window is soft-capped for smooth scrolling,
- high-load UI paths reduce expensive gestures.
