import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { listAccountSharedSqliteProfileIds } from "@/app/features/profiles/services/account-shared-sqlite-profile-ids";
import { chatStateStoreService } from "@/app/features/messaging/services/chat-state-store";
import { loadNativeOutgoingChatStateRepairMessages } from "@/app/features/messaging/services/dm-conversation-native-outgoing-repair";
import { loadNativeOutgoingCommunityInviteRepairMessages } from "@/app/features/messaging/services/dm-conversation-native-invite-repair";
import {
  dispatchMessagesIndexRebuiltEvent,
} from "@/app/features/messaging/services/message-persistence-service";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { logAppEvent } from "@/app/shared/log-app-event";
import { isSecondaryProfileWindow } from "./secondary-profile-post-login-refresh-policy";

export const SECONDARY_PROFILE_DM_SOFT_REFRESH_EVENT = "obscur:secondary-profile-dm-soft-refresh";

export type SecondaryProfileDmSoftRefreshDetail = Readonly<{
  profileId: string;
  reason: string;
  forceIndexedAuthority: boolean;
  repairedMessageCount: number;
}>;

const listChatStateConversationIds = (params: Readonly<{
  profileId: string;
  myPublicKeyHex: PublicKeyHex;
}>): ReadonlyArray<string> => {
  const profileIds = listAccountSharedSqliteProfileIds({
    primaryProfileId: params.profileId,
    accountPublicKeyHex: params.myPublicKeyHex,
  });
  const conversationIds = new Set<string>();
  profileIds.forEach((profileId) => {
    const persisted = chatStateStoreService.load(params.myPublicKeyHex, { profileId });
    Object.keys(persisted?.messagesByConversationId ?? {}).forEach((conversationId) => {
      if (conversationId.trim().length > 0) {
        conversationIds.add(conversationId);
      }
    });
  });
  return Array.from(conversationIds);
};

export const runSecondaryProfileDmSoftRefresh = (params: Readonly<{
  profileId: string;
  myPublicKeyHex: PublicKeyHex;
  reason: string;
}>): Readonly<{ repairedMessageCount: number; conversationCount: number }> => {
  if (!hasNativeRuntime() || !isSecondaryProfileWindow(params.profileId)) {
    return { repairedMessageCount: 0, conversationCount: 0 };
  }

  const conversationIds = listChatStateConversationIds({
    profileId: params.profileId,
    myPublicKeyHex: params.myPublicKeyHex,
  });
  if (conversationIds.length === 0) {
    return { repairedMessageCount: 0, conversationCount: 0 };
  }

  const inviteRepaired = loadNativeOutgoingCommunityInviteRepairMessages({
    conversationIds,
    myPublicKeyHex: params.myPublicKeyHex,
    profileId: params.profileId,
  });
  const outgoingRepaired = loadNativeOutgoingChatStateRepairMessages({
    conversationIds,
    myPublicKeyHex: params.myPublicKeyHex,
    profileId: params.profileId,
  });
  const repairedMessageCount = inviteRepaired.length + outgoingRepaired.length;

  if (repairedMessageCount > 0) {
    dispatchMessagesIndexRebuiltEvent({
      publicKeyHex: params.myPublicKeyHex,
      profileId: params.profileId,
      messageCount: repairedMessageCount,
    });
  }

  const detail: SecondaryProfileDmSoftRefreshDetail = {
    profileId: params.profileId,
    reason: params.reason,
    forceIndexedAuthority: true,
    repairedMessageCount,
  };
  window.dispatchEvent(new CustomEvent(SECONDARY_PROFILE_DM_SOFT_REFRESH_EVENT, { detail }));

  logAppEvent({
    name: "runtime.secondary_profile_dm_soft_refresh",
    level: "info",
    scope: { feature: "runtime", action: "secondary_profile_soft_refresh" },
    context: {
      profileId: params.profileId,
      reason: params.reason,
      conversationCount: conversationIds.length,
      repairedMessageCount,
    },
  });

  return {
    repairedMessageCount,
    conversationCount: conversationIds.length,
  };
};

export const subscribeSecondaryProfileDmSoftRefresh = (
  listener: (detail: SecondaryProfileDmSoftRefreshDetail) => void,
): (() => void) => {
  if (typeof window === "undefined") {
    return (): void => undefined;
  }
  const handler = (event: Event): void => {
    const detail = (event as CustomEvent<SecondaryProfileDmSoftRefreshDetail>).detail;
    if (!detail?.profileId) {
      return;
    }
    listener(detail);
  };
  window.addEventListener(SECONDARY_PROFILE_DM_SOFT_REFRESH_EVENT, handler);
  return (): void => {
    window.removeEventListener(SECONDARY_PROFILE_DM_SOFT_REFRESH_EVENT, handler);
  };
};
