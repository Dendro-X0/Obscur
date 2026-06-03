import type { PersistedChatState } from "@/app/features/messaging/types";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import type { CommunityMembershipLedgerEntry } from "./community-membership-ledger";
import { toCommunityMembershipLedgerKey } from "./community-membership-ledger";
import { toGroupTombstoneKey } from "./group-tombstone-store";

type InviteMembershipPayload = Readonly<{
  type: "community-invite" | "community-invite-response";
  groupId?: string;
  relayUrl?: string;
  communityId?: string;
  status?: string;
}>;

const parseInviteMembershipPayload = (content: string): InviteMembershipPayload | null => {
  try {
    const parsed = JSON.parse(content) as InviteMembershipPayload;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    if (parsed.type !== "community-invite" && parsed.type !== "community-invite-response") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const inferPeerFromDmConversationId = (params: Readonly<{
  conversationId: string;
  localPublicKeyHex: string;
}>): string | null => {
  const trimmedConversationId = params.conversationId.trim();
  const normalizedDirectPeer = normalizePublicKeyHex(trimmedConversationId);
  if (normalizedDirectPeer && normalizedDirectPeer !== params.localPublicKeyHex) {
    return normalizedDirectPeer;
  }
  const parts = trimmedConversationId.split(":");
  if (parts.length !== 2) {
    return null;
  }
  const left = normalizePublicKeyHex(parts[0]);
  const right = normalizePublicKeyHex(parts[1]);
  if (!left || !right) {
    return null;
  }
  if (left === params.localPublicKeyHex && right !== params.localPublicKeyHex) {
    return right;
  }
  if (right === params.localPublicKeyHex && left !== params.localPublicKeyHex) {
    return left;
  }
  return null;
};

/** DM invite/accept threads → peer pubkeys keyed by groupId@@relayUrl (MEM-003). */
export const buildInviteMemberPubkeysByGroupKey = (params: Readonly<{
  localPublicKeyHex: string;
  chatState: PersistedChatState | null | undefined;
}>): Readonly<Record<string, ReadonlyArray<string>>> => {
  const invitePeersByGroupKey = new Map<string, Set<string>>();
  const terminalInvitePeersByGroupKey = new Map<string, Set<string>>();
  const createdConnections = params.chatState?.createdConnections ?? [];
  const peerByConversationId = new Map<string, string>();
  createdConnections.forEach((connection) => {
    const normalizedPeer = normalizePublicKeyHex(connection.pubkey);
    if (normalizedPeer) {
      peerByConversationId.set(connection.id, normalizedPeer);
    }
  });

  const recordTerminalInvitePeer = (groupKey: string, peerPublicKeyHex: string): void => {
    const current = terminalInvitePeersByGroupKey.get(groupKey) ?? new Set<string>();
    current.add(peerPublicKeyHex);
    terminalInvitePeersByGroupKey.set(groupKey, current);
  };

  const recordInvitePeer = (groupKey: string, peerPublicKeyHex: string): void => {
    const current = invitePeersByGroupKey.get(groupKey) ?? new Set<string>();
    current.add(peerPublicKeyHex);
    invitePeersByGroupKey.set(groupKey, current);
  };

  Object.entries(params.chatState?.messagesByConversationId ?? {}).forEach(([conversationId, messages]) => {
    const peerPublicKeyHex = peerByConversationId.get(conversationId)
      ?? inferPeerFromDmConversationId({
        conversationId,
        localPublicKeyHex: params.localPublicKeyHex,
      });
    if (!peerPublicKeyHex) {
      return;
    }
    messages.forEach((message) => {
      if (typeof message.content !== "string" || message.content.trim().length === 0) {
        return;
      }
      const parsed = parseInviteMembershipPayload(message.content);
      if (!parsed) {
        return;
      }
      const groupId = typeof parsed.groupId === "string" ? parsed.groupId.trim() : "";
      const relayUrl = typeof parsed.relayUrl === "string" ? parsed.relayUrl.trim() : "";
      if (!groupId || !relayUrl) {
        return;
      }
      const groupKey = toGroupTombstoneKey({ groupId, relayUrl });
      if (parsed.type === "community-invite-response") {
        if (parsed.status === "declined" || parsed.status === "canceled") {
          recordTerminalInvitePeer(groupKey, peerPublicKeyHex);
        } else if (parsed.status === "accepted") {
          recordInvitePeer(groupKey, peerPublicKeyHex);
        }
        return;
      }
      if (parsed.type === "community-invite") {
        recordInvitePeer(groupKey, peerPublicKeyHex);
      }
    });
  });

  const groupedPeers = new Map<string, Set<string>>();
  invitePeersByGroupKey.forEach((peerSet, groupKey) => {
    const terminalPeers = terminalInvitePeersByGroupKey.get(groupKey) ?? new Set<string>();
    const activePeers = Array.from(peerSet).filter((peer) => !terminalPeers.has(peer));
    if (activePeers.length > 0) {
      groupedPeers.set(groupKey, new Set(activePeers));
    }
  });

  return Object.fromEntries(
    Array.from(groupedPeers.entries()).map(([groupKey, peerSet]) => ([groupKey, Array.from(peerSet)])),
  );
};

const uniquePubkeys = (values: ReadonlyArray<string>): ReadonlyArray<string> => (
  Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)))
);

/** Persist invite-derived roster on joined ledger rows after restore merge (MEM-003). */
export const enrichCommunityMembershipLedgerMemberPubkeysFromInviteEvidence = (params: Readonly<{
  entries: ReadonlyArray<CommunityMembershipLedgerEntry>;
  chatState: PersistedChatState | null | undefined;
  localPublicKeyHex: string;
}>): ReadonlyArray<CommunityMembershipLedgerEntry> => {
  const inviteMemberPubkeysByGroupKey = buildInviteMemberPubkeysByGroupKey({
    localPublicKeyHex: params.localPublicKeyHex,
    chatState: params.chatState,
  });

  return params.entries.map((entry) => {
    if (entry.status !== "joined") {
      return entry;
    }
    const ledgerKey = toCommunityMembershipLedgerKey(entry);
    if (!ledgerKey) {
      return entry;
    }
    const invitePeers = inviteMemberPubkeysByGroupKey[ledgerKey] ?? [];
    const mergedMemberPubkeys = uniquePubkeys([
      ...(entry.memberPubkeys ?? []),
      ...invitePeers,
      params.localPublicKeyHex,
    ]);
    if (mergedMemberPubkeys.length === (entry.memberPubkeys?.length ?? 0)) {
      return entry;
    }
    return {
      ...entry,
      memberPubkeys: mergedMemberPubkeys,
    };
  });
};

export const enrichPersistedCreatedGroupsMemberPubkeysFromInviteEvidence = (
  chatState: PersistedChatState | null | undefined,
  localPublicKeyHex: string,
): PersistedChatState | null | undefined => {
  if (!chatState) {
    return chatState;
  }
  const inviteMemberPubkeysByGroupKey = buildInviteMemberPubkeysByGroupKey({
    localPublicKeyHex,
    chatState,
  });
  const createdGroups = (chatState.createdGroups ?? []).map((group) => {
    const groupKey = toGroupTombstoneKey({
      groupId: group.groupId,
      relayUrl: group.relayUrl,
    });
    const invitePeers = inviteMemberPubkeysByGroupKey[groupKey] ?? [];
    const mergedMemberPubkeys = uniquePubkeys([
      ...(group.memberPubkeys ?? []),
      ...invitePeers,
      localPublicKeyHex,
    ]);
    if (mergedMemberPubkeys.length === (group.memberPubkeys?.length ?? 0)) {
      return group;
    }
    return {
      ...group,
      memberPubkeys: mergedMemberPubkeys,
      memberCount: Math.max(group.memberCount ?? 0, mergedMemberPubkeys.length, 1),
    };
  });
  return {
    ...chatState,
    createdGroups,
  };
};
