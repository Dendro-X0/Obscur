import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
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

export const runSecondaryProfileDmSoftRefresh = (params: Readonly<{
  profileId: string;
  myPublicKeyHex: PublicKeyHex;
  reason: string;
}>): Readonly<{ repairedMessageCount: number; conversationCount: number }> => {
  if (!hasNativeRuntime() || !isSecondaryProfileWindow(params.profileId)) {
    return { repairedMessageCount: 0, conversationCount: 0 };
  }

  dispatchMessagesIndexRebuiltEvent({
    publicKeyHex: params.myPublicKeyHex,
    profileId: params.profileId,
    messageCount: 0,
  });

  const detail: SecondaryProfileDmSoftRefreshDetail = {
    profileId: params.profileId,
    reason: params.reason,
    forceIndexedAuthority: true,
    repairedMessageCount: 0,
  };
  window.dispatchEvent(new CustomEvent(SECONDARY_PROFILE_DM_SOFT_REFRESH_EVENT, { detail }));

  logAppEvent({
    name: "runtime.secondary_profile_dm_soft_refresh",
    level: "info",
    scope: { feature: "runtime", action: "secondary_profile_soft_refresh" },
    context: {
      profileId: params.profileId,
      reason: params.reason,
      conversationCount: 0,
      repairedMessageCount: 0,
    },
  });

  return {
    repairedMessageCount: 0,
    conversationCount: 0,
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
