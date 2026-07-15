import type { AssessDmTrustInput } from "./dm-kernel-trust-assessment-port";
import { getAttachmentRepeatHashDistinctPeerCount } from "./dm-kernel-trust-attachment-fanout-state";
import { resolvePeerWotDistanceV1 } from "./dm-kernel-trust-metadata-signals";

export type DmTrustAssessContextFields = Readonly<{
  profileId?: string;
  messageAttachmentContentDigests?: ReadonlyArray<string>;
  peerWotDistance?: number | null;
  attachmentRepeatHashDistinctPeerCount?: number;
}>;

export const resolveAttachmentRepeatHashDistinctPeerCount = (
  profileId: string | undefined,
  digests: ReadonlyArray<string> | undefined,
  nowUnixMs: number,
  explicitCount?: number,
): number | undefined => {
  if (explicitCount != null && explicitCount > 0) {
    return explicitCount;
  }
  if (!profileId || !digests?.length) {
    return undefined;
  }
  let maxDistinctPeers = 0;
  for (const digest of digests) {
    maxDistinctPeers = Math.max(
      maxDistinctPeers,
      getAttachmentRepeatHashDistinctPeerCount(profileId, digest, nowUnixMs),
    );
  }
  return maxDistinctPeers > 0 ? maxDistinctPeers : undefined;
};

/** Enrich assess input with TRUST-INT-1d metadata — single owner for ASE gates + banner. */
export const enrichDmTrustAssessInput = (
  input: AssessDmTrustInput & DmTrustAssessContextFields,
): AssessDmTrustInput => {
  const nowUnixMs = input.nowUnixMs ?? Date.now();
  const peerWotDistance = input.peerWotDistance ?? resolvePeerWotDistanceV1(
    String(input.peerPublicKeyHex),
    input.isPeerAccepted,
  );
  const attachmentRepeatHashDistinctPeerCount = resolveAttachmentRepeatHashDistinctPeerCount(
    input.profileId,
    input.messageAttachmentContentDigests,
    nowUnixMs,
    input.attachmentRepeatHashDistinctPeerCount,
  );

  return {
    peerPublicKeyHex: input.peerPublicKeyHex,
    isPeerAccepted: input.isPeerAccepted,
    messageContent: input.messageContent,
    messageTimestampUnixMs: input.messageTimestampUnixMs,
    threadFirstPeerMessageAtUnixMs: input.threadFirstPeerMessageAtUnixMs,
    dismissedUntilUnixMs: input.dismissedUntilUnixMs,
    messageAttachmentFileNames: input.messageAttachmentFileNames,
    peerFirstSeenAtUnixMs: input.peerFirstSeenAtUnixMs,
    peerWotDistance,
    attachmentRepeatHashDistinctPeerCount,
    peerIncomingCountLastMinute: input.peerIncomingCountLastMinute,
    peerConnectionRequestCountLastDay: input.peerConnectionRequestCountLastDay,
    connectionRequestBurstSnapshot: input.connectionRequestBurstSnapshot,
    contactTrustSensitivity: input.contactTrustSensitivity,
    nowUnixMs: input.nowUnixMs,
  };
};
