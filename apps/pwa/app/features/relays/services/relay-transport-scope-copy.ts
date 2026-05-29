import type { RelayPrimarySelection } from "./relay-primary-selector";
import type { RelayTransportMode } from "./relay-transport-mode";

export const formatRelayHostname = (url: string | null | undefined): string => {
  if (!url) {
    return "none";
  }
  try {
    return new URL(url).hostname;
  } catch {
    return url.replace(/^wss?:\/\//, "").split("/")[0] ?? url;
  }
};

export const getActiveTransportScopeCopy = (params: Readonly<{
  selection: RelayPrimarySelection;
  transportMode: RelayTransportMode;
  activePoolRelayUrls: ReadonlyArray<string>;
  writableRelayCount: number;
  subscribableRelayCount: number;
  enabledRelayCount: number;
}>): string => {
  const host = formatRelayHostname(params.selection.primaryUrl);
  if (params.transportMode === "redundancy") {
    const poolHosts = params.activePoolRelayUrls
      .map((url) => formatRelayHostname(url))
      .join(", ");
    return `Nostr redundancy pool (${params.activePoolRelayUrls.length}): ${poolHosts} · primary ${host} · publish-ready ${params.writableRelayCount} · subscribable ${params.subscribableRelayCount}`;
  }
  return `Nostr active transport: ${host} · publish-ready ${params.writableRelayCount} · subscribable ${params.subscribableRelayCount} · ${params.enabledRelayCount} enabled in list`;
};
