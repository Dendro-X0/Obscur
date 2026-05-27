import {
  isCommunityRelayCandidateUrl,
  isDmTransportRelayUrl,
  isPrivateOrIntranetRelayUrl,
} from "@/app/features/relays/services/relay-transport-scope";
import type { RelayConnection } from "@/app/features/relays/hooks/relay-connection";
import type { RelayNodeStatus, RelayUiStatus } from "@/app/features/relays/lib/relay-runtime-status";

/** Settings → Relays metric grid categories (extensible for future transport protocols). */
export type RelaySettingsCategory = "all" | "nostr" | "intranet" | "workspace";

export const RELAY_SETTINGS_CATEGORY_ORDER: ReadonlyArray<RelaySettingsCategory> = [
  "all",
  "nostr",
  "intranet",
  "workspace",
];

export const classifyRelaySettingsCategory = (relayUrl: string): Exclude<RelaySettingsCategory, "all"> => {
  if (isPrivateOrIntranetRelayUrl(relayUrl)) {
    return "intranet";
  }
  if (isCommunityRelayCandidateUrl(relayUrl) && !isDmTransportRelayUrl(relayUrl)) {
    return "workspace";
  }
  return "nostr";
};

export const relayMatchesSettingsCategory = (
  relayUrl: string,
  category: RelaySettingsCategory,
): boolean => category === "all" || classifyRelaySettingsCategory(relayUrl) === category;

export const isRelayNodeCurrentlyAvailable = (params: Readonly<{
  nodeStatus: RelayNodeStatus;
  connection?: RelayConnection;
}>): boolean => {
  const { nodeStatus, connection } = params;
  if (nodeStatus.badge === "Disabled" || nodeStatus.badge === "Disconnected") {
    return false;
  }
  if (connection?.status === "open" || connection?.status === "connecting") {
    return true;
  }
  const availableStatuses: ReadonlySet<RelayUiStatus> = new Set(["healthy", "recovering", "degraded"]);
  return availableStatuses.has(nodeStatus.status);
};
