import { createTeamRelayTransportAdapter } from "@dweb/transport-team-relay";
import type { TransportPort } from "@dweb/transport-contracts";
import type { EnhancedRelayPoolResult } from "@/app/features/relays/hooks/enhanced-relay-pool";
import { normalizeRelayUrl } from "@dweb/nostr/relay-utils";

/**
 * Community-scoped transport: publish targets only the bound community relay URL.
 * Subscribe/ingress remains in `use-sealed-community` (relayUrl-scoped pool) until B1 centralizes wire I/O.
 */
export const createCommunityTeamRelayTransport = (
  relayUrl: string,
  pool: Pick<EnhancedRelayPoolResult, "addTransientRelay" | "reconnectRelay" | "publishToUrl">,
): TransportPort => {
  const scopedUrl = normalizeRelayUrl(relayUrl);
  return createTeamRelayTransportAdapter({
    relayUrl: scopedUrl,
    publish: async ({ relayUrl: url }) => {
      if (typeof pool.addTransientRelay === "function") {
        pool.addTransientRelay(url);
      }
      if (typeof pool.reconnectRelay === "function") {
        pool.reconnectRelay(url);
      }
      return { success: true };
    },
  });
};
