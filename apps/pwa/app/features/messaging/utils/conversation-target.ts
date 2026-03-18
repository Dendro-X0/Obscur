import { isGroupConversationId } from "@/app/features/groups/utils/group-conversation-id";
import type { Conversation, DmConversation, GroupConversation } from "../types";

const decodeToken = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
};

const isExplicitGroupToken = (value: string): boolean => {
  const decoded = decodeToken(value);
  if (!decoded) {
    return false;
  }
  return isGroupConversationId(decoded);
};

const matchesGroupByToken = (group: GroupConversation, token: string): boolean => {
  const decoded = decodeToken(token);
  if (!decoded) {
    return false;
  }
  const encodedGroupId = encodeURIComponent(group.id);
  if (group.id === decoded || encodedGroupId === token) {
    return true;
  }
  if (group.groupId === decoded) {
    return true;
  }
  if (group.communityId && group.communityId === decoded) {
    return true;
  }
  if (decoded.startsWith("community:")) {
    const communityToken = decoded.slice("community:".length);
    if (group.communityId && group.communityId === communityToken) {
      return true;
    }
  }
  return false;
};

export const resolveGroupConversationByToken = (
  groups: ReadonlyArray<GroupConversation>,
  token: string
): GroupConversation | null => {
  if (!token.trim()) {
    return null;
  }
  return groups.find((group) => matchesGroupByToken(group, token)) ?? null;
};

const matchesDmByToken = (connection: DmConversation, token: string): boolean => {
  const decoded = decodeToken(token);
  if (!decoded) {
    return false;
  }
  return connection.id === decoded || encodeURIComponent(connection.id) === token;
};

export const resolveConversationByToken = (params: Readonly<{
  token: string;
  groups: ReadonlyArray<GroupConversation>;
  connections: ReadonlyArray<DmConversation>;
}>): Conversation | null => {
  const group = resolveGroupConversationByToken(params.groups, params.token);
  if (group) {
    return group;
  }
  if (isExplicitGroupToken(params.token)) {
    return null;
  }
  return params.connections.find((connection) => matchesDmByToken(connection, params.token)) ?? null;
};

