import {
  isDmKernelChatStateMessageIoSuppressed,
  projectChatStateReadForDmKernelAuthority,
  sanitizeChatStateForNativeDmKernelMirror,
} from "@/app/features/dm-kernel/dm-kernel-chat-state-io-policy";
import { chatStateStoreService } from "@/app/features/messaging/services/chat-state-store-legacy";
import type { PersistedChatState, PublicKeyHex } from "@/app/features/messaging/types";

type ChatStateLoadOptions = Readonly<{
  profileId?: string;
}>;

type ChatStateReplaceOptions = Readonly<{
  emitMutationSignal?: boolean;
  profileId?: string;
}>;

export type AccountSyncChatStateSnapshot = PersistedChatState | null;

/** Account-sync band owner for legacy chat-state restore/replace/bootstrap reads. */
export const accountSyncChatStatePort = {
  load(
    publicKeyHex: PublicKeyHex | string,
    options?: ChatStateLoadOptions,
  ): AccountSyncChatStateSnapshot {
    return projectChatStateReadForDmKernelAuthority(
      chatStateStoreService.load(publicKeyHex, options),
    );
  },

  replace(
    publicKeyHex: PublicKeyHex | string,
    nextState: PersistedChatState,
    options?: ChatStateReplaceOptions,
  ): void {
    chatStateStoreService.replace(
      publicKeyHex,
      sanitizeChatStateForNativeDmKernelMirror(nextState),
      options,
    );
  },

  async hydrateMessages(publicKeyHex: PublicKeyHex | string): Promise<void> {
    if (isDmKernelChatStateMessageIoSuppressed()) {
      return;
    }
    await chatStateStoreService.hydrateMessages(publicKeyHex);
  },
};
