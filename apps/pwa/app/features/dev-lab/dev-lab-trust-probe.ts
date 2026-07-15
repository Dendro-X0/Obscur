import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  assessDmTrustWarning,
  type DmTrustAssessment,
  type TrustWarningTier,
} from "@/app/features/dm-kernel/dm-kernel-trust-assessment-port";
import {
  clearDmTrustThreadState,
  getDmTrustThreadState,
  recordPeerIncomingMessage,
} from "@/app/features/dm-kernel/dm-kernel-trust-thread-state";
import {
  getPeerConnectionRequestCountLastDay,
} from "@/app/features/dm-kernel/dm-kernel-trust-peer-state";
import { getIncomingRequestAntiAbusePeerSnapshot } from "@/app/features/messaging/services/incoming-request-anti-abuse";
import { MSG_RATE_WINDOW_MS } from "@/app/features/dm-kernel/dm-kernel-trust-spam-signals";
import { toDmConversationId } from "@/app/features/messaging/utils/dm-conversation-id";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";

export type DevLabTrustBannerDomProbe = Readonly<{
  visible: boolean;
  tier: TrustWarningTier | null;
  bundleId: string | null;
  copyKey: string | null;
  recipientOnlyNoteVisible: boolean;
}>;

export type DevLabTrustAssessmentProbe = Readonly<{
  assessment: DmTrustAssessment | null;
  showBanner: boolean;
  conversationId: string | null;
}>;

const tierShowsBanner = (tier: TrustWarningTier): boolean => (
  tier === "elevated" || tier === "critical"
);

const normalizePubkey = (pubkey: string): string => pubkey.trim().toLowerCase();

const readLegacyPeerAccepted = (
  ownerPublicKeyHex: string,
  peerPublicKeyHex: string,
): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    const raw = window.localStorage.getItem(`obscur.peer_trust.v1.${ownerPublicKeyHex}`);
    if (!raw) {
      return false;
    }
    const parsed = JSON.parse(raw) as { acceptedPeers?: ReadonlyArray<string> };
    return (parsed.acceptedPeers ?? []).some(
      (entry) => normalizePubkey(entry) === normalizePubkey(peerPublicKeyHex),
    );
  } catch {
    return false;
  }
};

export const seedDevLabAcceptedPeer = (params: Readonly<{
  ownerPublicKeyHex: PublicKeyHex | string;
  peerPublicKeyHex: PublicKeyHex | string;
}>): Readonly<{ seeded: boolean }> => {
  if (typeof window === "undefined") {
    return { seeded: false };
  }
  const owner = normalizePubkey(params.ownerPublicKeyHex);
  const peer = normalizePubkey(params.peerPublicKeyHex);
  const key = `obscur.peer_trust.v1.${owner}`;
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw
      ? JSON.parse(raw) as { acceptedPeers?: ReadonlyArray<string>; mutedPeers?: ReadonlyArray<string> }
      : { acceptedPeers: [], mutedPeers: [] };
    const acceptedPeers = [...(parsed.acceptedPeers ?? [])];
    if (!acceptedPeers.some((entry) => normalizePubkey(entry) === peer)) {
      acceptedPeers.push(peer as PublicKeyHex);
    }
    window.localStorage.setItem(key, JSON.stringify({
      acceptedPeers,
      mutedPeers: parsed.mutedPeers ?? [],
    }));
    return { seeded: true };
  } catch {
    return { seeded: false };
  }
};

export const seedDevLabEstablishedTrustThread = (params: Readonly<{
  myPublicKeyHex: PublicKeyHex | string;
  peerPublicKeyHex: PublicKeyHex | string;
  firstPeerMessageAtUnixMs?: number;
}>): Readonly<{ seeded: boolean; conversationId: string | null }> => {
  const profileId = getResolvedProfileId();
  const conversationId = toDmConversationId({
    myPublicKeyHex: params.myPublicKeyHex,
    peerPublicKeyHex: params.peerPublicKeyHex,
  });
  if (!profileId || !conversationId) {
    return { seeded: false, conversationId: null };
  }
  recordPeerIncomingMessage(
    profileId,
    conversationId,
    params.firstPeerMessageAtUnixMs ?? Date.now() - 86_400_000,
  );
  return { seeded: true, conversationId };
};

export const clearDevLabDmTrustThreadForPeer = (params: Readonly<{
  myPublicKeyHex: PublicKeyHex | string;
  peerPublicKeyHex: PublicKeyHex | string;
}>): Readonly<{ cleared: boolean; conversationId: string | null }> => {
  const profileId = getResolvedProfileId();
  const conversationId = toDmConversationId({
    myPublicKeyHex: params.myPublicKeyHex,
    peerPublicKeyHex: params.peerPublicKeyHex,
  });
  if (!profileId || !conversationId) {
    return { cleared: false, conversationId: null };
  }
  clearDmTrustThreadState(profileId, conversationId);
  return { cleared: true, conversationId };
};

export const probeDevLabDmTrustAssessmentForPeer = (params: Readonly<{
  myPublicKeyHex: PublicKeyHex | string;
  peerPublicKeyHex: PublicKeyHex | string;
  isPeerAccepted?: boolean;
  messages: ReadonlyArray<Readonly<{
    content: string;
    isOutgoing: boolean;
    timestampUnixMs: number;
  }>>;
}>): DevLabTrustAssessmentProbe => {
  const profileId = getResolvedProfileId();
  const conversationId = toDmConversationId({
    myPublicKeyHex: params.myPublicKeyHex,
    peerPublicKeyHex: params.peerPublicKeyHex,
  });
  if (!profileId || !conversationId) {
    return { assessment: null, showBanner: false, conversationId: null };
  }

  let latestIncoming: { content: string; timestampUnixMs: number } | null = null;
  for (let index = params.messages.length - 1; index >= 0; index -= 1) {
    const message = params.messages[index];
    if (!message.isOutgoing) {
      latestIncoming = message;
      break;
    }
  }
  if (!latestIncoming) {
    return { assessment: null, showBanner: false, conversationId };
  }

  const windowStart = latestIncoming.timestampUnixMs - MSG_RATE_WINDOW_MS;
  const peerIncomingCountLastMinute = params.messages.filter(
    (message) => !message.isOutgoing && message.timestampUnixMs >= windowStart,
  ).length;
  const threadState = getDmTrustThreadState(profileId, conversationId);
  const nowUnixMs = latestIncoming.timestampUnixMs;
  const isPeerAccepted = params.isPeerAccepted
    ?? readLegacyPeerAccepted(params.myPublicKeyHex, params.peerPublicKeyHex);
  const assessment = assessDmTrustWarning({
    peerPublicKeyHex: params.peerPublicKeyHex,
    isPeerAccepted,
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
    connectionRequestBurstSnapshot: getIncomingRequestAntiAbusePeerSnapshot({
      peerPublicKeyHex: params.peerPublicKeyHex as PublicKeyHex,
      nowUnixMs,
    }),
    nowUnixMs,
  });

  return {
    assessment,
    showBanner: tierShowsBanner(assessment.tier),
    conversationId,
  };
};

export const probeDevLabDmTrustBannerDom = (): DevLabTrustBannerDomProbe => {
  const banner = document.querySelector('[data-testid="dm-kernel-trust-banner"]');
  if (!(banner instanceof HTMLElement)) {
    return {
      visible: false,
      tier: null,
      bundleId: null,
      copyKey: null,
      recipientOnlyNoteVisible: false,
    };
  }

  const tier = banner.getAttribute("data-trust-tier");
  const bundleId = banner.getAttribute("data-trust-bundle");
  const copyKey = banner.querySelector("p.text-xs")?.textContent?.trim() ?? null;
  const recipientOnlyNoteVisible = Array.from(banner.querySelectorAll("p"))
    .some((element) => element.textContent?.toLowerCase().includes("recipient-local") ?? false);

  return {
    visible: true,
    tier: tier === "elevated" || tier === "critical" || tier === "info" || tier === "none"
      ? tier
      : null,
    bundleId: bundleId === "none" ? null : bundleId,
    copyKey,
    recipientOnlyNoteVisible,
  };
};

const clickSidebar = (label: string): boolean => {
  const link = document.querySelector(`a[aria-label="${label}"]`);
  if (link instanceof HTMLElement) {
    link.click();
    return true;
  }
  return false;
};

export const openDevLabDmChatContainingText = async (
  needle: string,
  delayMs = 600,
): Promise<Readonly<{ opened: boolean; pathname: string }>> => {
  if (!clickSidebar("Chats")) {
    const chatsLink = document.querySelector('a[aria-label="Chats"]');
    if (chatsLink instanceof HTMLElement) {
      chatsLink.click();
    }
  }
  await new Promise((resolve) => window.setTimeout(resolve, delayMs));

  const rows = document.querySelectorAll('[role="button"][tabindex="0"]');
  for (const row of rows) {
    if (!(row instanceof HTMLElement)) {
      continue;
    }
    const text = row.textContent ?? "";
    if (/^(chats|requests|chat|group)$/i.test(text.trim())) {
      continue;
    }
    if (text.includes(needle)) {
      row.click();
      await new Promise((resolve) => window.setTimeout(resolve, delayMs));
      return { opened: true, pathname: window.location.pathname };
    }
  }

  return { opened: false, pathname: window.location.pathname };
};
