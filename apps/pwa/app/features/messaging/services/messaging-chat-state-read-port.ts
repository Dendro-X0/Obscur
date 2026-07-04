import { projectChatStateReadForDmKernelAuthority } from "@/app/features/dm-kernel/dm-kernel-chat-state-io-policy";
import { chatStateStoreService } from "./chat-state-store-legacy";
import type { PersistedChatState } from "@/app/features/messaging/types";

type ChatStateLoadOptions = Readonly<{
  profileId?: string;
}>;

export type MessagingChatStateSnapshot = PersistedChatState | null;

/** Read-only legacy chat-state evidence — load only; mutations use concern-specific ports. */
export const messagingChatStateReadPort = {
  load(
    publicKeyHex: string,
    options?: ChatStateLoadOptions,
  ): MessagingChatStateSnapshot {
    return projectChatStateReadForDmKernelAuthority(
      chatStateStoreService.load(publicKeyHex, options),
    );
  },
};
