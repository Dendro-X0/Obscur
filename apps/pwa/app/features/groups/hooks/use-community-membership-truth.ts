"use client";

import { useCallback, useEffect, useState } from "react";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunityMode } from "../types";
import {
  COORDINATION_MEMBERSHIP_DIRECTORY_CHANGED_EVENT,
} from "../services/community-coordination-membership-directory-store";
import {
  readCommunityMembershipTruthSnapshot,
  refreshCommunityMembershipTruth,
  type CommunityMembershipTruthSnapshot,
} from "../services/community-membership-truth";

export const useCommunityMembershipTruth = (params: Readonly<{
  communityId: string | undefined;
  communityMode?: CommunityMode | null;
  localMemberPubkey?: PublicKeyHex | null;
  profileId?: string;
}>): Readonly<{
  snapshot: CommunityMembershipTruthSnapshot;
  refresh: (options?: Readonly<{ forceFull?: boolean }>) => Promise<CommunityMembershipTruthSnapshot>;
}> => {
  const resolvedProfileId = params.profileId ?? getResolvedProfileId();
  const normalizedCommunityId = params.communityId?.trim() ?? "";

  const readSnapshot = useCallback((): CommunityMembershipTruthSnapshot => (
    readCommunityMembershipTruthSnapshot({
      communityId: normalizedCommunityId,
      communityMode: params.communityMode,
      profileId: resolvedProfileId,
      localMemberPubkey: params.localMemberPubkey,
    })
  ), [
    normalizedCommunityId,
    params.communityMode,
    params.localMemberPubkey,
    resolvedProfileId,
  ]);

  const [snapshot, setSnapshot] = useState<CommunityMembershipTruthSnapshot>(readSnapshot);

  useEffect(() => {
    setSnapshot(readSnapshot());
  }, [readSnapshot]);

  useEffect(() => {
    if (!normalizedCommunityId) {
      return;
    }

    const onDirectoryChanged = (event: Event): void => {
      const detail = (event as CustomEvent<{ communityId?: string; profileId?: string }>).detail;
      if (detail?.communityId !== normalizedCommunityId) {
        return;
      }
      if (detail.profileId && detail.profileId !== resolvedProfileId) {
        return;
      }
      setSnapshot(readSnapshot());
    };

    window.addEventListener(COORDINATION_MEMBERSHIP_DIRECTORY_CHANGED_EVENT, onDirectoryChanged);
    return () => {
      window.removeEventListener(COORDINATION_MEMBERSHIP_DIRECTORY_CHANGED_EVENT, onDirectoryChanged);
    };
  }, [normalizedCommunityId, readSnapshot, resolvedProfileId]);

  const refresh = useCallback(async (options?: Readonly<{ forceFull?: boolean }>) => {
    if (!normalizedCommunityId) {
      return readSnapshot();
    }
    const next = await refreshCommunityMembershipTruth({
      communityId: normalizedCommunityId,
      communityMode: params.communityMode,
      profileId: resolvedProfileId,
      localMemberPubkey: params.localMemberPubkey,
      forceFull: options?.forceFull === true,
    });
    setSnapshot(next);
    return next;
  }, [
    normalizedCommunityId,
    params.communityMode,
    params.localMemberPubkey,
    readSnapshot,
    resolvedProfileId,
  ]);

  return { snapshot, refresh };
};
