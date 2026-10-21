"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CommunityRosterProjection } from "@/app/features/groups/services/community-member-roster-projection";
import { useGroups } from "@/app/features/groups/providers/group-provider-port";
import { useOptionalProfileRuntime } from "@/app/features/profiles/providers/profile-runtime-provider";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { refreshManagedWorkspaceMembership } from "./workspace-kernel-membership-port";
import { isWorkspaceKernelAuthority } from "./workspace-kernel-policy";

export type WorkspaceKernelContextValue = Readonly<{
  active: boolean;
  rosterByConversationId: Readonly<Record<string, CommunityRosterProjection>>;
  refreshCommunityRoster: (communityId: string) => Promise<void>;
}>;

const WorkspaceKernelContext = createContext<WorkspaceKernelContextValue | null>(null);

const INACTIVE_KERNEL_VALUE: WorkspaceKernelContextValue = {
  active: false,
  rosterByConversationId: {},
  refreshCommunityRoster: async () => {},
};

/**
 * Subscribes to group roster only while authority is enabled — keeps unlock free of
 * useGroups work until Slice 2b idle activation. Renders null (sibling of children).
 */
function WorkspaceKernelRosterSync(props: Readonly<{
  onValue: (value: WorkspaceKernelContextValue) => void;
}>): null {
  const optionalProfileRuntime = useOptionalProfileRuntime();
  const profileId = optionalProfileRuntime?.profileId ?? getResolvedProfileId();
  const { communityRosterByConversationId } = useGroups();

  const refreshCommunityRoster = useMemo(() => {
    return async (communityId: string): Promise<void> => {
      await refreshManagedWorkspaceMembership({ communityId, profileId });
    };
  }, [profileId]);

  const value = useMemo<WorkspaceKernelContextValue>(() => ({
    active: true,
    rosterByConversationId: communityRosterByConversationId,
    refreshCommunityRoster,
  }), [communityRosterByConversationId, refreshCommunityRoster]);

  useEffect(() => {
    props.onValue(value);
  }, [props.onValue, value]);

  useEffect(() => {
    const publish = props.onValue;
    return () => {
      publish(INACTIVE_KERNEL_VALUE);
    };
  }, [props.onValue]);

  return null;
}

/**
 * Single workspace-kernel owner surface — roster reads coordination directory via GroupProvider.
 * Mount inside GroupProvider.
 *
 * Always renders a stable Provider so deferred activation cannot remount children.
 * Pass `authorityEnabled={false}` until idle remount (Slice 2b).
 */
export function WorkspaceKernelProvider(props: Readonly<{
  children: React.ReactNode;
  /** When false, kernel stays inactive without unmounting the subtree. Default true. */
  authorityEnabled?: boolean;
}>): React.JSX.Element {
  const policyActive = isWorkspaceKernelAuthority();
  const enabled = policyActive && props.authorityEnabled !== false;
  const [value, setValue] = useState<WorkspaceKernelContextValue>(INACTIVE_KERNEL_VALUE);

  return (
    <WorkspaceKernelContext.Provider value={enabled ? value : INACTIVE_KERNEL_VALUE}>
      {enabled ? <WorkspaceKernelRosterSync onValue={setValue} /> : null}
      {props.children}
    </WorkspaceKernelContext.Provider>
  );
}

export const useWorkspaceKernel = (): WorkspaceKernelContextValue => {
  const context = useContext(WorkspaceKernelContext);
  if (!context) {
    throw new Error("useWorkspaceKernel must be used within WorkspaceKernelProvider");
  }
  return context;
};

export const useWorkspaceKernelOptional = (): WorkspaceKernelContextValue | null => (
  useContext(WorkspaceKernelContext)
);
