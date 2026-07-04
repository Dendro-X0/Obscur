import type { GroupConversation } from "@/app/features/messaging/types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { loadGroupThreadPageFromSqlite } from "@/app/features/messaging/services/thread-history/group-thread-sqlite-store";
import { isWorkspaceKernelAuthority } from "@/app/features/workspace-kernel/workspace-kernel-policy";
import { LEDGER_ONLY_GROUP_PLACEHOLDER_MESSAGE } from "./community-membership-ledger";

export const isStaleGroupSidebarPreview = (lastMessage: string | undefined): boolean => {
  const trimmed = (lastMessage ?? "").trim();
  return trimmed.length === 0 || trimmed === LEDGER_ONLY_GROUP_PLACEHOLDER_MESSAGE;
};

export const hydrateGroupSidebarPreviewFromSqlite = async (params: Readonly<{
  group: GroupConversation;
  publicKeyHex: PublicKeyHex;
  profileId: string;
}>): Promise<GroupConversation | null> => {
  if (!isWorkspaceKernelAuthority() || !isStaleGroupSidebarPreview(params.group.lastMessage)) {
    return null;
  }
  const page = await loadGroupThreadPageFromSqlite({
    conversationId: params.group.id,
    groupId: params.group.groupId,
    communityId: params.group.communityId,
    myPublicKeyHex: params.publicKeyHex,
    profileId: params.profileId,
    pageSize: 1,
  });
  const latest = page.messages[page.messages.length - 1];
  const preview = latest?.content?.trim() ?? "";
  if (!preview) {
    return null;
  }
  return {
    ...params.group,
    lastMessage: preview,
    lastMessageTime: latest.timestamp,
  };
};

export const hydrateGroupSidebarPreviewsFromSqlite = async (params: Readonly<{
  groups: ReadonlyArray<GroupConversation>;
  publicKeyHex: PublicKeyHex;
  profileId: string;
}>): Promise<ReadonlyArray<GroupConversation>> => {
  if (!isWorkspaceKernelAuthority()) {
    return params.groups;
  }
  const hydrated = await Promise.all(params.groups.map(async (group) => {
    const patch = await hydrateGroupSidebarPreviewFromSqlite({
      group,
      publicKeyHex: params.publicKeyHex,
      profileId: params.profileId,
    });
    return patch ?? group;
  }));
  const changed = hydrated.some((group, index) => {
    const previous = params.groups[index];
    if (!previous) {
      return true;
    }
    return (
      group.lastMessage !== previous.lastMessage
      || group.lastMessageTime.getTime() !== previous.lastMessageTime.getTime()
    );
  });
  return changed ? hydrated : params.groups;
};
