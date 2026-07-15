import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { requiresTrustConfirmBeforeSend } from "@/app/features/dm-kernel/dm-kernel-trust-action-gate";
import {
  buildIdentityBindingViewModel,
  encodeIdentityBindingNpub,
  formatIdentityKeyFragment,
  type IdentityBindingViewModel,
} from "./identity-binding-presenter";

const SEND_CEREMONY_STORAGE_KEY = "obscur.send_ceremony.v1";

export type SendCeremonyReason = "first_dm" | "trust_confirm";

export type SendCeremonyViewModel = Readonly<{
  senderPublicKeyHex: PublicKeyHex;
  senderNpub: string;
  senderNpubFragment: string;
  recipientBinding: IdentityBindingViewModel;
  plaintextPreview?: string;
  reason: SendCeremonyReason;
}>;

export type SendCeremonyRequest = Readonly<{
  senderPublicKeyHex: PublicKeyHex;
  recipientPublicKeyHex: PublicKeyHex;
  recipientDisplayName?: string | null;
  plaintextPreview?: string;
  reason?: SendCeremonyReason;
}>;

export type SendCeremonyRequirement = Readonly<{
  required: boolean;
  reason: SendCeremonyReason | null;
}>;

export type ResolveSendCeremonyRequirementInput = Readonly<{
  profileId: string;
  peerPublicKeyHex: PublicKeyHex;
  priorOutgoingUserMessageCount: number;
  isPeerAccepted: boolean;
  messageContent: string;
  threadFirstPeerMessageAtUnixMs: number | null;
  peerFirstSeenAtUnixMs?: number | null;
  nowUnixMs?: number;
}>;

const ceremonyStorageKey = (profileId: string, peerPublicKeyHex: PublicKeyHex): string => (
  getScopedStorageKey(`${SEND_CEREMONY_STORAGE_KEY}::${peerPublicKeyHex}`, profileId)
);

export const isSendCeremonyAcknowledged = (
  profileId: string,
  peerPublicKeyHex: PublicKeyHex,
): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem(ceremonyStorageKey(profileId, peerPublicKeyHex)) === "1";
  } catch {
    return false;
  }
};

export const acknowledgeSendCeremony = (
  profileId: string,
  peerPublicKeyHex: PublicKeyHex,
): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(ceremonyStorageKey(profileId, peerPublicKeyHex), "1");
  } catch {
    // Best-effort persistence only.
  }
};

export const requiresFirstDmSendCeremony = (params: Readonly<{
  profileId: string;
  peerPublicKeyHex: PublicKeyHex;
  priorOutgoingUserMessageCount: number;
}>): boolean => {
  if (params.priorOutgoingUserMessageCount > 0) {
    return false;
  }
  return !isSendCeremonyAcknowledged(params.profileId, params.peerPublicKeyHex);
};

export const resolveSendCeremonyRequirement = (
  params: ResolveSendCeremonyRequirementInput,
): SendCeremonyRequirement => {
  if (requiresFirstDmSendCeremony({
    profileId: params.profileId,
    peerPublicKeyHex: params.peerPublicKeyHex,
    priorOutgoingUserMessageCount: params.priorOutgoingUserMessageCount,
  })) {
    return { required: true, reason: "first_dm" };
  }
  if (requiresTrustConfirmBeforeSend({
    peerPublicKeyHex: params.peerPublicKeyHex,
    isPeerAccepted: params.isPeerAccepted,
    messageContent: params.messageContent,
    messageTimestampUnixMs: params.nowUnixMs ?? Date.now(),
    threadFirstPeerMessageAtUnixMs: params.threadFirstPeerMessageAtUnixMs,
    peerFirstSeenAtUnixMs: params.peerFirstSeenAtUnixMs,
    profileId: params.profileId,
    nowUnixMs: params.nowUnixMs,
  })) {
    return { required: true, reason: "trust_confirm" };
  }
  return { required: false, reason: null };
};

export const buildSendCeremonyViewModel = (
  request: SendCeremonyRequest,
): SendCeremonyViewModel | null => {
  const recipientBinding = buildIdentityBindingViewModel({
    publicKeyHex: request.recipientPublicKeyHex,
    displayName: request.recipientDisplayName ?? null,
    resolverSource: "manual",
    confidence: "relay_confirmed",
  });
  if (!recipientBinding) {
    return null;
  }
  const senderNpub = encodeIdentityBindingNpub(request.senderPublicKeyHex);
  return {
    senderPublicKeyHex: request.senderPublicKeyHex,
    senderNpub,
    senderNpubFragment: formatIdentityKeyFragment(senderNpub),
    recipientBinding,
    plaintextPreview: request.plaintextPreview?.trim() || undefined,
    reason: request.reason ?? "first_dm",
  };
};
