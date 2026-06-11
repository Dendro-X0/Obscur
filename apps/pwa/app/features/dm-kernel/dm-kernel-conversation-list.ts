import type { DmConversation } from "@/app/features/messaging/types";
import type { ConversationRecord } from "@dweb/db";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { filterDevLabSyntheticSidebarRows } from "./dm-kernel-dev-lab-sidebar-policy";

export const conversationRecordToDmKernelRow = (rec: ConversationRecord): DmConversation => ({
  kind: "dm",
  id: rec.id,
  pubkey: rec.peer_pubkey as PublicKeyHex,
  displayName: rec.peer_pubkey,
  lastMessage: rec.last_plaintext_preview ?? "",
  unreadCount: rec.unread_count,
  lastMessageTime: rec.last_message_at != null ? new Date(rec.last_message_at) : new Date(0),
});

/** Sidebar list from SQLite only — no chat-state / projection merge. */
export const resolveDmKernelSidebarConnections = (
  sqliteConversations: ReadonlyArray<DmConversation>,
): ReadonlyArray<DmConversation> => {
  const filtered = filterDevLabSyntheticSidebarRows(sqliteConversations);
  return [...filtered].sort(
    (left, right) => right.lastMessageTime.getTime() - left.lastMessageTime.getTime(),
  );
};
