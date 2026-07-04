"use client";

import { useEffect, useMemo, useState } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunityMode } from "@/app/features/groups/types";
import type { CoordinationMembershipMaterialization } from "@/app/features/groups/services/community-coordination-membership-materializer";
import { COORDINATION_MEMBERSHIP_DIRECTORY_CHANGED_EVENT } from "@/app/features/groups/services/community-coordination-membership-directory-store";
import { COMMUNITY_MEMBERSHIP_LEDGER_UPDATED_EVENT } from "@/app/features/groups/services/community-membership-ledger";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import {
  resolveWorkspaceKernelInviteBlocklistPubkeys,
  resolveWorkspaceKernelParticipantPubkeys,
} from "./resolve-workspace-kernel-participant-pubkeys";
import { isWorkspaceKernelAuthority } from "./workspace-kernel-policy";

export type UseWorkspaceKernelParticipantPubkeysParams = Readonly<{
  communityId?: string;
  communityMode?: CommunityMode | null;
  relayUrl?: string | null;
  localMemberPubkey?: PublicKeyHex | null;
  coordinationDirectory?: CoordinationMembershipMaterialization | null;
  leftMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  expelledMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  enabled?: boolean;
}>;

export const useWorkspaceKernelParticipantPubkeys = (
  params: UseWorkspaceKernelParticipantPubkeysParams,
): Readonly<{
  participantPubkeys: ReadonlyArray<PublicKeyHex>;
  inviteBlocklistPubkeys: ReadonlyArray<PublicKeyHex>;
}> => {
  const enabled = params.enabled ?? isWorkspaceKernelAuthority();
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }
    const bump = (): void => setRevision((value) => value + 1);
    window.addEventListener(COORDINATION_MEMBERSHIP_DIRECTORY_CHANGED_EVENT, bump);
    window.addEventListener(COMMUNITY_MEMBERSHIP_LEDGER_UPDATED_EVENT, bump);
    return () => {
      window.removeEventListener(COORDINATION_MEMBERSHIP_DIRECTORY_CHANGED_EVENT, bump);
      window.removeEventListener(COMMUNITY_MEMBERSHIP_LEDGER_UPDATED_EVENT, bump);
    };
  }, [enabled, params.communityId]);

  return useMemo(() => {
    if (!enabled) {
      return {
        participantPubkeys: [] as ReadonlyArray<PublicKeyHex>,
        inviteBlocklistPubkeys: [] as ReadonlyArray<PublicKeyHex>,
      };
    }
    const resolved = {
      communityId: params.communityId,
      communityMode: params.communityMode,
      relayUrl: params.relayUrl,
      profileId: getResolvedProfileId(),
      localMemberPubkey: params.localMemberPubkey,
      coordinationDirectory: params.coordinationDirectory,
      leftMemberPubkeys: params.leftMemberPubkeys,
      expelledMemberPubkeys: params.expelledMemberPubkeys,
    };
    return {
      participantPubkeys: resolveWorkspaceKernelParticipantPubkeys(resolved),
      inviteBlocklistPubkeys: resolveWorkspaceKernelInviteBlocklistPubkeys(resolved),
    };
  }, [
    enabled,
    params.communityId,
    params.communityMode,
    params.coordinationDirectory,
    params.expelledMemberPubkeys,
    params.leftMemberPubkeys,
    params.localMemberPubkey,
    params.relayUrl,
    revision,
  ]);
};
