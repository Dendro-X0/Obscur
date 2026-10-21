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
 * Dual-tier (2026-08): sovereign / public Quiet groups are supported Quick groups (T0).
 * No longer mark them read-only — show honesty via create UI / mode badge instead.
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
  const isPublicQuiet = relayAssessment.tier === "public_default"
    || isPublicDefaultRelayHost(relayHost ?? "");

  if (!isSovereign || !isPublicQuiet) {
    return {
      isLegacyReadOnly: false,
      title: "",
      detail: "",
    };
  }

  // Informational only — does not block chat (isLegacyReadOnly stays false).
  return {
    isLegacyReadOnly: false,
    title: "Quick group on public relays",
    detail:
      "Encrypted chat works here. Public relays do not guarantee full message deletion, live roster parity, or enterprise directory controls — use a team-hosted workspace for those.",
  };
};

export { isNewSovereignRoomCreationAllowed } from "@/app/features/workspace-kernel/workspace-kernel-sovereign-create-policy";
