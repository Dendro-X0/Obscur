"use client";

import { useEffect, useState } from "react";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import {
  COORDINATION_MEMBERSHIP_DIRECTORY_CHANGED_EVENT,
  loadCoordinationMembershipDirectory,
  refreshCoordinationMembershipDirectory,
} from "../services/community-coordination-membership-directory-store";
import type { CoordinationMembershipMaterialization } from "../services/community-coordination-membership-materializer";

export const useCoordinationMembershipDirectory = (
  communityId: string | undefined,
  profileId?: string,
): CoordinationMembershipMaterialization | null => {
  const resolvedProfileId = profileId ?? getResolvedProfileId();
  const normalizedCommunityId = communityId?.trim() ?? "";

  const [materialization, setMaterialization] = useState<CoordinationMembershipMaterialization | null>(() => (
    normalizedCommunityId
      ? loadCoordinationMembershipDirectory(normalizedCommunityId, resolvedProfileId)
      : null
  ));

  useEffect(() => {
    if (!normalizedCommunityId) {
      setMaterialization(null);
      return;
    }

    setMaterialization(loadCoordinationMembershipDirectory(normalizedCommunityId, resolvedProfileId));

    const onDirectoryChanged = (event: Event): void => {
      const detail = (event as CustomEvent<{ communityId?: string; profileId?: string }>).detail;
      if (detail?.communityId !== normalizedCommunityId) {
        return;
      }
      if (detail.profileId && detail.profileId !== resolvedProfileId) {
        return;
      }
      setMaterialization(loadCoordinationMembershipDirectory(normalizedCommunityId, resolvedProfileId));
    };

    window.addEventListener(COORDINATION_MEMBERSHIP_DIRECTORY_CHANGED_EVENT, onDirectoryChanged);
    void refreshCoordinationMembershipDirectory({
      communityId: normalizedCommunityId,
      profileId: resolvedProfileId,
    }).then((next) => {
      if (next) {
        setMaterialization(next);
      }
    });

    return () => {
      window.removeEventListener(COORDINATION_MEMBERSHIP_DIRECTORY_CHANGED_EVENT, onDirectoryChanged);
    };
  }, [normalizedCommunityId, resolvedProfileId]);

  return materialization;
};
