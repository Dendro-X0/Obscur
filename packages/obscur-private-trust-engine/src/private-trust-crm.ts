import type { HostEnginePort } from "@obscur/engine-contracts";
import {
  buildPrivateTrustListRelationshipEdgesRequest,
  buildPrivateTrustUpsertRelationshipEdgeRequest,
} from "@obscur/engine-contracts";

/** Snake_case wire shape from libobscur RelationshipEdgeRecord. */
export type RelationshipEdgeRecord = Readonly<{
  profile_id: string;
  peer_pubkey: string;
  state: string;
  trust_tier: string | null;
  updated_at: number;
}>;

export type PrivateTrustCrmParams = Readonly<{
  host: HostEnginePort;
  profileId: string;
  windowLabel?: string;
}>;

export const listRelationshipEdges = async (
  params: PrivateTrustCrmParams,
): Promise<ReadonlyArray<RelationshipEdgeRecord>> => {
  const result = await params.host.invoke(
    buildPrivateTrustListRelationshipEdgesRequest({
      profileId: params.profileId,
      windowLabel: params.windowLabel,
    }),
  );
  if (!result.ok) {
    throw new Error(result.errorMessage ?? result.errorCode ?? "privateTrust.listRelationshipEdges failed");
  }
  return (result.data ?? []) as RelationshipEdgeRecord[];
};

export const upsertRelationshipEdge = async (
  params: PrivateTrustCrmParams & Readonly<{
    peerPubkey: string;
    state: string;
    trustTier?: string | null;
  }>,
): Promise<void> => {
  const result = await params.host.invoke(
    buildPrivateTrustUpsertRelationshipEdgeRequest({
      profileId: params.profileId,
      windowLabel: params.windowLabel,
      peerPubkey: params.peerPubkey,
      state: params.state,
      trustTier: params.trustTier,
    }),
  );
  if (!result.ok) {
    throw new Error(result.errorMessage ?? result.errorCode ?? "privateTrust.upsertRelationshipEdge failed");
  }
};
