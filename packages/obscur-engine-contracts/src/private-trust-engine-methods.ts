import type { EngineInvokeRequest } from "./host-engine-port";

/** Cut 0 private-trust glue — CRM + T3 prepare/ACK (no Soft L3 claim). */
export const PRIVATE_TRUST_ENGINE_METHODS = {
  upsertRelationshipEdge: "upsertRelationshipEdge",
  listRelationshipEdges: "listRelationshipEdges",
  prepareT3Outbound: "prepareT3Outbound",
  completeT3HomeAck: "completeT3HomeAck",
} as const;

export type PrivateTrustEngineMethod =
  (typeof PRIVATE_TRUST_ENGINE_METHODS)[keyof typeof PRIVATE_TRUST_ENGINE_METHODS];

export const isPrivateTrustEngineMethod = (method: string): method is PrivateTrustEngineMethod => (
  Object.values(PRIVATE_TRUST_ENGINE_METHODS).includes(method as PrivateTrustEngineMethod)
);

export type PrivateTrustUpsertRelationshipEdgePayload = Readonly<{
  peerPubkey: string;
  state: string;
  trustTier?: string | null;
}>;

export const buildPrivateTrustUpsertRelationshipEdgeRequest = (params: Readonly<{
  profileId: string;
  peerPubkey: string;
  state: string;
  trustTier?: string | null;
  windowLabel?: string;
}>): EngineInvokeRequest => ({
  engine: "privateTrust",
  method: PRIVATE_TRUST_ENGINE_METHODS.upsertRelationshipEdge,
  scope: {
    profileId: params.profileId,
    windowLabel: params.windowLabel,
  },
  payload: {
    peerPubkey: params.peerPubkey,
    state: params.state,
    ...(params.trustTier !== undefined ? { trustTier: params.trustTier } : {}),
  },
});

export const buildPrivateTrustListRelationshipEdgesRequest = (params: Readonly<{
  profileId: string;
  windowLabel?: string;
}>): EngineInvokeRequest => ({
  engine: "privateTrust",
  method: PRIVATE_TRUST_ENGINE_METHODS.listRelationshipEdges,
  scope: {
    profileId: params.profileId,
    windowLabel: params.windowLabel,
  },
});

export const buildPrivateTrustPrepareT3OutboundRequest = (params: Readonly<{
  profileId: string;
  conversationId: string;
  peerPubkey: string;
  plaintext: string;
  windowLabel?: string;
}>): EngineInvokeRequest => ({
  engine: "privateTrust",
  method: PRIVATE_TRUST_ENGINE_METHODS.prepareT3Outbound,
  scope: {
    profileId: params.profileId,
    windowLabel: params.windowLabel,
  },
  payload: {
    conversationId: params.conversationId,
    peerPubkey: params.peerPubkey,
    plaintext: params.plaintext,
  },
});

export const buildPrivateTrustCompleteT3HomeAckRequest = (params: Readonly<{
  profileId: string;
  clientMessageId: string;
  homeMessageId: string;
  windowLabel?: string;
}>): EngineInvokeRequest => ({
  engine: "privateTrust",
  method: PRIVATE_TRUST_ENGINE_METHODS.completeT3HomeAck,
  scope: {
    profileId: params.profileId,
    windowLabel: params.windowLabel,
  },
  payload: {
    clientMessageId: params.clientMessageId,
    homeMessageId: params.homeMessageId,
  },
});
