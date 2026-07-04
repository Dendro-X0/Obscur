import {
  isDmKernelChatStateMessageIoSuppressed,
  projectChatStateReadForDmKernelAuthority,
  sanitizeChatStateForNativeDmKernelMirror,
} from "@/app/features/dm-kernel/dm-kernel-chat-state-io-policy";
import { chatStateStoreService } from "./chat-state-store-legacy";
import type {
  PersistedChatState,
  PersistedConnectionRequest,
  PersistedMessage,
  PublicKeyHex,
} from "@/app/features/messaging/types";

type ChatStateLoadOptions = Readonly<{
  profileId?: string;
}>;

type ChatStateUpdateOptions = Readonly<{
  silent?: boolean;
  debounceMs?: number;
  profileId?: string;
}>;

/** Message and request mutations on legacy chat-state mirror. */
export const messagingChatStateMessagePort = {
  load(
    publicKeyHex: string,
    options?: ChatStateLoadOptions,
  ): PersistedChatState | null {
    return projectChatStateReadForDmKernelAuthority(
      chatStateStoreService.load(publicKeyHex, options),
    );
  },

  update(
    publicKeyHex: PublicKeyHex,
    updater: (prev: PersistedChatState) => PersistedChatState,
    options?: ChatStateUpdateOptions,
  ): void {
    if (isDmKernelChatStateMessageIoSuppressed()) {
      chatStateStoreService.update(
        publicKeyHex,
        (prev) => sanitizeChatStateForNativeDmKernelMirror(updater(prev)),
        options,
      );
      return;
    }
    chatStateStoreService.update(publicKeyHex, updater, options);
  },

  updateMessages(
    publicKeyHex: PublicKeyHex,
    messagesByConversationId: Record<string, ReadonlyArray<PersistedMessage>>,
  ): void {
    if (isDmKernelChatStateMessageIoSuppressed()) {
      return;
    }
    chatStateStoreService.updateMessages(publicKeyHex, messagesByConversationId);
  },

  updateConnectionRequests(
    publicKeyHex: PublicKeyHex,
    requests: ReadonlyArray<PersistedConnectionRequest>,
  ): void {
    chatStateStoreService.updateConnectionRequests(publicKeyHex, requests);
  },

  removeMessageIdentities(
    publicKeyHex: PublicKeyHex,
    conversationId: string,
    messageIdentityIds: ReadonlyArray<string>,
  ): void {
    if (isDmKernelChatStateMessageIoSuppressed()) {
      return;
    }
    chatStateStoreService.removeMessageIdentities(publicKeyHex, conversationId, messageIdentityIds);
  },

  removeMessageIdentitiesFromAllActiveScopes(
    conversationId: string,
    messageIdentityIds: ReadonlyArray<string>,
    options?: Readonly<{ profileId?: string; publicKeyHex?: PublicKeyHex }>,
  ): void {
    if (isDmKernelChatStateMessageIoSuppressed()) {
      return;
    }
    chatStateStoreService.removeMessageIdentitiesFromAllActiveScopes(
      conversationId,
      messageIdentityIds,
      options,
    );
  },
};
