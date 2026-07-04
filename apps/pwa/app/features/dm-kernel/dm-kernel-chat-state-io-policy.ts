import type { PersistedChatState } from "@/app/features/messaging/types";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import { isDmKernelAuthority } from "./dm-kernel-policy";

/**
 * Native dm-kernel owns DM message durable I/O — chat-state is UI mirror only.
 * @see docs/program/obscur-native-sqlite-policy.md
 */
export const isDmKernelChatStateMessageIoSuppressed = (): boolean => (
  isDmKernelAuthority() && requiresSqlitePersistence()
);

/** Strip DM/group message bodies before native chat-state mirror writes. */
export const sanitizeChatStateForNativeDmKernelMirror = (
  chatState: PersistedChatState,
): PersistedChatState => {
  if (!isDmKernelChatStateMessageIoSuppressed()) {
    return chatState;
  }
  return {
    ...chatState,
    messagesByConversationId: {},
    groupMessages: {},
  };
};

/** Hide message bodies from chat-state reads when sqlite is DM authority. */
export const projectChatStateReadForDmKernelAuthority = (
  chatState: PersistedChatState | null,
): PersistedChatState | null => {
  if (!chatState) {
    return null;
  }
  return sanitizeChatStateForNativeDmKernelMirror(chatState);
};
