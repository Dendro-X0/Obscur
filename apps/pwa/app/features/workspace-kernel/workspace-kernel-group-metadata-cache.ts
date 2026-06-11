import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { GroupConversation } from "@/app/features/messaging/types";
import {
  loadWorkspaceGroupMetadataRecords,
  removeWorkspaceGroupMetadataRecord,
  saveWorkspaceGroupMetadataRecords,
  upsertWorkspaceGroupMetadataRecord,
} from "./workspace-kernel-group-metadata-store";

/** Load durable workspace group metadata — not the derived sidebar display list. */
export const loadWorkspaceGroupMetadataCache = (
  publicKeyHex: PublicKeyHex,
  profileId: string,
): ReadonlyArray<GroupConversation> => (
  loadWorkspaceGroupMetadataRecords(publicKeyHex, profileId)
);

/** Persist durable metadata cache. Never pass a derived sidebar-only list here. */
export const persistWorkspaceGroupMetadataCache = (
  publicKeyHex: PublicKeyHex,
  profileId: string,
  groups: ReadonlyArray<GroupConversation>,
): void => {
  saveWorkspaceGroupMetadataRecords(publicKeyHex, profileId, groups);
};

export const upsertWorkspaceGroupMetadata = (
  publicKeyHex: PublicKeyHex,
  profileId: string,
  group: GroupConversation,
): ReadonlyArray<GroupConversation> => (
  upsertWorkspaceGroupMetadataRecord(publicKeyHex, profileId, group)
);

export const removeWorkspaceGroupMetadata = (
  publicKeyHex: PublicKeyHex,
  profileId: string,
  conversationId: string,
): void => {
  removeWorkspaceGroupMetadataRecord(publicKeyHex, profileId, conversationId);
};
