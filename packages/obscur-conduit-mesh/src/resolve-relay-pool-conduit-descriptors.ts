import type { ConduitDescriptor } from "@obscur/conduit-mesh-contracts";

import { isOnionMeshEndpoint } from "./resolve-conduit-http-transport";

/**
 * Map user-configured relay URLs to mesh conduit descriptors for DM relay pool context.
 * WebSocket endpoints use `nostr_ws` (NIP wire); HTTP(S) use team/custom HTTP mesh gateways.
 * Onion HTTP hosts require Tor (C13).
 */
export const resolveRelayPoolConduitDescriptors = (
  urls: ReadonlyArray<string>,
): ReadonlyArray<ConduitDescriptor> => (
  urls.map((url, index) => {
    const trimmed = url.trim();
    const isWebSocket = trimmed.startsWith("ws://") || trimmed.startsWith("wss://");
    const onion = isOnionMeshEndpoint(trimmed);
    return {
      conduitId: `relay-pool-${index}-${trimmed}`,
      dialect: isWebSocket ? "nostr_ws" as const : "team_relay" as const,
      endpoints: [trimmed],
      capabilities: ["publish", "subscribe"],
      networkPolicy: onion ? "tor_required" as const : "clearnet" as const,
      trustTier: "user_configured" as const,
      enabled: true,
      priority: index,
    };
  })
);
