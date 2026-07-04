import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { UnsignedNostrEvent } from "@/app/features/crypto/crypto-service";
import { createTeamRelayTransportAdapter } from "@dweb/transport-team-relay";
import type { TransportPort } from "@dweb/transport-contracts";
import type { EnhancedRelayPoolResult } from "@/app/features/relays/hooks/enhanced-relay-pool-types";
import { normalizeRelayUrl } from "@dweb/nostr/relay-utils";
import { buildTeamRelayMembershipUnsignedEvent } from "./community-team-relay-wire";

export type CommunityTeamRelayTransportDeps = Readonly<{
  signMembershipWireEvent?: (
    unsigned: UnsignedNostrEvent,
  ) => Promise<NostrEvent | null>;
}>;

/**
 * Community-scoped transport: publish targets only the bound community relay URL.
 * Subscribe/ingress remains in `use-sealed-community` (relayUrl-scoped pool).
 */
export const createCommunityTeamRelayTransport = (
  relayUrl: string,
  pool: Pick<EnhancedRelayPoolResult, "addTransientRelay" | "reconnectRelay" | "publishToUrl">,
  deps?: CommunityTeamRelayTransportDeps,
): TransportPort => {
  const scopedUrl = normalizeRelayUrl(relayUrl);
  return createTeamRelayTransportAdapter({
    relayUrl: scopedUrl,
    publish: async ({ relayUrl: url, event }) => {
      const unsigned = buildTeamRelayMembershipUnsignedEvent(event);
      if (!unsigned) {
        return { success: false, errorMessage: "team_relay_unsupported_event_type" };
      }

      const sign = deps?.signMembershipWireEvent;
      if (!sign) {
        return { success: false, errorMessage: "team_relay_signing_not_configured" };
      }

      const signedEvent = await sign(unsigned);
      if (!signedEvent) {
        return { success: false, errorMessage: "team_relay_event_sign_failed" };
      }

      if (typeof pool.addTransientRelay === "function") {
        pool.addTransientRelay(url);
      }
      if (typeof pool.reconnectRelay === "function") {
        pool.reconnectRelay(url);
      }
      if (typeof pool.publishToUrl !== "function") {
        return { success: false, errorMessage: "team_relay_publish_to_url_unavailable" };
      }

      const wirePayload = JSON.stringify(["EVENT", signedEvent]);
      const publishResult = await pool.publishToUrl(url, wirePayload);
      if (!publishResult.success) {
        return {
          success: false,
          errorMessage: publishResult.error ?? "relay_publish_failed",
        };
      }
      return { success: true };
    },
  });
};
