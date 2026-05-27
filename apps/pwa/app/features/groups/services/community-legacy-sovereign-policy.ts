import type { CommunityMode } from "../types";
import {
  assessRelayCapability,
  isPublicDefaultRelayHost,
  normalizeRelayHost,
} from "./community-mode-contract";

export type LegacySovereignRoomAssessment = Readonly<{
  isLegacyReadOnly: boolean;
  title: string;
  detail: string;
}>;

/**
 * Sovereign rooms on public Nostr relays are legacy read paths only (Phase 2).
 * New communities must use managed_workspace + coordination + private relay.
 */
export const assessLegacySovereignRoomCommunity = (params: Readonly<{
  communityMode?: CommunityMode | null;
  relayUrl?: string | null;
}>): LegacySovereignRoomAssessment => {
  const relayHost = normalizeRelayHost(params.relayUrl);
  const relayAssessment = assessRelayCapability({
    enabledRelayUrls: [],
    selectedRelayHost: relayHost,
  });
  const isSovereign = params.communityMode === "sovereign_room"
    || (params.communityMode !== "managed_workspace" && relayAssessment.tier === "public_default");
  const isLegacyReadOnly = isSovereign && (
    relayAssessment.tier === "public_default"
    || isPublicDefaultRelayHost(relayHost ?? "")
  );

  if (!isLegacyReadOnly) {
    return {
      isLegacyReadOnly: false,
      title: "",
      detail: "",
    };
  }

  return {
    isLegacyReadOnly: true,
    title: "Legacy sovereign room (read-oriented)",
    detail:
      "This community predates workspace membership authority. Roster hints from public relays are not authoritative; join/leave may not converge. Create a Managed Workspace on coordination + a private relay for reliable membership.",
  };
};

export const isNewSovereignRoomCreationAllowed = (): boolean => false;
