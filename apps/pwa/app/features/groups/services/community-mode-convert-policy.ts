/**
 * CU-UX-6 — convert existing communities T0↔T1 and/or change hosting host.
 * Reuses create-time trust + Quiet honesty (CU-UX-5); does not open SF-B Spaces.
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunityHostingTier, CommunityMode, RelayCapabilityTier } from "../types";
import {
  assessRelayCapability,
  isPublicDefaultRelayHost,
  normalizeRelayHost,
  type RelayCapabilityAssessment,
} from "./community-mode-contract";
import { assessWorkspaceCommunityTrust } from "./community-trust-policy";
import { assessQuickGroupCreate, resolveHostingTierForCreate } from "./community-quick-group-create";
import { hasWritableCommunityRelayTransport } from "./community-relay-transport";
import { normalizeWorkspaceRelayUrl } from "./workspace-relay-url";
import {
  normalizeCommunityStewardPubkeys,
  resolveInitialStewardPubkeysForCreate,
} from "./community-steward-policy";

export type CommunityConvertReasonCode =
  | "allowed"
  | "not_authorized"
  | "no_change"
  | "relay_unconfigured"
  | "relay_not_writable"
  | "coordination_required"
  | "demote_honesty_required"
  | "public_honesty_required";

export type CommunityConvertAssessment = Readonly<{
  allowed: boolean;
  reasonCode: CommunityConvertReasonCode;
  userMessage: string;
  settingsHint: string;
  requiresHonestyAck: boolean;
  /** When T0→T1 and stewards empty — seed this actor. */
  seedStewardPubkeys: ReadonlyArray<PublicKeyHex>;
  nextCommunityMode: CommunityMode;
  nextHostingTier: CommunityHostingTier;
  nextRelayCapabilityTier: RelayCapabilityTier;
  nextRelayUrl: string;
  modeChanged: boolean;
  hostChanged: boolean;
  relayAssessment: RelayCapabilityAssessment;
}>;

/** Alias — create and convert share one hosting-tier owner. */
export const resolveHostingTierForMutation = resolveHostingTierForCreate;

const normalizeMode = (mode: CommunityMode | null | undefined): CommunityMode => (
  mode === "managed_workspace" ? "managed_workspace" : "sovereign_room"
);

export const assessCommunityModeHostingConvert = (params: Readonly<{
  currentMode: CommunityMode | null | undefined;
  currentRelayUrl: string;
  nextMode: CommunityMode;
  nextRelayHostOrUrl: string;
  actorPublicKeyHex: string | null;
  /** Direct descriptor authority (solo or designated steward). */
  actorCanConvertDirect: boolean;
  honestyAcked: boolean;
  coordinationHealthy?: boolean;
  enabledRelayUrls?: ReadonlyArray<string>;
  currentStewardPubkeys?: ReadonlyArray<string>;
}>): CommunityConvertAssessment => {
  const currentMode = normalizeMode(params.currentMode);
  const nextMode = normalizeMode(params.nextMode);
  const nextRelayUrl = normalizeWorkspaceRelayUrl(params.nextRelayHostOrUrl);
  const currentRelayUrl = normalizeWorkspaceRelayUrl(params.currentRelayUrl);
  const nextHost = normalizeRelayHost(nextRelayUrl) ?? "";
  const currentHost = normalizeRelayHost(currentRelayUrl) ?? "";
  const modeChanged = currentMode !== nextMode;
  const hostChanged = nextHost.toLowerCase() !== currentHost.toLowerCase()
    || nextRelayUrl.toLowerCase() !== currentRelayUrl.toLowerCase();

  const relayAssessment = assessRelayCapability({
    enabledRelayUrls: params.enabledRelayUrls ?? [],
    selectedRelayHost: nextHost,
  });
  const isPublicQuietHost = relayAssessment.tier === "public_default"
    || isPublicDefaultRelayHost(nextHost);
  const nextHostingTier = resolveHostingTierForMutation({
    communityMode: nextMode,
    isPublicQuietHost,
  });
  const empty: CommunityConvertAssessment = {
    allowed: false,
    reasonCode: "no_change",
    userMessage: "",
    settingsHint: "",
    requiresHonestyAck: false,
    seedStewardPubkeys: normalizeCommunityStewardPubkeys(params.currentStewardPubkeys),
    nextCommunityMode: nextMode,
    nextHostingTier,
    nextRelayCapabilityTier: relayAssessment.tier,
    nextRelayUrl: nextRelayUrl || currentRelayUrl,
    modeChanged,
    hostChanged,
    relayAssessment,
  };

  if (!modeChanged && !hostChanged) {
    return {
      ...empty,
      reasonCode: "no_change",
      allowed: true,
      userMessage: "",
      settingsHint: "No mode or hosting changes.",
    };
  }

  if (!params.actorCanConvertDirect) {
    return {
      ...empty,
      reasonCode: "not_authorized",
      userMessage: "Only a steward (or the solo admin) can change community mode or hosting.",
      settingsHint: "Ask a steward, or use governance if this room requires member votes.",
    };
  }

  if (!nextRelayUrl || relayAssessment.tier === "unconfigured") {
    return {
      ...empty,
      reasonCode: "relay_unconfigured",
      userMessage: "Choose a writable relay host before changing mode or hosting.",
      settingsHint: "Pick Quiet public, a VPS/custom wss://, or your private team relay.",
    };
  }

  if (!hasWritableCommunityRelayTransport(nextRelayUrl)) {
    return {
      ...empty,
      reasonCode: "relay_not_writable",
      userMessage: "That host is not a writable Nostr relay URL.",
      settingsHint: "Use wss://… (or ws://localhost:port for local Docker).",
    };
  }

  // T1→T0 demote honesty
  const demotingToInterest = modeChanged
    && currentMode === "managed_workspace"
    && nextMode === "sovereign_room";
  // Public Quiet honesty (create or stay T1 / promote to T1 on Quiet)
  const publicHonestyNeeded = isPublicQuietHost && (
    nextMode === "managed_workspace"
    || (nextMode === "sovereign_room" && hostChanged)
  );
  const requiresHonestyAck = demotingToInterest || publicHonestyNeeded;

  if (nextMode === "managed_workspace") {
    const trust = assessWorkspaceCommunityTrust({
      communityRelayUrl: nextRelayUrl,
      enabledRelayUrls: params.enabledRelayUrls,
      coordinationHealthy: params.coordinationHealthy,
    });
    if (!trust.allowed) {
      return {
        ...empty,
        reasonCode: trust.reasonCode === "coordination_unconfigured"
          || trust.reasonCode === "coordination_unreachable"
          ? "coordination_required"
          : "relay_unconfigured",
        userMessage: trust.userMessage,
        settingsHint: trust.settingsHint,
        requiresHonestyAck: false,
        relayAssessment: trust.relayAssessment,
        nextRelayCapabilityTier: trust.relayAssessment.tier,
      };
    }
  } else {
    const quick = assessQuickGroupCreate({
      communityRelayUrl: nextRelayUrl,
      enabledRelayUrls: params.enabledRelayUrls,
    });
    if (!quick.allowed) {
      return {
        ...empty,
        reasonCode: quick.reasonCode === "relay_not_writable" ? "relay_not_writable" : "relay_unconfigured",
        userMessage: quick.userMessage,
        settingsHint: quick.settingsHint,
        requiresHonestyAck: false,
        relayAssessment: quick.relayAssessment,
        nextRelayCapabilityTier: quick.relayAssessment.tier,
      };
    }
  }

  if (requiresHonestyAck && !params.honestyAcked) {
    return {
      ...empty,
      allowed: false,
      reasonCode: demotingToInterest ? "demote_honesty_required" : "public_honesty_required",
      userMessage: demotingToInterest
        ? "Converting to an interest group drops team directory and steward tooling claims."
        : "Public Quiet hosting needs an honesty acknowledgement before applying.",
      settingsHint: demotingToInterest
        ? "You can convert back to Team later when coordination and a host are ready."
        : "Encrypted chat works on Quiet; full delete-for-all and enterprise directory need a private team relay.",
      requiresHonestyAck: true,
      nextRelayCapabilityTier: relayAssessment.tier,
      nextRelayUrl,
    };
  }

  const existingStewards = normalizeCommunityStewardPubkeys(params.currentStewardPubkeys);
  const seedStewardPubkeys = nextMode === "managed_workspace" && existingStewards.length === 0
    && params.actorPublicKeyHex
    ? resolveInitialStewardPubkeysForCreate({
      communityMode: "managed_workspace",
      creatorPublicKeyHex: params.actorPublicKeyHex as PublicKeyHex,
    })
    : existingStewards;

  return {
    allowed: true,
    reasonCode: "allowed",
    userMessage: "",
    settingsHint: nextMode === "managed_workspace"
      ? "Team mode: coordination owns membership when configured; steward tools stay available."
      : "Interest mode: sealed chat on the chosen relay; steward tools stay inactive until you convert back.",
    requiresHonestyAck,
    seedStewardPubkeys,
    nextCommunityMode: nextMode,
    nextHostingTier,
    nextRelayCapabilityTier: relayAssessment.tier,
    nextRelayUrl,
    modeChanged,
    hostChanged,
    relayAssessment,
  };
};
