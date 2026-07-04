/**
 * Path B Band B5 — extension module hook registry.
 * Safety, M10 shared intel, and invite economics delegate here; no new chat-state paths.
 */
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { recordPeerConnectionRequest } from "@/app/features/dm-kernel/dm-kernel-trust-peer-state";
import { canSendConnectionRequest } from "@/app/features/invites/utils/security-enhancements";
import {
  evaluateIncomingRequestAntiAbuse,
  type IncomingRequestAntiAbuseDecision,
  resetIncomingRequestAntiAbuseState,
} from "./incoming-request-anti-abuse";
import {
  evaluateIncomingRequestAttackModeGate,
  getAttackModeSafetyProfile,
  type AttackModeGateDecision,
  type AttackModeSafetyProfile,
  type RelayRiskLevel,
} from "./m10-shared-intel-policy";

export const PATH_B_THREAD_WARNING_COMPONENT = "StrangerWarningBanner" as const;

export type PathBThreadWarningEligibility = Readonly<{
  conversationKind: "dm" | "group" | string;
  isPeerAccepted: boolean | undefined;
}>;

/** Recipient-only tier: show thread chrome when DM peer is not yet accepted. */
export const shouldShowPathBThreadWarningBanner = (
  params: PathBThreadWarningEligibility,
): boolean => (
  params.conversationKind === "dm" && params.isPeerAccepted === false
);

/** DM receive pipeline safety gate (rate limits + M10 strict mode). */
export const evaluatePathBIncomingDmSafetyGate = (
  params: Parameters<typeof evaluateIncomingRequestAntiAbuse>[0],
): IncomingRequestAntiAbuseDecision => evaluateIncomingRequestAntiAbuse(params);

/** Outbound connection-request invite economics gate. */
export const evaluatePathBConnectionRequestEconomicsGate = (
  accountPublicKeyHex: PublicKeyHex | string,
): boolean => canSendConnectionRequest(accountPublicKeyHex);

/** Canonical fanout counter — call when a connection request is allowed through anti-abuse. */
export const observePathBIncomingConnectionRequest = (params: Readonly<{
  peerPublicKeyHex: PublicKeyHex;
  observedAtUnixMs?: number;
}>): void => {
  recordPeerConnectionRequest(
    getResolvedProfileId(),
    params.peerPublicKeyHex,
    params.observedAtUnixMs ?? Date.now(),
  );
};

export type PathBM10StrictGateInput = Readonly<{
  safetyProfile?: AttackModeSafetyProfile;
  relayRiskLevel: RelayRiskLevel;
  peerBlockedBySharedIntel: boolean;
  contractViolationDetected?: boolean;
}>;

/** M10 shared-intel strict mode gate (receive-side attack mode). */
export const evaluatePathBM10StrictModeGate = (
  params: PathBM10StrictGateInput,
): AttackModeGateDecision => evaluateIncomingRequestAttackModeGate({
  safetyProfile: params.safetyProfile ?? getAttackModeSafetyProfile(),
  relayRiskLevel: params.relayRiskLevel,
  peerBlockedBySharedIntel: params.peerBlockedBySharedIntel,
  contractViolationDetected: params.contractViolationDetected ?? false,
});

export { resetIncomingRequestAntiAbuseState };
