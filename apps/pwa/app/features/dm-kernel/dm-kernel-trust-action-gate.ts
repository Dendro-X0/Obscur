import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  assessDmTrustWarning,
  resolveTrustActionFriction,
  type AssessDmTrustInput,
  type DmTrustAssessment,
  type TrustActionFrictionLevel,
  type TrustSignalId,
  type TrustWarningTier,
} from "./dm-kernel-trust-assessment-port";
import type { ContactTrustSensitivity } from "./contact-trust-sensitivity";
import type { IncomingRequestAntiAbusePeerSnapshot } from "@/app/features/messaging/services/incoming-request-anti-abuse";
import { enrichDmTrustAssessInput } from "./dm-kernel-trust-assess-context";

export type DmTrustActionGateInput = Readonly<{
  peerPublicKeyHex: PublicKeyHex | string;
  isPeerAccepted: boolean;
  messageContent: string;
  messageTimestampUnixMs: number;
  threadFirstPeerMessageAtUnixMs: number | null;
  messageAttachmentFileNames?: ReadonlyArray<string>;
  peerIncomingCountLastMinute?: number;
  peerConnectionRequestCountLastDay?: number;
  peerFirstSeenAtUnixMs?: number | null;
  peerWotDistance?: number | null;
  attachmentRepeatHashDistinctPeerCount?: number;
  messageAttachmentContentDigests?: ReadonlyArray<string>;
  profileId?: string;
  connectionRequestBurstSnapshot?: IncomingRequestAntiAbusePeerSnapshot | null;
  contactTrustSensitivity?: ContactTrustSensitivity;
  nowUnixMs?: number;
}>;

export type DmTrustActionGateResult = Readonly<{
  assessment: DmTrustAssessment;
  friction: TrustActionFrictionLevel;
}>;

const toAssessInput = (input: DmTrustActionGateInput): AssessDmTrustInput => enrichDmTrustAssessInput({
  peerPublicKeyHex: input.peerPublicKeyHex,
  isPeerAccepted: input.isPeerAccepted,
  messageContent: input.messageContent,
  messageTimestampUnixMs: input.messageTimestampUnixMs,
  threadFirstPeerMessageAtUnixMs: input.threadFirstPeerMessageAtUnixMs,
  dismissedUntilUnixMs: null,
  messageAttachmentFileNames: input.messageAttachmentFileNames,
  peerIncomingCountLastMinute: input.peerIncomingCountLastMinute,
  peerConnectionRequestCountLastDay: input.peerConnectionRequestCountLastDay,
  peerFirstSeenAtUnixMs: input.peerFirstSeenAtUnixMs,
  peerWotDistance: input.peerWotDistance,
  attachmentRepeatHashDistinctPeerCount: input.attachmentRepeatHashDistinctPeerCount,
  messageAttachmentContentDigests: input.messageAttachmentContentDigests,
  profileId: input.profileId,
  connectionRequestBurstSnapshot: input.connectionRequestBurstSnapshot,
  contactTrustSensitivity: input.contactTrustSensitivity,
  nowUnixMs: input.nowUnixMs,
});

/** Canonical ASE entry — same assessment port as DM banner; no duplicate regex. */
export const assessDmTrustActionGate = (
  input: DmTrustActionGateInput,
): DmTrustActionGateResult => {
  const assessment = assessDmTrustWarning(toAssessInput(input));
  return {
    assessment,
    friction: resolveTrustActionFriction(assessment),
  };
};

/** Outbound step-up before send — elevated/critical trust shapes to unaccepted peers. */
export const requiresTrustConfirmBeforeSend = (input: DmTrustActionGateInput): boolean => {
  if (input.isPeerAccepted) {
    return false;
  }
  const { friction } = assessDmTrustActionGate(input);
  return friction === "confirm" || friction === "warn";
};

export type IncomingRequestPreviewInput = Readonly<{
  peerPublicKeyHex: PublicKeyHex | string;
  messageContent: string;
  messageTimestampUnixMs: number;
  peerFirstSeenAtUnixMs?: number | null;
  profileId?: string;
  connectionRequestBurstSnapshot?: IncomingRequestAntiAbusePeerSnapshot | null;
  nowUnixMs?: number;
}>;

export const assessIncomingRequestPreview = (
  input: IncomingRequestPreviewInput,
): DmTrustActionGateResult => assessDmTrustActionGate({
  peerPublicKeyHex: input.peerPublicKeyHex,
  isPeerAccepted: false,
  messageContent: input.messageContent,
  messageTimestampUnixMs: input.messageTimestampUnixMs,
  threadFirstPeerMessageAtUnixMs: input.messageTimestampUnixMs,
  peerFirstSeenAtUnixMs: input.peerFirstSeenAtUnixMs,
  profileId: input.profileId,
  connectionRequestBurstSnapshot: input.connectionRequestBurstSnapshot,
  nowUnixMs: input.nowUnixMs,
});

const isJunkTrustTier = (tier: TrustWarningTier): boolean => (
  tier === "elevated" || tier === "critical"
);

/** Junk routing for pending connection-request previews (M8 / ASE-1d). */
export const shouldJunkIncomingRequestAssessment = (
  assessment: DmTrustAssessment,
): boolean => {
  if (isJunkTrustTier(assessment.tier)) {
    return true;
  }
  if (assessment.bundleId) {
    return true;
  }
  const weakMetadataSignals = new Set<TrustSignalId>([
    "key.age",
    "graph.wot_distance",
  ]);
  const riskySignals = assessment.activeSignals.filter((signal) => (
    signal !== "contact.cold" && !weakMetadataSignals.has(signal)
  ));
  return riskySignals.length > 0;
};
