import type { GroupConversation } from "@/app/features/messaging/types";
import {
  resolveCommunityGovernanceMemberExpelledMutation,
} from "./community-membership-coordinator";
import { persistCommunityMembershipLedgerMutation } from "./community-membership-mutation-owner";

export const COMMUNITY_GOVERNANCE_MUTATION_OWNER_ID = "community-governance-mutation-owner" as const;

export type PersistCommunityGovernanceMemberExpelledParams = Readonly<{
  publicKeyHex: string;
  group: GroupConversation;
  targetPublicKeyHex: string;
  lastEvidenceEventId?: string;
  updatedAtUnixMs?: number;
  profileId?: string;
}>;

/**
 * Canonical ledger write for governance-accepted member expulsion (G2.3).
 * Operator keeps `joined`; expelled target persists `expelled` when local user is target.
 */
export const persistCommunityGovernanceMemberExpelled = (
  params: PersistCommunityGovernanceMemberExpelledParams,
): void => {
  const mutation = resolveCommunityGovernanceMemberExpelledMutation({
    publicKeyHex: params.publicKeyHex,
    group: params.group,
    targetPublicKeyHex: params.targetPublicKeyHex,
    updatedAtUnixMs: params.updatedAtUnixMs,
    lastEvidenceEventId: params.lastEvidenceEventId,
  });
  persistCommunityMembershipLedgerMutation(params.publicKeyHex, mutation, {
    profileId: params.profileId,
  });
};
