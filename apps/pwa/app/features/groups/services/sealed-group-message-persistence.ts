import { chatStateStoreService } from "@/app/features/messaging/services/chat-state-store";
import type { PersistedGroupMessage } from "@/app/features/messaging/types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { dbGetGroupMessages, isTauri } from "@dweb/db";

export type SealedGroupMessageRecord = Readonly<{
  id: string;
  pubkey: string;
  created_at: number;
  content: string;
}>;

const MAX_PERSISTED_GROUP_MESSAGES = 200;

const toPersistedGroupMessage = (message: SealedGroupMessageRecord): PersistedGroupMessage => ({
  id: message.id,
  pubkey: message.pubkey,
  created_at: message.created_at,
  content: message.content,
});

export const loadPersistedSealedGroupMessages = async (params: Readonly<{
  conversationId: string;
  groupId: string;
  publicKeyHex: PublicKeyHex;
  profileId?: string;
}>): Promise<ReadonlyArray<SealedGroupMessageRecord>> => {
  const profileId = params.profileId ?? getResolvedProfileId();
  const fromChatState = (): ReadonlyArray<SealedGroupMessageRecord> => {
    const persisted = chatStateStoreService.load(params.publicKeyHex, { profileId });
    const rows = persisted?.groupMessages?.[params.conversationId] ?? [];
    return rows
      .map((row) => ({
        id: row.id,
        pubkey: row.pubkey,
        created_at: row.created_at,
        content: row.content,
      }))
      .filter((row) => row.id.length > 0 && row.content.length >= 0);
  };

  if (isTauri()) {
    try {
      const records = await dbGetGroupMessages(profileId, params.groupId, MAX_PERSISTED_GROUP_MESSAGES);
      if (records.length > 0) {
        return records.map((record) => ({
          id: record.event_id,
          pubkey: record.sender_pubkey,
          created_at: Math.floor(record.created_at / 1000),
          content: record.plaintext,
        }));
      }
    } catch {
      // fall through to chat-state seed
    }
  }

  return fromChatState();
};

export const persistSealedGroupMessages = (params: Readonly<{
  conversationId: string;
  publicKeyHex: PublicKeyHex;
  messages: ReadonlyArray<SealedGroupMessageRecord>;
  profileId?: string;
}>): void => {
  if (typeof window === "undefined" || params.messages.length === 0) {
    return;
  }
  const profileId = params.profileId ?? getResolvedProfileId();
  const persisted = chatStateStoreService.load(params.publicKeyHex, { profileId });
  const existing = persisted?.groupMessages?.[params.conversationId] ?? [];
  const byId = new Map<string, PersistedGroupMessage>();
  existing.forEach((message) => {
    byId.set(message.id, message);
  });
  params.messages.forEach((message) => {
    byId.set(message.id, toPersistedGroupMessage(message));
  });
  const merged = Array.from(byId.values())
    .sort((left, right) => right.created_at - left.created_at)
    .slice(0, MAX_PERSISTED_GROUP_MESSAGES);
  chatStateStoreService.updateGroupMessages(params.publicKeyHex, {
    [params.conversationId]: merged,
  });
};
