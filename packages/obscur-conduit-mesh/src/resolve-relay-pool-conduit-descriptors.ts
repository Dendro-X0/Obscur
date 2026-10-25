import type { ConduitDescriptor } from "@obscur/conduit-mesh-contracts/conduit";

import { isOnionMeshEndpoint } from "./resolve-conduit-http-transport";

const isLocalWarmupEndpoint = (url: string): boolean => {
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const host = new URL(trimmed).hostname;
      return host === "localhost" || host === "127.0.0.1" || host === "::1";
    } catch {
      return false;
    }
  }
  if (!trimmed.startsWith("ws://") && !trimmed.startsWith("wss://")) {
    return false;
  }
  try {
    const host = new URL(trimmed).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return /localhost|:7000|127\.0\.0\.1/.test(trimmed);
  }
};

/**
 * Warm Local Dev Mesh / loopback endpoints before public dials (configure order only;
 * publish scope still prefers remotes when open).
 */
export const prioritizeLocalDevWarmupUrls = (
  urls: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  const local: string[] = [];
  const rest: string[] = [];
  for (const url of urls) {
    if (isLocalWarmupEndpoint(url)) {
      local.push(url);
    } else {
      rest.push(url);
    }
  }
  return [...local, ...rest];
};

/**
 * Map user-configured relay URLs to mesh conduit descriptors for DM relay pool context.
 * WebSocket endpoints use `nostr_ws` (NIP wire); HTTP(S) use team/custom HTTP mesh gateways.
 * Onion HTTP hosts require Tor (C13).
 */
export const resolveRelayPoolConduitDescriptors = (
  urls: ReadonlyArray<string>,
): ReadonlyArray<ConduitDescriptor> => (
  prioritizeLocalDevWarmupUrls(urls).map((url, index) => {
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
