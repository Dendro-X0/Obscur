/**
 * Group message persistence — read/write bridge to thread-history kernel.
 * Outbound relay ingest and commit paths land on appendGroupThreadMessage (SQLite on native).
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PersistedChatState } from "@/app/features/messaging/types";
import { appendGroupThreadMessage } from "@/app/features/messaging/services/thread-history/group-thread-append";
import { loadGroupThreadPageFromSqlite } from "@/app/features/messaging/services/thread-history/group-thread-sqlite-store";
import { readActiveDesktopProfileId } from "@/app/features/profiles/services/read-active-desktop-profile-id";
import { getDefaultProfileId } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { isTauri } from "@dweb/db";

export type SealedGroupMessageRecord = Readonly<{
  id: string;
  pubkey: string;
  created_at: number;
  content: string;
}>;

export const SEALED_GROUP_MESSAGE_RESTORE_BOUNDARY_EVENT = "obscur:sealed-group-message-restore-boundary";

export type SealedGroupMessageRestoreBoundaryDetail = Readonly<{
  publicKeyHex: string;
  profileId: string;
}>;

const pendingSqliteWriteTasks = new Set<Promise<void>>();

/** Stable profile slot for sealed-group durability across cold desktop restart (Path B B3-2). */
export const resolveSealedGroupPersistenceProfileId = (profileId?: string): string => {
  const explicit = profileId?.trim();
  if (explicit) {
    return explicit;
  }
  if (isTauri()) {
    return readActiveDesktopProfileId().trim() || getDefaultProfileId();
  }
  return getResolvedProfileId().trim() || getDefaultProfileId();
};

const trackPendingSqliteWrite = (task: Promise<void>): Promise<void> => {
  pendingSqliteWriteTasks.add(task);
  return task.finally(() => {
    pendingSqliteWriteTasks.delete(task);
  });
};

export const sealedGroupMessagePersistenceInternals = {
  resetCommitQueueForTests: (): void => {
    pendingSqliteWriteTasks.clear();
  },
};

export const flushPendingSealedGroupSqliteWrites = async (): Promise<void> => {
  if (pendingSqliteWriteTasks.size === 0) {
    return;
  }
  await Promise.allSettled([...pendingSqliteWriteTasks]);
};

export const consumePendingSealedGroupRestoreBoundary = (_params: Readonly<{
  publicKeyHex: PublicKeyHex;
  profileId?: string;
}>): boolean => false;

export const emitSealedGroupMessageRestoreBoundary = (_detail: SealedGroupMessageRestoreBoundaryDetail): void => undefined;

export const ensureSealedGroupSqliteAuthorityAfterRestore = async (_params: Readonly<{
  publicKeyHex: PublicKeyHex;
  profileId: string;
}>): Promise<void> => undefined;

export const backfillSealedGroupMessagesToSqliteFromChatState = async (_params: Readonly<{
  publicKeyHex: PublicKeyHex;
  profileId?: string;
  chatState: PersistedChatState | null | undefined;
}>): Promise<number> => 0;

export const backfillSealedGroupMessagesToSqliteFromAllAccountChatStates = async (_params: Readonly<{
  publicKeyHex: PublicKeyHex;
  profileId?: string;
  chatState?: PersistedChatState | null | undefined;
}>): Promise<number> => 0;

export const loadPersistedSealedGroupMessages = async (params: Readonly<{
  conversationId: string;
  groupId: string;
  relayUrl?: string;
  communityId?: string;
  publicKeyHex: PublicKeyHex;
  profileId?: string;
}>): Promise<ReadonlyArray<SealedGroupMessageRecord>> => {
  const page = await loadGroupThreadPageFromSqlite({
    conversationId: params.conversationId,
    groupId: params.groupId,
    communityId: params.communityId,
    myPublicKeyHex: params.publicKeyHex,
    profileId: resolveSealedGroupPersistenceProfileId(params.profileId),
  });
  return page.messages.map((message) => ({
    id: message.eventId ?? message.id,
    pubkey: message.senderPubkey ?? params.publicKeyHex,
    created_at: Math.floor(message.timestamp.getTime() / 1000),
    content: message.content,
  }));
};

export const persistSealedGroupMessagesToSqlite = async (): Promise<void> => undefined;

export const mirrorSealedGroupMessagesToChatState = (): void => undefined;

export const commitSealedGroupMessages = async (params: Readonly<{
  conversationId: string;
  groupId: string;
  publicKeyHex: PublicKeyHex;
  messages: ReadonlyArray<SealedGroupMessageRecord>;
  profileId?: string;
  relayUrl?: string;
  communityId?: string;
}>): Promise<void> => {
  if (params.messages.length === 0) {
    return;
  }
  const profileId = resolveSealedGroupPersistenceProfileId(params.profileId);
  const writeTask = (async (): Promise<void> => {
    for (const message of params.messages) {
      await appendGroupThreadMessage({
        conversationId: params.conversationId,
        groupId: params.groupId,
        communityId: params.communityId,
        senderPublicKeyHex: message.pubkey as PublicKeyHex,
        profileId,
        plaintext: message.content,
        eventId: message.id,
        createdAtUnixSeconds: message.created_at,
        receivedAtMs: message.created_at * 1000,
      });
    }
  })();
  await trackPendingSqliteWrite(writeTask);
};

export const persistSealedGroupMessages = (): void => undefined;
