import { chatStateStoreService } from "./chat-state-store-legacy";
import type { PublicKeyHex } from "@/app/features/messaging/types";

/** Lifecycle durability for legacy chat-state mirror (flush / purge on scope changes). */
export const messagingChatStateDurabilityPort = {
  flushAllPending(): void {
    chatStateStoreService.flushAllPending();
  },

  async flush(
    publicKeyHex: PublicKeyHex,
    options?: Readonly<{ profileId?: string }>,
  ): Promise<void> {
    await chatStateStoreService.flush(publicKeyHex, options);
  },

  purgeMemoryExcept(profileId: string, publicKeyHex: PublicKeyHex): void {
    chatStateStoreService.purgeMemoryExcept(profileId, publicKeyHex);
  },

  purgeAllMemory(): void {
    chatStateStoreService.purgeAllMemory();
  },
};
