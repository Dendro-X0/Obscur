import type { ConduitDescriptor, MeshTorRuntimeState } from "@obscur/conduit-mesh-contracts";

export type ConduitHttpTransportMode = "direct" | "socks" | "blocked";

/**
 * Resolve how HTTP mesh drivers reach a conduit (C13).
 * Drivers do not read Tor settings — the pool injects a fetch bound to this mode.
 */
export const resolveConduitHttpTransportMode = (
  descriptor: ConduitDescriptor,
  torState: MeshTorRuntimeState,
): ConduitHttpTransportMode => {
  const policy = descriptor.networkPolicy;
  if (policy === "clearnet") {
    return "direct";
  }

  if (policy === "tor_required") {
    if (torState.ready && typeof torState.proxyUrl === "string" && torState.proxyUrl.trim().length > 0) {
      return "socks";
    }
    return "blocked";
  }

  // tor_preferred
  if (torState.ready && typeof torState.proxyUrl === "string" && torState.proxyUrl.trim().length > 0) {
    return "socks";
  }
  return "direct";
};

export const isOnionMeshEndpoint = (endpoint: string): boolean => {
  try {
    const host = new URL(endpoint.includes("://") ? endpoint : `http://${endpoint}`).hostname
      .trim()
      .toLowerCase();
    return host.endsWith(".onion");
  } catch {
    return endpoint.toLowerCase().includes(".onion");
  }
};
