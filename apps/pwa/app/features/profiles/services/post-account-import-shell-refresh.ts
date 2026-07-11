"use client";

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { accountProjectionRuntime } from "@/app/features/account-sync/services/account-projection-runtime";
import { messagingChatStateDurabilityPort } from "@/app/features/messaging/services/messaging-chat-state-durability-port";
import { useProfileInternals } from "@/app/features/profile/hooks/use-profile";
import { reconcileWindowRuntimeBinding } from "@/app/features/runtime/services/window-runtime-binding";
import { runSecondaryProfileDmSoftRefresh } from "@/app/features/runtime/services/secondary-profile-dm-soft-refresh";
import { isSecondaryProfileWindow } from "@/app/features/runtime/services/secondary-profile-post-login-refresh-policy";
import { emitAccountSyncMutation } from "@/app/shared/account-sync-mutation-signal";
import { logAppEvent } from "@/app/shared/log-app-event";

/**
 * Re-hydrates in-memory shell owners after a successful account import while the
 * user stays unlocked. Avoids a full page reload that would drop back to auth.
 */
export const refreshShellAfterAccountImport = async (params: Readonly<{
  profileId: string;
  publicKeyHex: PublicKeyHex;
}>): Promise<void> => {
  messagingChatStateDurabilityPort.flushAllPending();
  messagingChatStateDurabilityPort.purgeAllMemory();

  const persistedProfile = useProfileInternals.loadFromStorage().profile;
  useProfileInternals.setState({ profile: persistedProfile });
  useProfileInternals.notify();

  accountProjectionRuntime.reset();
  await accountProjectionRuntime.replay({
    profileId: params.profileId,
    accountPublicKeyHex: params.publicKeyHex,
  });

  emitAccountSyncMutation("identity_unlock_changed", { profileId: params.profileId });
  emitAccountSyncMutation("chat_state_changed", { profileId: params.profileId });
  emitAccountSyncMutation("dm_history_changed", { profileId: params.profileId });
  emitAccountSyncMutation("community_membership_changed", { profileId: params.profileId });

  if (isSecondaryProfileWindow(params.profileId)) {
    runSecondaryProfileDmSoftRefresh({
      profileId: params.profileId,
      myPublicKeyHex: params.publicKeyHex,
      reason: "account_import",
    });
  }

  reconcileWindowRuntimeBinding();

  logAppEvent({
    name: "profiles.account_import_shell_refresh",
    level: "info",
    scope: { feature: "profiles", action: "account_import" },
    context: {
      profileId: params.profileId,
      publicKeySuffix: params.publicKeyHex.slice(-8),
    },
  });
};
