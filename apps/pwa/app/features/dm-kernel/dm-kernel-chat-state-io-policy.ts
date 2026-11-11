import { isTauri } from "@dweb/db";
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

/**
 * Cut 1.5 — sticky CRM authority is relationship_edge; chat-state connectionRequests
 * must not act as CRM source of truth on native (same surface as usesKernelRelationshipAuthority).
 */
export const isChatStateCrmIoSuppressed = (): boolean => (
  requiresSqlitePersistence() && isTauri()
);

/** True when chat-state must not own CRM and/or message durability. */
export const isChatStateAuthorityIoSuppressed = (): boolean => (
  isDmKernelChatStateMessageIoSuppressed() || isChatStateCrmIoSuppressed()
);

/** Strip DM/group message bodies and CRM request rows before native chat-state mirror writes. */
export const sanitizeChatStateForNativeDmKernelMirror = (
  chatState: PersistedChatState,
): PersistedChatState => {
  const stripMessages = isDmKernelChatStateMessageIoSuppressed();
  const stripCrm = isChatStateCrmIoSuppressed();
  if (!stripMessages && !stripCrm) {
    return chatState;
  }
  return {
    ...chatState,
    ...(stripMessages
      ? {
          messagesByConversationId: {},
          groupMessages: {},
        }
      : {}),
    ...(stripCrm
      ? {
          connectionRequests: [],
        }
      : {}),
  };
};

/** Hide authority fields from chat-state reads when kernel owns them. */
export const projectChatStateReadForDmKernelAuthority = (
  chatState: PersistedChatState | null,
): PersistedChatState | null => {
  if (!chatState) {
    return null;
  }
  return sanitizeChatStateForNativeDmKernelMirror(chatState);
};
