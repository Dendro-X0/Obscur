import { isOnionMeshEndpoint } from "@obscur/conduit-mesh";

import { isPrivateOrIntranetRelayUrl } from "@/app/features/relays/services/relay-transport-scope";

export type RelayEndpointAdapterKind =
  | "nostr_public"
  | "private_ws"
  | "http_mesh"
  | "tor_mesh";

export const classifyRelayEndpointAdapter = (relayUrl: string): RelayEndpointAdapterKind => {
  const trimmed = relayUrl.trim();
  if (isOnionMeshEndpoint(trimmed)) {
    return "tor_mesh";
  }
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://")) {
    return "http_mesh";
  }
  if (lower.startsWith("ws://") || lower.startsWith("wss://")) {
    return isPrivateOrIntranetRelayUrl(trimmed) ? "private_ws" : "nostr_public";
  }
  return "private_ws";
};

export const relayEndpointAdapterI18nKey = (kind: RelayEndpointAdapterKind): string => (
  `settings.relays.adapter.${kind}`
);
