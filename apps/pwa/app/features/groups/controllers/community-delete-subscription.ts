/**
 * community-delete-subscription.ts
 *
 * Separate subscription channel for community delete commands.
 * Bypasses the 30-second time window constraint to ensure delete-for-everyone
 * works reliably even with relay delays.
 *
 * Design:
 * - Uses tag-based filter (#t: "message-delete") instead of time window
 * - No `since` filter - receives delete commands of any age
 * - Deduplicates based on eventId to avoid processing old deletes
 * - Processes delete commands through the canonical delete pipeline
 */

import type { NostrEvent } from "@dweb/nostr/nostr-event";
import { logAppEvent } from "@/app/shared/log-app-event";
import type { NostrFilter, RelayPoolContract } from "@/app/features/messaging/controllers/v2/dm-controller-types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_PROCESSED_CACHE = 5000;

// ---------------------------------------------------------------------------
// Deduplication cache
// ---------------------------------------------------------------------------

const processedDeleteEventIds = new Set<string>();

const markDeleteProcessed = (eventId: string): boolean => {
  if (processedDeleteEventIds.has(eventId)) {
    return false;
  }
  processedDeleteEventIds.add(eventId);
  if (processedDeleteEventIds.size > MAX_PROCESSED_CACHE) {
    const oldest = processedDeleteEventIds.values().next().value;
    if (oldest) {
      processedDeleteEventIds.delete(oldest);
    }
  }
  return true;
};

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

export type DeleteCommandSubscriptionHandle = Readonly<{
  id: string;
  unsubscribe: () => void;
}>;

export const subscribeToCommunityDeleteCommands = (params: Readonly<{
  pool: RelayPoolContract;
  myPublicKeyHex: string;
  onDeleteCommand: (event: NostrEvent, relayUrl: string) => void;
}>): DeleteCommandSubscriptionHandle => {
  const { pool, myPublicKeyHex, onDeleteCommand } = params;

  // Filter for delete commands by tag, not by time window
  // This ensures we receive delete commands regardless of propagation delay
  const filters: ReadonlyArray<NostrFilter> = [
    {
      kinds: [4, 1059],
      "#p": [myPublicKeyHex],
      "#t": ["message-delete"],
      limit: 100,
      // NO since filter - receive delete commands of any age
    },
    {
      kinds: [4],
      authors: [myPublicKeyHex],
      "#t": ["message-delete"],
      limit: 100,
      // NO since filter - receive delete commands of any age
    },
  ];

  const subId = pool.subscribe(filters, (event: NostrEvent, relayUrl: string) => {
    // Deduplicate: skip if we've already processed this delete command
    if (!markDeleteProcessed(event.id)) {
      logAppEvent({
        name: "messaging.delete_command_dedup",
        level: "debug",
        scope: { feature: "messaging", action: "delete_command_subscription" },
        context: {
          channel: "community_delete_subscription",
          resultCode: "dedup_skipped",
          eventId: event.id.slice(0, 16),
        },
      });
      return;
    }

    logAppEvent({
      name: "messaging.delete_command_received",
      level: "info",
      scope: { feature: "messaging", action: "delete_command_subscription" },
      context: {
        channel: "community_delete_subscription",
        resultCode: "received",
        eventId: event.id.slice(0, 16),
        relayUrl: relayUrl.slice(0, 32),
        kind: event.kind,
        pubkey: event.pubkey.slice(0, 16),
      },
    });

    onDeleteCommand(event, relayUrl);
  });

  logAppEvent({
    name: "messaging.delete_command_subscription_started",
    level: "info",
    scope: { feature: "messaging", action: "delete_command_subscription" },
    context: {
      channel: "community_delete_subscription",
      resultCode: "subscribed",
      subscriptionId: subId.slice(0, 16),
      filters: filters.length,
    },
  });

  return {
    id: subId,
    unsubscribe: () => {
      pool.unsubscribe(subId);
      logAppEvent({
        name: "messaging.delete_command_subscription_stopped",
        level: "info",
        scope: { feature: "messaging", action: "delete_command_subscription" },
        context: {
          channel: "community_delete_subscription",
          resultCode: "unsubscribed",
          subscriptionId: subId.slice(0, 16),
        },
      });
    },
  };
};

// ---------------------------------------------------------------------------
// Internal access for testing
// ---------------------------------------------------------------------------

export const communityDeleteSubscriptionInternals = {
  processedDeleteEventIds,
  markDeleteProcessed,
  clearProcessedCache: () => processedDeleteEventIds.clear(),
};
