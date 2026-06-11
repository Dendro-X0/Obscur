import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { dbInsertGroupTombstone, isTauri } from "@dweb/db";
import { listAccountSharedSqliteProfileIds } from "@/app/features/profiles/services/account-shared-sqlite-profile-ids";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { messageBus } from "@/app/features/messaging/services/message-bus";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import { dispatchGroupThreadMessagesChanged } from "./group-thread-messages-changed";
import {
  resolveGroupStorageId,
  resolveGroupThreadHydratePrimaryProfileId,
} from "./group-thread-sqlite-store";

export type SuppressGroupThreadMessageParams = Readonly<{
  conversationId: string;
  groupId: string;
  communityId?: string;
  primaryMessageId: string;
  messageIdentityIds: ReadonlyArray<string>;
  deletedByPublicKeyHex: PublicKeyHex;
  profileId?: string;
  observedAtUnixMs?: number;
}>;

export type SuppressGroupThreadMessageResult = Readonly<
  | { status: "suspended" }
  | { status: "suppressed"; eventIds: ReadonlyArray<string> }
>;

const normalizeEventIds = (params: Readonly<{
  primaryMessageId: string;
  messageIdentityIds: ReadonlyArray<string>;
}>): ReadonlyArray<string> => {
  const seen = new Set<string>();
  const out: string[] = [];
  [params.primaryMessageId, ...params.messageIdentityIds].forEach((candidate) => {
    const trimmed = candidate.trim();
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    out.push(trimmed);
  });
  return out;
};

/** Canonical managed-workspace group message hide — SQLite tombstone + thread refresh signal. */
export const suppressGroupThreadMessage = async (
  params: SuppressGroupThreadMessageParams,
): Promise<SuppressGroupThreadMessageResult> => {
  const eventIds = normalizeEventIds({
    primaryMessageId: params.primaryMessageId,
    messageIdentityIds: params.messageIdentityIds,
  });
  if (eventIds.length === 0) {
    return { status: "suspended" };
  }

  const conversationId = params.conversationId.trim();
  const storageGroupId = resolveGroupStorageId({
    conversationId,
    groupId: params.groupId,
    communityId: params.communityId,
  });
  const primaryProfileId = resolveGroupThreadHydratePrimaryProfileId(params.profileId);
  const deletedAtUnixMs = params.observedAtUnixMs ?? Date.now();

  if (requiresSqlitePersistence() && isTauri()) {
    const profileIds = listAccountSharedSqliteProfileIds({
      primaryProfileId,
      accountPublicKeyHex: params.deletedByPublicKeyHex,
    });
    await Promise.all(profileIds.flatMap((profileId) => (
      eventIds.map(async (eventId) => {
        await dbInsertGroupTombstone({
          event_id: eventId,
          profile_id: profileId,
          deleted_at: deletedAtUnixMs,
          deleted_by: params.deletedByPublicKeyHex,
        }).catch(() => undefined);
      })
    )));
  }

  messageBus.emitMessageDeleted(conversationId, params.primaryMessageId, {
    messageIdentityIds: eventIds,
    sourceProfileId: params.profileId ?? getResolvedProfileId() ?? undefined,
  });

  dispatchGroupThreadMessagesChanged({
    conversationId,
    profileId: primaryProfileId,
    groupId: storageGroupId,
    atUnixMs: deletedAtUnixMs,
  });

  return { status: "suppressed", eventIds };
};
