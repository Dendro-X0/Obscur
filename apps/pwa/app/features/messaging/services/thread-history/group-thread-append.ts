import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { dbInsertGroupMessage, isTauri } from "@dweb/db";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import { dispatchGroupThreadMessagesChanged } from "./group-thread-messages-changed";
import { resolveGroupStorageId } from "./group-thread-sqlite-store";

export type GroupThreadAppendParams = Readonly<{
  conversationId: string;
  groupId: string;
  communityId?: string;
  /** Author of the message row (incoming peer or local sender). */
  senderPublicKeyHex: PublicKeyHex;
  plaintext: string;
  eventId?: string;
  profileId?: string;
  createdAtUnixSeconds?: number;
  receivedAtMs?: number;
}>;

export type GroupThreadAppendResult = Readonly<
  | { status: "suspended" }
  | { status: "persisted"; eventId: string }
>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isOptimisticOnlyEventId = (eventId: string): boolean => UUID_PATTERN.test(eventId);

/**
 * Canonical group thread write owner — persists to SQLite on native; relay ingest and
 * outbound send both land here (not a parallel React hydrate path).
 */
export const appendGroupThreadMessage = async (
  params: GroupThreadAppendParams,
): Promise<GroupThreadAppendResult> => {
  if (!requiresSqlitePersistence() || !isTauri()) {
    return { status: "suspended" };
  }
  const eventId = params.eventId?.trim() ?? "";
  if (!eventId || isOptimisticOnlyEventId(eventId)) {
    return { status: "suspended" };
  }
  const profileId = params.profileId?.trim() || getResolvedProfileId()?.trim() || "";
  if (!profileId) {
    return { status: "suspended" };
  }
  const conversationId = params.conversationId.trim();
  const storageGroupId = resolveGroupStorageId({
    conversationId,
    groupId: params.groupId,
    communityId: params.communityId,
  });
  const receivedAtMs = params.receivedAtMs ?? Date.now();
  const createdAtUnixSeconds = params.createdAtUnixSeconds
    ?? Math.floor(receivedAtMs / 1000);

  await dbInsertGroupMessage({
    event_id: eventId,
    group_id: storageGroupId,
    profile_id: profileId,
    sender_pubkey: params.senderPublicKeyHex,
    plaintext: params.plaintext,
    created_at: createdAtUnixSeconds,
    received_at: receivedAtMs,
  });

  dispatchGroupThreadMessagesChanged({
    conversationId,
    profileId,
    groupId: storageGroupId,
  });

  return { status: "persisted", eventId };
};
