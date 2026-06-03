/**
 * M3 tier 2 — profile-scoped chat-state sync seed for first paint (web only).
 * Native sqlite builds skip this tier; cold hydrate is authoritative.
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import { chatStateStoreService } from "./chat-state-store";
import { fromPersistedMessagesByConversationId } from "../utils/persistence";
import { isDisplayableDmConversationMessage } from "./dm-conversation-displayable-message";
import { isMessageIdentityInSuppressedIdSet } from "./conversation-message-visibility";
import { filterMessagesByLocalRetention } from "./dm-conversation-message-retention-dedupe";
import type { Message } from "../types";
import { auditProfileScopedStorageAccess } from "./progressive-cache-tier-policy";

export const loadDmThreadSyncSeedCache = (params: Readonly<{
  conversationAliasIds: ReadonlyArray<string>;
  publicKeyHex: PublicKeyHex;
  profileId: string | undefined;
  persistentSuppressedMessageIds: ReadonlySet<string>;
  localMessageRetentionDays: number | undefined;
}>): ReadonlyArray<Message> => {
  if (requiresSqlitePersistence()) {
    return [];
  }
  const audit = auditProfileScopedStorageAccess({
    profileId: params.profileId,
    conversationId: params.conversationAliasIds[0],
    operation: "read",
  });
  if (!audit.ok) {
    return [];
  }
  const persistedState = chatStateStoreService.load(params.publicKeyHex, {
    profileId: params.profileId,
  });
  if (!persistedState?.messagesByConversationId) {
    return [];
  }
  const normalizedByConversationId = fromPersistedMessagesByConversationId(
    persistedState.messagesByConversationId,
    { myPublicKeyHex: params.publicKeyHex },
  );
  const merged: Message[] = [];
  params.conversationAliasIds.forEach((aliasId) => {
    merged.push(...(normalizedByConversationId[aliasId] ?? []));
  });
  const deduped = Array.from(new Map(merged.map((message) => [message.id, message])).values());
  return [...filterMessagesByLocalRetention(
    deduped.filter((message) => (
      isDisplayableDmConversationMessage(message)
      && !isMessageIdentityInSuppressedIdSet(message, params.persistentSuppressedMessageIds)
    )),
    params.localMessageRetentionDays,
  )].sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
};
