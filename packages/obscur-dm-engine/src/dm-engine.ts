import type { ConversationRecord, MessageRecord } from "@dweb/db";
import type { HostEnginePort } from "@obscur/engine-contracts";
import {
  buildDmGetThreadRequest,
  buildDmListConversationsRequest,
  type DmGetThreadPayload,
} from "@obscur/engine-contracts";

export type FetchDmThreadParams = Readonly<{
  host: HostEnginePort;
  profileId: string;
  windowLabel?: string;
  payload: DmGetThreadPayload;
}>;

export const fetchDmThreadRows = async (
  params: FetchDmThreadParams,
): Promise<ReadonlyArray<MessageRecord>> => {
  const result = await params.host.invoke(
    buildDmGetThreadRequest({
      profileId: params.profileId,
      windowLabel: params.windowLabel,
      payload: params.payload,
    }),
  );
  if (!result.ok) {
    throw new Error(result.errorMessage ?? result.errorCode ?? "dm.getThread failed");
  }
  return (result.data ?? []) as MessageRecord[];
};

export type ListDmConversationsParams = Readonly<{
  host: HostEnginePort;
  profileId: string;
  windowLabel?: string;
}>;

/** Slice 3g: sidebar reload storms share one listConversations IPC window. */
const LIST_CONVERSATIONS_CACHE_TTL_MS = 30_000;
const listDmConversationsCache = new Map<string, Readonly<{ atMs: number; rows: ReadonlyArray<ConversationRecord> }>>();

export const resetDmConversationsCacheForTests = (): void => {
  listDmConversationsCache.clear();
};

export const listDmConversations = async (
  params: ListDmConversationsParams,
): Promise<ReadonlyArray<ConversationRecord>> => {
  const cacheKey = `${params.profileId.trim()}:${params.windowLabel?.trim() ?? ""}`;
  const cached = listDmConversationsCache.get(cacheKey);
  const nowMs = Date.now();
  if (cached && nowMs - cached.atMs < LIST_CONVERSATIONS_CACHE_TTL_MS) {
    return cached.rows;
  }
  const result = await params.host.invoke(
    buildDmListConversationsRequest({
      profileId: params.profileId,
      windowLabel: params.windowLabel,
    }),
  );
  if (!result.ok) {
    throw new Error(result.errorMessage ?? result.errorCode ?? "dm.listConversations failed");
  }
  const rows = (result.data ?? []) as ConversationRecord[];
  listDmConversationsCache.set(cacheKey, { atMs: nowMs, rows });
  return rows;
};
