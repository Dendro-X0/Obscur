import {
  assessDmTrustWarning,
  type DmTrustAssessment,
  type TrustWarningTier,
} from "@/app/features/dm-kernel/dm-kernel-trust-assessment-port";
import { detectConnectionRequestBurstSignal } from "@/app/features/dm-kernel/dm-kernel-trust-connection-signals";
import {
  getIncomingRequestAntiAbusePeerSnapshot,
} from "@/app/features/messaging/services/incoming-request-anti-abuse";
import type { RequestsInboxItem } from "@/app/features/messaging/types";

export type IncomingRequestInboxLane = "inbox" | "junk";

const isJunkTrustTier = (tier: TrustWarningTier): boolean => (
  tier === "elevated" || tier === "critical"
);

const shouldRouteIncomingRequestToJunk = (assessment: DmTrustAssessment): boolean => {
  if (isJunkTrustTier(assessment.tier)) {
    return true;
  }
  if (assessment.bundleId) {
    return true;
  }
  const riskySignals = assessment.activeSignals.filter((signal) => (
    signal !== "contact.cold"
  ));
  return riskySignals.length > 0;
};

export const classifyIncomingRequestInboxLane = (params: Readonly<{
  item: RequestsInboxItem;
  nowUnixMs?: number;
}>): IncomingRequestInboxLane => {
  if (params.item.isOutgoing || params.item.status !== "pending") {
    return "inbox";
  }

  const nowUnixMs = params.nowUnixMs ?? Date.now();
  const snapshot = getIncomingRequestAntiAbusePeerSnapshot({
    peerPublicKeyHex: params.item.peerPublicKeyHex,
    nowUnixMs,
  });

  if (detectConnectionRequestBurstSignal(snapshot)) {
    return "junk";
  }

  const messageTimestampUnixMs = params.item.lastReceivedAtUnixSeconds * 1000;
  const assessment = assessDmTrustWarning({
    peerPublicKeyHex: params.item.peerPublicKeyHex,
    isPeerAccepted: false,
    messageContent: params.item.lastMessagePreview,
    messageTimestampUnixMs,
    threadFirstPeerMessageAtUnixMs: messageTimestampUnixMs,
    dismissedUntilUnixMs: null,
    connectionRequestBurstSnapshot: snapshot,
    nowUnixMs,
  });

  if (shouldRouteIncomingRequestToJunk(assessment)) {
    return "junk";
  }

  return "inbox";
};
