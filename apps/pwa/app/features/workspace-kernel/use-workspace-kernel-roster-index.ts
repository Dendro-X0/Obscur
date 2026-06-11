"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { GroupConversation } from "@/app/features/messaging/types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunityRosterProjection } from "@/app/features/groups/services/community-member-roster-projection";
import {
  COORDINATION_MEMBERSHIP_DIRECTORY_CHANGED_EVENT,
} from "@/app/features/groups/services/community-coordination-membership-directory-store";
import { refreshManagedWorkspaceMembership } from "./workspace-kernel-membership-port";
import {
  buildWorkspaceKernelRosterIndex,
  buildWorkspaceKernelRosterProjectionForGroup,
} from "./workspace-kernel-roster-port";
import { isWorkspaceKernelAuthority } from "./workspace-kernel-policy";

export const useWorkspaceKernelRosterIndex = (params: Readonly<{
  groups: ReadonlyArray<GroupConversation>;
  profileId?: string;
  localMemberPubkey?: PublicKeyHex | null;
  enabled?: boolean;
}>): Readonly<Record<string, CommunityRosterProjection>> => {
  const enabled = params.enabled ?? isWorkspaceKernelAuthority();
  const managedGroups = useMemo(
    () => params.groups.filter((group) => (
      group.communityMode === "managed_workspace" && Boolean(group.communityId?.trim())
    )),
    [params.groups],
  );

  const readIndex = useCallback((): Readonly<Record<string, CommunityRosterProjection>> => (
    buildWorkspaceKernelRosterIndex(managedGroups, {
      profileId: params.profileId,
      localMemberPubkey: params.localMemberPubkey,
    })
  ), [managedGroups, params.localMemberPubkey, params.profileId]);

  const [rosterByConversationId, setRosterByConversationId] = useState(readIndex);

  useEffect(() => {
    if (!enabled) {
      setRosterByConversationId({});
      return;
    }
    setRosterByConversationId(readIndex());
  }, [enabled, readIndex]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const refreshAll = async (): Promise<void> => {
      await Promise.all(managedGroups.map(async (group) => {
        const communityId = group.communityId?.trim();
        if (!communityId) {
          return;
        }
        await refreshManagedWorkspaceMembership({
          communityId,
          profileId: params.profileId,
        });
      }));
      setRosterByConversationId(readIndex());
    };

    void refreshAll();

    const onDirectoryChanged = (): void => {
      setRosterByConversationId(readIndex());
    };

    window.addEventListener(COORDINATION_MEMBERSHIP_DIRECTORY_CHANGED_EVENT, onDirectoryChanged);
    return () => {
      window.removeEventListener(COORDINATION_MEMBERSHIP_DIRECTORY_CHANGED_EVENT, onDirectoryChanged);
    };
  }, [enabled, managedGroups, params.profileId, readIndex]);

  return enabled ? rosterByConversationId : {};
};

export const useWorkspaceKernelConversationRoster = (params: Readonly<{
  group: GroupConversation | null | undefined;
  profileId?: string;
  localMemberPubkey?: PublicKeyHex | null;
}>): CommunityRosterProjection | null => {
  const index = useWorkspaceKernelRosterIndex({
    groups: params.group ? [params.group] : [],
    profileId: params.profileId,
    localMemberPubkey: params.localMemberPubkey,
  });
  if (!params.group) {
    return null;
  }
  return index[params.group.id]
    ?? buildWorkspaceKernelRosterProjectionForGroup(params.group, {
      profileId: params.profileId,
      localMemberPubkey: params.localMemberPubkey,
    });
};
