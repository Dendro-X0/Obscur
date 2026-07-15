"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Conversation } from "@/app/features/messaging/types";
import type { Message } from "@/app/features/messaging/types";
import {
  resolveLatestIncomingForTrust,
  type TrustConnectionPreviewFallback,
} from "./resolve-latest-incoming-for-trust";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import {
  assessDmTrustWarning,
  type DmTrustAssessment,
  type TrustWarningTier,
} from "./dm-kernel-trust-assessment-port";
import {
  dismissDmTrustBanner,
  getDmTrustThreadState,
  recordPeerIncomingMessage,
  resolveTrustThreadStateKey,
} from "./dm-kernel-trust-thread-state";
import {
  getPeerConnectionRequestCountLastDay,
  getPeerFirstSeenAtUnixMs,
  getPeerIncomingCountLastMinute,
  recordPeerIncomingMessageAtPeerLevel,
} from "./dm-kernel-trust-peer-state";
import { recordAttachmentContentDigestObservation } from "./dm-kernel-trust-attachment-fanout-state";
import { resolvePeerWotDistanceV1 } from "./dm-kernel-trust-metadata-signals";
import { getIncomingRequestAntiAbusePeerSnapshot } from "@/app/features/messaging/services/incoming-request-anti-abuse";
import { MSG_RATE_WINDOW_MS } from "./dm-kernel-trust-spam-signals";
import { isDmKernelAuthority } from "./dm-kernel-policy";
import { getResolvedContactTrustSensitivity } from "./contact-trust-sensitivity-state";

const tierShowsBanner = (tier: TrustWarningTier): boolean => (
  tier === "elevated" || tier === "critical"
);

const tierShowsInfoStrip = (tier: TrustWarningTier): boolean => tier === "info";

export type UseDmKernelTrustBannerResult = Readonly<{
  assessment: DmTrustAssessment | null;
  showBanner: boolean;
  showInfoStrip: boolean;
  dismiss: () => void;
  expanded: boolean;
  setExpanded: (value: boolean) => void;
}>;

export const useDmKernelTrustBanner = (params: Readonly<{
  conversation: Conversation;
  peerPublicKeyHex: PublicKeyHex | string | undefined;
  isPeerAccepted: boolean | undefined;
  isPublicKeyAccepted?: (publicKeyHex: string) => boolean;
  messages: ReadonlyArray<Message>;
  /** Sidebar preview when the chat thread is empty (offline / not opened). */
  connectionFallback?: TrustConnectionPreviewFallback;
  /** When omitted, reads recipient-local sensitivity from profile-scoped storage. */
  contactTrustSensitivity?: import("./contact-trust-sensitivity").ContactTrustSensitivity;
}>): UseDmKernelTrustBannerResult => {
  const [dismissEpoch, setDismissEpoch] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const profileId = getResolvedProfileId();
  const conversationKind = params.conversation.kind;

  const latestIncomingSnapshot = useMemo(
    () => resolveLatestIncomingForTrust(params.messages, params.connectionFallback),
    [params.connectionFallback, params.messages],
  );

  const assessedSenderPublicKeyHex = useMemo((): string | undefined => {
    if (conversationKind === "dm") {
      return params.peerPublicKeyHex;
    }
    return latestIncomingSnapshot?.senderPublicKeyHex ?? undefined;
  }, [conversationKind, latestIncomingSnapshot?.senderPublicKeyHex, params.peerPublicKeyHex]);

  const trustThreadStateKey = useMemo(() => {
    if (!assessedSenderPublicKeyHex && conversationKind === "group") {
      return null;
    }
    return resolveTrustThreadStateKey(
      params.conversation.id,
      conversationKind,
      assessedSenderPublicKeyHex,
    );
  }, [assessedSenderPublicKeyHex, conversationKind, params.conversation.id]);

  const latestIncoming = useMemo(() => {
    if (!latestIncomingSnapshot) {
      return null;
    }
    return {
      content: latestIncomingSnapshot.content,
      timestamp: new Date(latestIncomingSnapshot.timestampUnixMs),
      isOutgoing: false,
    };
  }, [latestIncomingSnapshot]);

  const isSenderAccepted = useMemo((): boolean => {
    if (conversationKind === "dm") {
      return params.isPeerAccepted ?? false;
    }
    if (!assessedSenderPublicKeyHex) {
      return false;
    }
    return params.isPublicKeyAccepted?.(assessedSenderPublicKeyHex) ?? false;
  }, [
    assessedSenderPublicKeyHex,
    conversationKind,
    params.isPeerAccepted,
    params.isPublicKeyAccepted,
  ]);

  useEffect(() => {
    if (
      !latestIncoming
      || !isDmKernelAuthority()
      || !assessedSenderPublicKeyHex
      || !trustThreadStateKey
    ) {
      return;
    }
    recordPeerIncomingMessage(
      profileId,
      trustThreadStateKey,
      latestIncoming.timestamp.getTime(),
    );
    recordPeerIncomingMessageAtPeerLevel(
      profileId,
      assessedSenderPublicKeyHex,
      latestIncoming.timestamp.getTime(),
    );
  }, [
    assessedSenderPublicKeyHex,
    latestIncoming,
    profileId,
    trustThreadStateKey,
  ]);

  const peerIncomingCountLastMinute = useMemo(() => {
    if (!latestIncoming || !assessedSenderPublicKeyHex) {
      return 0;
    }
    const nowUnixMs = latestIncoming.timestamp.getTime();
    const peerWideCount = getPeerIncomingCountLastMinute(
      profileId,
      assessedSenderPublicKeyHex,
      nowUnixMs,
    );
    const windowStart = nowUnixMs - MSG_RATE_WINDOW_MS;
    const threadCount = params.messages.filter((message) => {
      if (message.isOutgoing || message.timestamp.getTime() < windowStart) {
        return false;
      }
      if (conversationKind === "group") {
        return message.senderPubkey === assessedSenderPublicKeyHex;
      }
      return true;
    }).length;
    return Math.max(peerWideCount, threadCount);
  }, [
    assessedSenderPublicKeyHex,
    conversationKind,
    latestIncoming,
    params.messages,
    profileId,
  ]);

  const assessment = useMemo((): DmTrustAssessment | null => {
    if (
      !isDmKernelAuthority()
      || !latestIncoming
      || !assessedSenderPublicKeyHex
      || !trustThreadStateKey
    ) {
      return null;
    }
    if (conversationKind === "dm" && !params.peerPublicKeyHex) {
      return null;
    }

    const threadState = getDmTrustThreadState(profileId, trustThreadStateKey);
    const nowUnixMs = latestIncoming.timestamp.getTime();
    const connectionRequestBurstSnapshot = getIncomingRequestAntiAbusePeerSnapshot({
      peerPublicKeyHex: assessedSenderPublicKeyHex,
      nowUnixMs,
    });
    const contactTrustSensitivity = params.contactTrustSensitivity
      ?? getResolvedContactTrustSensitivity(assessedSenderPublicKeyHex);
    const attachmentContentDigests = latestIncomingSnapshot?.attachmentContentDigests ?? [];
    let attachmentRepeatHashDistinctPeerCount = 0;
    for (const digest of attachmentContentDigests) {
      const distinctPeerCount = recordAttachmentContentDigestObservation(
        profileId,
        digest,
        assessedSenderPublicKeyHex,
        nowUnixMs,
      );
      attachmentRepeatHashDistinctPeerCount = Math.max(
        attachmentRepeatHashDistinctPeerCount,
        distinctPeerCount,
      );
    }
    return assessDmTrustWarning({
      peerPublicKeyHex: assessedSenderPublicKeyHex,
      isPeerAccepted: isSenderAccepted,
      messageContent: latestIncoming.content,
      messageAttachmentFileNames: latestIncomingSnapshot?.attachmentFileNames ?? [],
      messageTimestampUnixMs: nowUnixMs,
      threadFirstPeerMessageAtUnixMs: threadState.firstPeerMessageAtUnixMs,
      dismissedUntilUnixMs: threadState.dismissedUntilUnixMs,
      peerIncomingCountLastMinute,
      peerConnectionRequestCountLastDay: getPeerConnectionRequestCountLastDay(
        profileId,
        assessedSenderPublicKeyHex,
        nowUnixMs,
      ),
      peerFirstSeenAtUnixMs: getPeerFirstSeenAtUnixMs(profileId, assessedSenderPublicKeyHex),
      peerWotDistance: resolvePeerWotDistanceV1(assessedSenderPublicKeyHex, isSenderAccepted),
      attachmentRepeatHashDistinctPeerCount,
      connectionRequestBurstSnapshot,
      contactTrustSensitivity,
      nowUnixMs,
    });
  // dismissEpoch forces re-read after dismiss
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dismissEpoch,
    assessedSenderPublicKeyHex,
    conversationKind,
    isSenderAccepted,
    latestIncoming,
    latestIncomingSnapshot,
    params.peerPublicKeyHex,
    params.contactTrustSensitivity,
    peerIncomingCountLastMinute,
    profileId,
    trustThreadStateKey,
  ]);

  const dismiss = useCallback(() => {
    if (!trustThreadStateKey) {
      return;
    }
    dismissDmTrustBanner(profileId, trustThreadStateKey);
    setDismissEpoch((value) => value + 1);
    setExpanded(false);
  }, [profileId, trustThreadStateKey]);

  const showBanner = assessment !== null && tierShowsBanner(assessment.tier);
  const showInfoStrip = assessment !== null && tierShowsInfoStrip(assessment.tier);

  return {
    assessment,
    showBanner,
    showInfoStrip,
    dismiss,
    expanded,
    setExpanded,
  };
};
