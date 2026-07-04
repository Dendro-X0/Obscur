import {
  isDmKernelChatStateMessageIoSuppressed,
  projectChatStateReadForDmKernelAuthority,
} from "@/app/features/dm-kernel/dm-kernel-chat-state-io-policy";
import { chatStateStoreService } from "./chat-state-store-legacy";
import type {
  PersistedChatState,
  PersistedConnectionOverride,
  PersistedDmConversation,
  PublicKeyHex,
  UnreadByConversationId,
} from "@/app/features/messaging/types";

type ChatStateLoadOptions = Readonly<{
  profileId?: string;
}>;

/** Canonical features-layer owner for legacy chat-state UI chrome (pinned, hidden, unread, sidebar metadata). */
export const messagingChatStateUiMirror = {
  load(
    publicKeyHex: string,
    options?: ChatStateLoadOptions,
  ): PersistedChatState | null {
    return chatStateStoreService.load(publicKeyHex, options);
  },

  updateUnreadCounts(publicKeyHex: PublicKeyHex, unreadByConversationId: UnreadByConversationId): void {
    chatStateStoreService.updateUnreadCounts(publicKeyHex, unreadByConversationId);
  },

  updateConnections(publicKeyHex: PublicKeyHex, connections: ReadonlyArray<PersistedDmConversation>): void {
    chatStateStoreService.updateConnections(publicKeyHex, connections);
  },

  updateConnectionOverrides(
    publicKeyHex: PublicKeyHex,
    overrides: Readonly<Record<string, PersistedConnectionOverride>>,
  ): void {
    chatStateStoreService.updateConnectionOverrides(publicKeyHex, overrides);
  },

  updatePinnedChats(publicKeyHex: PublicKeyHex, pinnedChatIds: ReadonlyArray<string>): void {
    chatStateStoreService.updatePinnedChats(publicKeyHex, pinnedChatIds);
  },

  updateHiddenChats(publicKeyHex: PublicKeyHex, hiddenChatIds: ReadonlyArray<string>): void {
    chatStateStoreService.updateHiddenChats(publicKeyHex, hiddenChatIds);
  },

  deleteConversationMessages(conversationId: string): void {
    if (isDmKernelChatStateMessageIoSuppressed()) {
      return;
    }
    chatStateStoreService.deleteConversationMessages(conversationId);
  },
};
