import type { HostEnginePort } from "@obscur/engine-contracts";
import { buildDmGetThreadRequest } from "@obscur/engine-contracts";
import {
  listRelationshipEdges,
  type RelationshipEdgeRecord,
} from "./private-trust-crm";

/**
 * Cut 4.2 — HostEnginePort list helpers for Vite private-trust home.
 * Conversations come from relationship_edge (not chat-state).
 * Threads come from dm.getThread via the same host.
 */

export type PrivateTrustConversationSummary = Readonly<{
  id: string;
  peerLabel: string;
  preview: string;
  updatedAtUnixMs: number;
}>;

export type PrivateTrustMessageSummary = Readonly<{
  id: string;
  conversationId: string;
  body: string;
  direction: "in" | "out";
  sentAtUnixMs: number;
  deliveryStatus: "accepted" | "failed" | "pending";
}>;

const shortPeerLabel = (peerPubkey: string): string => {
  const peer = peerPubkey.trim();
  if (peer.length <= 12) {
    return peer || "peer";
  }
  return `${peer.slice(0, 8)}…${peer.slice(-4)}`;
};

export const mapRelationshipEdgeToConversationSummary = (
  edge: RelationshipEdgeRecord,
): PrivateTrustConversationSummary | null => {
  const peer = edge.peer_pubkey.trim();
  if (!peer) {
    return null;
  }
  const state = edge.state.trim().toLowerCase();
  if (state === "removed") {
    return null;
  }
  const tier = (edge.trust_tier ?? "").trim();
  return {
    id: peer,
    peerLabel: shortPeerLabel(peer),
    preview: tier ? `${state} · ${tier}` : state || "trusted",
    updatedAtUnixMs: Number.isFinite(edge.updated_at) ? edge.updated_at : 0,
  };
};

export const listPrivateTrustConversationsViaHost = async (params: Readonly<{
  host: HostEnginePort;
  profileId: string;
  windowLabel?: string;
}>): Promise<ReadonlyArray<PrivateTrustConversationSummary>> => {
  const edges = await listRelationshipEdges({
    host: params.host,
    profileId: params.profileId,
    windowLabel: params.windowLabel,
  });
  return edges
    .map(mapRelationshipEdgeToConversationSummary)
    .filter((row): row is PrivateTrustConversationSummary => row !== null)
    .sort((a, b) => b.updatedAtUnixMs - a.updatedAtUnixMs);
};

type DmThreadWireRow = Readonly<{
  event_id?: unknown;
  plaintext?: unknown;
  is_outgoing?: unknown;
  received_at?: unknown;
  created_at?: unknown;
}>;

export const mapDmThreadRowToMessageSummary = (
  row: DmThreadWireRow,
  conversationId: string,
): PrivateTrustMessageSummary | null => {
  const id = typeof row.event_id === "string" ? row.event_id.trim() : "";
  if (!id) {
    return null;
  }
  const body = typeof row.plaintext === "string" ? row.plaintext : "";
  const sentAtUnixMs = typeof row.received_at === "number"
    ? row.received_at
    : typeof row.created_at === "number"
      ? row.created_at
      : 0;
  return {
    id,
    conversationId,
    body,
    direction: row.is_outgoing === false ? "in" : "out",
    sentAtUnixMs,
    deliveryStatus: "accepted",
  };
};

export const listPrivateTrustMessagesViaHost = async (params: Readonly<{
  host: HostEnginePort;
  profileId: string;
  conversationId: string;
  windowLabel?: string;
  limit?: number;
}>): Promise<ReadonlyArray<PrivateTrustMessageSummary>> => {
  const result = await params.host.invoke(
    buildDmGetThreadRequest({
      profileId: params.profileId,
      windowLabel: params.windowLabel,
      payload: {
        conversationId: params.conversationId,
        ...(typeof params.limit === "number" ? { limit: params.limit } : {}),
      },
    }),
  );
  if (!result.ok) {
    throw new Error(result.errorMessage ?? result.errorCode ?? "dm.getThread failed");
  }
  const rows = Array.isArray(result.data) ? result.data : [];
  return rows
    .map((row) => mapDmThreadRowToMessageSummary(row as DmThreadWireRow, params.conversationId))
    .filter((row): row is PrivateTrustMessageSummary => row !== null);
};
