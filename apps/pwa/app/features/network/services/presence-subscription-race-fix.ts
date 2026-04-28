/**
 * Presence Subscription Race Condition Fix
 *
 * Issue: The useRealtimePresence hook has a stale closure bug where
 * subscribedAuthorsFromKey is in the dependency array, but when it changes,
 * the subscription effect uses the old value because useMemo hasn't updated yet.
 *
 * This causes:
 * 1. User A loads app with no peers -> subscribedAuthorsFromKey = []
 * 2. User B added to peers -> subscribedAuthorsKey changes
 * 3. Effect runs but subscribedAuthorsFromKey is still []
 * 4. Subscription not created even though there are now peers
 * 5. User A never sees User B's online status
 *
 * The fix ensures subscription is recreated whenever the peer list changes
 * by using only the stable key in dependencies and deriving the array inside.
 */

import type { NostrEvent } from "nostr-tools";

export type PresenceSubscriptionParams = Readonly<{
  publicKeyHex: string | null;
  acceptedPeers: ReadonlyArray<string>;
  onPresenceEvent: (event: NostrEvent) => void;
  onDuplicateSession?: () => void;
}>;

export type PresenceSubscriptionState = Readonly<{
  subscribedAuthorsKey: string;
  subscribedAuthors: ReadonlyArray<string>;
  shouldSubscribe: boolean;
}>;

/**
 * Computes the stable subscription state from params.
 * This function is pure and can be called during render or in effects.
 */
export const computePresenceSubscriptionState = (
  params: PresenceSubscriptionParams,
): PresenceSubscriptionState => {
  if (!params.publicKeyHex) {
    return {
      subscribedAuthorsKey: "",
      subscribedAuthors: [],
      shouldSubscribe: false,
    };
  }

  // Deduplicate and sort authors for stable comparison
  const uniqueAuthors = Array.from(
    new Set(params.acceptedPeers.filter((pk) => pk && pk !== params.publicKeyHex))
  ).sort();

  const subscribedAuthorsKey = uniqueAuthors.join("|");

  return {
    subscribedAuthorsKey,
    subscribedAuthors: uniqueAuthors,
    shouldSubscribe: uniqueAuthors.length > 0,
  };
};

/**
 * Creates a diagnostic log entry for presence subscription events.
 * Use this to track subscription lifecycle in browser console.
 */
export const logPresenceSubscriptionEvent = (
  event: "subscribing" | "unsubscribing" | "skipped_no_peers" | "peer_list_changed",
  details: Readonly<{
    prevKey?: string;
    nextKey?: string;
    peerCount?: number;
    subscriptionId?: string;
  }>,
): void => {
  // Intentional console log for presence subscription diagnostics
  console.log(
    `[PresenceSubscription] ${event}:`,
    JSON.stringify(details, null, 2)
  );
};

/**
 * Computes the Nostr filter for presence events.
 * Returns null if no peers to subscribe to.
 */
export const computePresenceFilter = (
  subscribedAuthors: ReadonlyArray<string>,
): { kinds: number[]; authors: string[]; limit: number } | null => {
  if (subscribedAuthors.length === 0) {
    return null;
  }

  return {
    kinds: [30315], // PRESENCE_EVENT_KIND
    authors: [...subscribedAuthors],
    limit: 200,
  };
};
