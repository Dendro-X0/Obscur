"use client";

import React, { createContext, useContext, useMemo } from "react";
import type { CommunityRosterProjection } from "@/app/features/groups/services/community-member-roster-projection";
import { useGroups } from "@/app/features/groups/providers/group-provider";
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

/**
 * Single workspace-kernel owner surface — roster reads coordination directory via GroupProvider.
 * Mount inside GroupProvider.
 */
export function WorkspaceKernelProvider(props: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  const active = isWorkspaceKernelAuthority();
  const optionalProfileRuntime = useOptionalProfileRuntime();
  const profileId = optionalProfileRuntime?.profileId ?? getResolvedProfileId();
  const { communityRosterByConversationId } = useGroups();

  const refreshCommunityRoster = async (communityId: string): Promise<void> => {
    if (!active) {
      return;
    }
    await refreshManagedWorkspaceMembership({ communityId, profileId });
  };

  const value = useMemo<WorkspaceKernelContextValue>(() => ({
    active,
    rosterByConversationId: communityRosterByConversationId,
    refreshCommunityRoster,
  }), [active, communityRosterByConversationId]);

  if (!active) {
    return <>{props.children}</>;
  }

  return (
    <WorkspaceKernelContext.Provider value={value}>
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
