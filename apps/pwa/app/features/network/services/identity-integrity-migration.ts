import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { IntegrityMigrationReport, PersistedChatState, PersistedConnectionRequest, PersistedDmConversation } from "@/app/features/messaging/types";
import { chatStateStoreService } from "@/app/features/messaging/services/chat-state-store";
import { normalizePublicKeyHex, normalizePublicKeyHexList } from "@/app/features/profile/utils/normalize-public-key-hex";
import { incrementAbuseMetric } from "@/app/shared/abuse-observability";
import { messagingDB } from "@dweb/storage/indexed-db";
import { toDmConversationIdUnsafe } from "@/app/features/messaging/utils/dm-conversation-id";

const MIGRATION_DONE_KEY_PREFIX = "obscur:integrity-migration:v085:done";
const MIGRATION_BACKUP_KEY_PREFIX = "obscur:integrity-migration:v085:backup";

const PEER_TRUST_STORAGE_PREFIX = "obscur.peer_trust.v1";
const BLOCKLIST_STORAGE_PREFIX = "obscur.blocklist.v1";
const CHAT_STATE_STORAGE_PREFIX = "dweb.nostr.pwa.chatState.v2";

const getMigrationDoneKey = (publicKeyHex: PublicKeyHex): string => `${MIGRATION_DONE_KEY_PREFIX}:${publicKeyHex}`;
const getMigrationBackupKey = (publicKeyHex: PublicKeyHex): string =>
  `${MIGRATION_BACKUP_KEY_PREFIX}:${publicKeyHex}:${Date.now()}`;

const dedupeConnectionRequests = (requests: ReadonlyArray<PersistedConnectionRequest>): Readonly<{
  requests: ReadonlyArray<PersistedConnectionRequest>;
  dedupedCount: number;
}> => {
  const byPeer = new Map<string, PersistedConnectionRequest>();
  requests.forEach((item) => {
    const peer = normalizePublicKeyHex(item.id);
    if (!peer) return;
    const existing = byPeer.get(peer);
    if (!existing || (item.timestampMs ?? 0) >= (existing.timestampMs ?? 0)) {
      byPeer.set(peer, { ...item, id: peer });
    }
  });
  const next = Array.from(byPeer.values());
  return {
    requests: next,
    dedupedCount: Math.max(0, requests.length - next.length)
  };
};

const dedupeConnections = (
  myPublicKeyHex: PublicKeyHex,
  connections: ReadonlyArray<PersistedDmConversation>
): Readonly<{
  connections: ReadonlyArray<PersistedDmConversation>;
  remap: ReadonlyMap<string, string>;
  dedupedCount: number;
}> => {
  const remap = new Map<string, string>();
  const byConversationId = new Map<string, PersistedDmConversation>();
  connections.forEach((connection) => {
    const normalizedPeer = normalizePublicKeyHex(connection.pubkey);
    if (!normalizedPeer) return;
    const canonicalId = toDmConversationIdUnsafe({ myPublicKeyHex, peerPublicKeyHex: normalizedPeer });
    remap.set(connection.id, canonicalId);
    const normalized: PersistedDmConversation = {
      ...connection,
      id: canonicalId,
      pubkey: normalizedPeer,
      displayName: connection.displayName || normalizedPeer.slice(0, 8),
    };
    const existing = byConversationId.get(canonicalId);
    if (!existing || normalized.lastMessageTimeMs >= existing.lastMessageTimeMs) {
      byConversationId.set(canonicalId, normalized);
    }
  });
  const next = Array.from(byConversationId.values());
  return {
    connections: next,
    remap,
    dedupedCount: Math.max(0, connections.length - next.length)
  };
};

const remapConversationIdRecord = <TValue>(
  source: Readonly<Record<string, TValue>>,
  remap: ReadonlyMap<string, string>,
): Readonly<{ remapped: Readonly<Record<string, TValue>>; remappedCount: number }> => {
  let remappedCount = 0;
  const next: Record<string, TValue> = {};
  Object.entries(source).forEach(([key, value]) => {
    const normalizedKey = remap.get(key) ?? key;
    if (normalizedKey !== key) {
      remappedCount += 1;
    }
    next[normalizedKey] = value;
  });
  return { remapped: next, remappedCount };
};

const remapMessageConversationIds = async (remap: ReadonlyMap<string, string>): Promise<number> => {
  if (remap.size === 0) return 0;
  try {
    const rows = await messagingDB.getAll<Record<string, unknown>>("messages");
    const updates: Array<Record<string, unknown>> = [];
    rows.forEach((row) => {
      const currentConversationId = typeof row.conversationId === "string" ? row.conversationId : null;
      if (!currentConversationId) return;
      const mappedConversationId = remap.get(currentConversationId);
      if (!mappedConversationId || mappedConversationId === currentConversationId) return;
      updates.push({ ...row, conversationId: mappedConversationId });
    });
    if (updates.length > 0) {
      await messagingDB.bulkPut("messages", updates);
    }
    return updates.length;
  } catch {
    return 0;
  }
};

const remapConversationIdList = (
  source: ReadonlyArray<string> | undefined,
  remap: ReadonlyMap<string, string>
): Readonly<{ remapped: ReadonlyArray<string> | undefined; remappedCount: number }> => {
  if (!source) {
    return { remapped: source, remappedCount: 0 };
  }
  let remappedCount = 0;
  const seen = new Set<string>();
  const next: string[] = [];
  source.forEach((id) => {
    const mapped = remap.get(id) ?? id;
    if (mapped !== id) {
      remappedCount += 1;
    }
    if (seen.has(mapped)) return;
    seen.add(mapped);
    next.push(mapped);
  });
  return { remapped: next, remappedCount };
};

export const runIdentityIntegrityMigrationV085 = async (publicKeyHex: PublicKeyHex): Promise<IntegrityMigrationReport> => {
  const now = Date.now();
  const defaultReport: IntegrityMigrationReport = {
    timestampMs: now,
    backedUp: false,
    dedupedConnectionRequests: 0,
    dedupedConnections: 0,
    dedupedAcceptedPeers: 0,
    dedupedMutedPeers: 0,
    dedupedBlockedPeers: 0,
    remappedConversationRefs: 0,
    skipped: 0,
    conflicts: 0,
    restored: 0
  };

  if (typeof window === "undefined") {
    return defaultReport;
  }

  const doneKey = getMigrationDoneKey(publicKeyHex);
  if (window.localStorage.getItem(doneKey) === "1") {
    return { ...defaultReport, skipped: 1 };
  }

  const peerTrustKey = `${PEER_TRUST_STORAGE_PREFIX}.${publicKeyHex}`;
  const blocklistKey = `${BLOCKLIST_STORAGE_PREFIX}.${publicKeyHex}`;
  const chatStateKey = `${CHAT_STATE_STORAGE_PREFIX}.${publicKeyHex}`;

  const rawPeerTrust = window.localStorage.getItem(peerTrustKey);
  const rawBlocklist = window.localStorage.getItem(blocklistKey);
  const rawChatState = window.localStorage.getItem(chatStateKey);

  const backupKey = getMigrationBackupKey(publicKeyHex);
  window.localStorage.setItem(
    backupKey,
    JSON.stringify({
      timestampMs: now,
      publicKeyHex,
      peerTrust: rawPeerTrust,
      blocklist: rawBlocklist,
      chatState: rawChatState
    })
  );

  let dedupedAcceptedPeers = 0;
  let dedupedMutedPeers = 0;
  let dedupedBlockedPeers = 0;
  let dedupedConnectionRequests = 0;
  let dedupedConnections = 0;
  let remappedConversationRefs = 0;

  const loadedState = chatStateStoreService.load(publicKeyHex);
  if (loadedState) {
    const { requests: nextRequests, dedupedCount: requestDedupedCount } = dedupeConnectionRequests(loadedState.connectionRequests ?? []);
    dedupedConnectionRequests += requestDedupedCount;

    const { connections: nextConnections, remap, dedupedCount: connectionDedupedCount } = dedupeConnections(
      publicKeyHex,
      loadedState.createdConnections ?? []
    );
    dedupedConnections += connectionDedupedCount;

    const unreadRemap = remapConversationIdRecord(loadedState.unreadByConversationId ?? {}, remap);
    const overridesRemap = remapConversationIdRecord(loadedState.connectionOverridesByConnectionId ?? {}, remap);
    const pinnedRemap = remapConversationIdList(loadedState.pinnedChatIds, remap);
    const hiddenRemap = remapConversationIdList(loadedState.hiddenChatIds, remap);
    remappedConversationRefs += unreadRemap.remappedCount + overridesRemap.remappedCount + pinnedRemap.remappedCount + hiddenRemap.remappedCount;

    const nextState: PersistedChatState = {
      ...loadedState,
      createdConnections: nextConnections,
      connectionRequests: nextRequests,
      unreadByConversationId: unreadRemap.remapped,
      connectionOverridesByConnectionId: overridesRemap.remapped,
      pinnedChatIds: pinnedRemap.remapped,
      hiddenChatIds: hiddenRemap.remapped
    };

    chatStateStoreService.update(publicKeyHex, () => nextState);
    await chatStateStoreService.flush(publicKeyHex);
    remappedConversationRefs += await remapMessageConversationIds(remap);
  }

  if (rawPeerTrust) {
    try {
      const parsed = JSON.parse(rawPeerTrust) as { acceptedPeers?: string[]; mutedPeers?: string[] };
      const acceptedPeers = normalizePublicKeyHexList(Array.isArray(parsed.acceptedPeers) ? parsed.acceptedPeers : []);
      const mutedPeers = normalizePublicKeyHexList(Array.isArray(parsed.mutedPeers) ? parsed.mutedPeers : []);
      dedupedAcceptedPeers += Math.max(0, (parsed.acceptedPeers?.length ?? 0) - acceptedPeers.length);
      dedupedMutedPeers += Math.max(0, (parsed.mutedPeers?.length ?? 0) - mutedPeers.length);
      window.localStorage.setItem(peerTrustKey, JSON.stringify({ acceptedPeers, mutedPeers }));
    } catch {
      // keep backup and continue
    }
  }

  if (rawBlocklist) {
    try {
      const parsed = JSON.parse(rawBlocklist) as { blockedPublicKeys?: string[] };
      const blockedPublicKeys = normalizePublicKeyHexList(Array.isArray(parsed.blockedPublicKeys) ? parsed.blockedPublicKeys : []);
      dedupedBlockedPeers += Math.max(0, (parsed.blockedPublicKeys?.length ?? 0) - blockedPublicKeys.length);
      window.localStorage.setItem(blocklistKey, JSON.stringify({ blockedPublicKeys }));
    } catch {
      // keep backup and continue
    }
  }

  const dedupedTotal =
    dedupedConnectionRequests +
    dedupedConnections +
    dedupedAcceptedPeers +
    dedupedMutedPeers +
    dedupedBlockedPeers +
    remappedConversationRefs;
  if (dedupedTotal > 0) {
    incrementAbuseMetric("deduped_state_entry", dedupedTotal);
  }

  window.localStorage.setItem(doneKey, "1");
  const report: IntegrityMigrationReport = {
    timestampMs: now,
    backedUp: true,
    backupKey,
    dedupedConnectionRequests,
    dedupedConnections,
    dedupedAcceptedPeers,
    dedupedMutedPeers,
    dedupedBlockedPeers,
    remappedConversationRefs,
    skipped: 0,
    conflicts: 0,
    restored: 0
  };
  return report;
};

export const __private__identityIntegrityMigration = {
  dedupeConnectionRequests,
  dedupeConnections,
  remapConversationIdRecord,
  remapConversationIdList,
};
