import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { mapCoordinationRecordToSemantic } from "./community-coordination-membership-client";
import type { SemanticCommunityMemberEvent } from "@dweb/transport-contracts";
import { logAppEvent } from "@/app/shared/log-app-event";
import {
  fetchCoordinationMembershipDeltasSince,
  fetchCoordinationMembershipHead,
} from "./community-coordination-membership-client";
import {
  loadCoordinationMembershipSeqCursor,
  saveCoordinationMembershipSeqCursor,
} from "./community-coordination-membership-cursor";
import { isCoordinationConfigured } from "./community-membership-sync-mode";
import {
  applyCoordinationMembershipDeltasToDirectoryStore,
  refreshCoordinationMembershipDirectory,
} from "./community-coordination-membership-directory-store";

export type CoordinationMembershipReconcileResult = Readonly<{
  ok: boolean;
  appliedDeltaCount: number;
  headSeq: number | null;
  fromSeq: number;
  toSeq: number;
  errorMessage?: string;
}>;

/**
 * Pulls coordination membership deltas and applies them through the semantic callback.
 * Used for manual reconcile (K-M1/K-M2) and forced directory refresh.
 */
export const runCoordinationMembershipReconcile = async (params: Readonly<{
  communityId: string;
  profileId?: string;
  /** When true, replay from seq 0 (full directory resync). */
  forceFull?: boolean;
  onSemanticMemberEvent: (event: SemanticCommunityMemberEvent) => void;
}>): Promise<CoordinationMembershipReconcileResult> => {
  const communityId = params.communityId.trim();
  if (!communityId) {
    return {
      ok: false,
      appliedDeltaCount: 0,
      headSeq: null,
      fromSeq: 0,
      toSeq: 0,
      errorMessage: "missing_community_id",
    };
  }
  if (!isCoordinationConfigured()) {
    return {
      ok: false,
      appliedDeltaCount: 0,
      headSeq: null,
      fromSeq: 0,
      toSeq: 0,
      errorMessage: "coordination_not_configured",
    };
  }

  const head = await fetchCoordinationMembershipHead(communityId);
  const fromSeq = params.forceFull
    ? 0
    : loadCoordinationMembershipSeqCursor(communityId, params.profileId);

  const result = await fetchCoordinationMembershipDeltasSince(communityId, fromSeq);
  if (!result.ok) {
    logAppEvent({
      name: "groups.coordination_membership_reconcile_failed",
      level: "warn",
      scope: { feature: "groups", action: "coordination_membership_reconcile" },
      context: {
        communityId: communityId.slice(0, 24),
        error: result.error,
        status: result.status,
      },
    });
    return {
      ok: false,
      appliedDeltaCount: 0,
      headSeq: head?.seq ?? null,
      fromSeq,
      toSeq: fromSeq,
      errorMessage: result.error,
    };
  }

  let toSeq = fromSeq;
  let appliedDeltaCount = 0;
  for (const delta of result.deltas) {
    toSeq = Math.max(toSeq, delta.seq);
    const semantic = mapCoordinationRecordToSemantic(delta);
    if (!semantic) {
      continue;
    }
    params.onSemanticMemberEvent(semantic);
    appliedDeltaCount += 1;
  }
  saveCoordinationMembershipSeqCursor(communityId, toSeq, params.profileId);

  applyCoordinationMembershipDeltasToDirectoryStore({
    communityId,
    deltas: result.deltas,
    profileId: params.profileId,
  });
  if (params.forceFull) {
    await refreshCoordinationMembershipDirectory({
      communityId,
      profileId: params.profileId,
      forceFull: true,
    });
  }

  logAppEvent({
    name: "groups.coordination_membership_reconcile",
    level: "info",
    scope: { feature: "groups", action: "coordination_membership_reconcile" },
    context: {
      communityId: communityId.slice(0, 24),
      appliedDeltaCount,
      fromSeq,
      toSeq,
      headSeq: head?.seq ?? null,
      forceFull: params.forceFull === true,
    },
  });

  return {
    ok: true,
    appliedDeltaCount,
    headSeq: head?.seq ?? null,
    fromSeq,
    toSeq,
  };
};

export const coordinationReconcileInternals = {
  subjectPubkeyFromSemantic: (event: SemanticCommunityMemberEvent): PublicKeyHex | null => {
    const pk = event.subjectPublicKeyHex?.trim().toLowerCase();
    return pk && pk.length > 0 ? (pk as PublicKeyHex) : null;
  },
};
