import type { RoomKeySnapshot } from "@/app/features/account-sync/account-sync-contracts";
import type { PersistedChatState } from "@/app/features/messaging/types";
import type { CommunityMembershipLedgerEntry } from "./community-membership-ledger";
import { toCommunityMembershipLedgerKey } from "./community-membership-ledger";
import { parseGroupIdentityFromConversationId } from "./community-membership-reconstruction";

const parseInvitePayload = (content: string): Readonly<{
  type?: string;
  groupId?: string;
  relayUrl?: string;
  roomKey?: string;
}> | null => {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * MEM-004: joined ledger rows need evidence beyond a lone DM invite-response card.
 */
export const hasDurableJoinedCommunityMembershipEvidence = (params: Readonly<{
  entry: CommunityMembershipLedgerEntry;
  chatState: PersistedChatState | null | undefined;
  roomKeys: ReadonlyArray<RoomKeySnapshot>;
}>): boolean => {
  if (params.entry.status !== "joined") {
    return true;
  }
  const groupId = params.entry.groupId.trim();
  const relayUrl = (params.entry.relayUrl ?? "").trim();
  if (groupId.length === 0 || relayUrl.length === 0) {
    return false;
  }

  if (params.roomKeys.some((roomKey) => roomKey.groupId.trim() === groupId)) {
    return true;
  }

  const chatState = params.chatState;
  if ((chatState?.createdGroups ?? []).some((group) => (
    group.groupId.trim() === groupId
    && (group.relayUrl ?? "").trim() === relayUrl
  ))) {
    return true;
  }

  for (const [conversationId, messages] of Object.entries(chatState?.groupMessages ?? {})) {
    const identity = parseGroupIdentityFromConversationId(conversationId);
    if (!identity || identity.groupId !== groupId || identity.relayUrl !== relayUrl) {
      continue;
    }
    if ((messages ?? []).length > 0) {
      return true;
    }
  }

  for (const timeline of Object.values(chatState?.messagesByConversationId ?? {})) {
    for (const message of timeline) {
      if (typeof message.content !== "string") {
        continue;
      }
      const parsed = parseInvitePayload(message.content);
      if (!parsed || parsed.type !== "community-invite") {
        continue;
      }
      const parsedGroupId = typeof parsed.groupId === "string" ? parsed.groupId.trim() : "";
      const parsedRelayUrl = typeof parsed.relayUrl === "string" ? parsed.relayUrl.trim() : "";
      const roomKey = typeof parsed.roomKey === "string" ? parsed.roomKey.trim() : "";
      if (parsedGroupId === groupId && parsedRelayUrl === relayUrl && roomKey.length > 0) {
        return true;
      }
    }
  }

  return false;
};

export const downgradeInviteResponseOnlyJoinedLedgerEntries = (params: Readonly<{
  entries: ReadonlyArray<CommunityMembershipLedgerEntry>;
  chatState: PersistedChatState | null | undefined;
  roomKeys: ReadonlyArray<RoomKeySnapshot>;
}>): ReadonlyArray<CommunityMembershipLedgerEntry> => (
  params.entries.map((entry) => {
    if (entry.status !== "joined") {
      return entry;
    }
    if (hasDurableJoinedCommunityMembershipEvidence({
      entry,
      chatState: params.chatState,
      roomKeys: params.roomKeys,
    })) {
      return entry;
    }
    const key = toCommunityMembershipLedgerKey(entry);
    if (!key) {
      return entry;
    }
    return {
      ...entry,
      status: "historical" as const,
    };
  })
);
