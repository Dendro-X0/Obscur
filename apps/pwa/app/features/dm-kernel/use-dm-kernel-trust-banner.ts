"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Conversation } from "@/app/features/messaging/types";
import type { Message } from "@/app/features/messaging/types";
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
} from "./dm-kernel-trust-thread-state";
import {
  getPeerConnectionRequestCountLastDay,
  recordPeerConnectionRequest,
} from "./dm-kernel-trust-peer-state";
import { MSG_RATE_WINDOW_MS } from "./dm-kernel-trust-spam-signals";
import { isDmKernelAuthority } from "./dm-kernel-policy";

const tierShowsBanner = (tier: TrustWarningTier): boolean => (
  tier === "elevated" || tier === "critical"
);

export type UseDmKernelTrustBannerResult = Readonly<{
  assessment: DmTrustAssessment | null;
  showBanner: boolean;
  dismiss: () => void;
  expanded: boolean;
  setExpanded: (value: boolean) => void;
}>;

export const useDmKernelTrustBanner = (params: Readonly<{
  conversation: Conversation;
  peerPublicKeyHex: PublicKeyHex | string | undefined;
  isPeerAccepted: boolean | undefined;
  messages: ReadonlyArray<Message>;
}>): UseDmKernelTrustBannerResult => {
  const [dismissEpoch, setDismissEpoch] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const profileId = getResolvedProfileId();

  const latestIncoming = useMemo(() => {
    for (let index = params.messages.length - 1; index >= 0; index -= 1) {
      const message = params.messages[index];
      if (!message.isOutgoing) {
        return message;
      }
    }
    return null;
  }, [params.messages]);

  useEffect(() => {
    if (
      !latestIncoming
      || params.conversation.kind !== "dm"
      || !isDmKernelAuthority()
      || !params.peerPublicKeyHex
    ) {
      return;
    }
    recordPeerIncomingMessage(
      profileId,
      params.conversation.id,
      latestIncoming.timestamp.getTime(),
    );
    if (params.isPeerAccepted === false) {
      recordPeerConnectionRequest(
        profileId,
        params.peerPublicKeyHex,
        latestIncoming.timestamp.getTime(),
      );
    }
  }, [
    latestIncoming,
    params.conversation.id,
    params.conversation.kind,
    params.isPeerAccepted,
    params.peerPublicKeyHex,
    profileId,
  ]);

  const peerIncomingCountLastMinute = useMemo(() => {
    if (!latestIncoming) {
      return 0;
    }
    const windowStart = latestIncoming.timestamp.getTime() - MSG_RATE_WINDOW_MS;
    return params.messages.filter(
      (message) => !message.isOutgoing && message.timestamp.getTime() >= windowStart,
    ).length;
  }, [latestIncoming, params.messages]);

  const assessment = useMemo((): DmTrustAssessment | null => {
    if (
      !isDmKernelAuthority()
      || params.conversation.kind !== "dm"
      || !params.peerPublicKeyHex
      || !latestIncoming
    ) {
      return null;
    }

    const threadState = getDmTrustThreadState(profileId, params.conversation.id);
    const nowUnixMs = latestIncoming.timestamp.getTime();
    return assessDmTrustWarning({
      peerPublicKeyHex: params.peerPublicKeyHex,
      isPeerAccepted: params.isPeerAccepted ?? false,
      messageContent: latestIncoming.content,
      messageTimestampUnixMs: nowUnixMs,
      threadFirstPeerMessageAtUnixMs: threadState.firstPeerMessageAtUnixMs,
      dismissedUntilUnixMs: threadState.dismissedUntilUnixMs,
      peerIncomingCountLastMinute,
      peerConnectionRequestCountLastDay: getPeerConnectionRequestCountLastDay(
        profileId,
        params.peerPublicKeyHex,
        nowUnixMs,
      ),
      nowUnixMs,
    });
  // dismissEpoch forces re-read after dismiss
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dismissEpoch,
    latestIncoming,
    params.conversation.id,
    params.conversation.kind,
    params.isPeerAccepted,
    params.peerPublicKeyHex,
    peerIncomingCountLastMinute,
    profileId,
  ]);

  const dismiss = useCallback(() => {
    dismissDmTrustBanner(profileId, params.conversation.id);
    setDismissEpoch((value) => value + 1);
    setExpanded(false);
  }, [params.conversation.id, profileId]);

  const showBanner = assessment !== null && tierShowsBanner(assessment.tier);

  return {
    assessment,
    showBanner,
    dismiss,
    expanded,
    setExpanded,
  };
};
