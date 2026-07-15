import { detectConnectionRequestBurstSignal } from "@/app/features/dm-kernel/dm-kernel-trust-connection-signals";
import {
  assessIncomingRequestPreview,
  shouldJunkIncomingRequestAssessment,
} from "@/app/features/dm-kernel/dm-kernel-trust-action-gate";
import { getPeerFirstSeenAtUnixMs } from "@/app/features/dm-kernel/dm-kernel-trust-peer-state";
import {
  getIncomingRequestAntiAbusePeerSnapshot,
} from "@/app/features/messaging/services/incoming-request-anti-abuse";
import type { RequestsInboxItem } from "@/app/features/messaging/types";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";

export type IncomingRequestInboxLane = "inbox" | "junk";

export const classifyIncomingRequestInboxLane = (params: Readonly<{
  item: RequestsInboxItem;
  nowUnixMs?: number;
  profileId?: string;
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

  const profileId = params.profileId ?? getResolvedProfileId();
  const messageTimestampUnixMs = params.item.lastReceivedAtUnixSeconds * 1000;
  const { assessment } = assessIncomingRequestPreview({
    peerPublicKeyHex: params.item.peerPublicKeyHex,
    messageContent: params.item.lastMessagePreview,
    messageTimestampUnixMs,
    peerFirstSeenAtUnixMs: getPeerFirstSeenAtUnixMs(profileId, params.item.peerPublicKeyHex),
    profileId,
    connectionRequestBurstSnapshot: snapshot,
    nowUnixMs,
  });

  if (shouldJunkIncomingRequestAssessment(assessment)) {
    return "junk";
  }

  return "inbox";
};
