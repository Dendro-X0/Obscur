"use client";

/**
 * Visual-only group list provider — membership hydrate, relay sync, and ledger wiring removed.
 * Preserves dialog UI state and optional sidebar group rows from chat-state metadata (no message bodies).
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { GroupConversation } from "@/app/features/messaging/types";
import { chatStateStoreService } from "@/app/features/messaging/services/chat-state-store";
import { fromPersistedGroupConversation, toPersistedGroupConversation } from "@/app/features/messaging/utils/persistence";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useOptionalProfileRuntime } from "@/app/features/profiles/providers/profile-runtime-provider";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import type { CommunityKnownParticipantDirectory } from "@/app/features/groups/services/community-known-participant-directory";
import type { CommunityRosterProjection } from "@/app/features/groups/services/community-member-roster-projection";
import { commitCommunityLeaveAfterRelayConfirmation } from "@/app/features/groups/services/community-relay-confirmed-leave";
import { isRelayAuthoritativeMembershipEnforced } from "@/app/features/groups/services/community-relay-authoritative-membership-policy";
import { isGroupTombstoned } from "@/app/features/groups/services/group-tombstone-store";
import { isWorkspaceKernelAuthority } from "@/app/features/workspace-kernel/workspace-kernel-policy";
import { useWorkspaceKernelRosterIndex } from "@/app/features/workspace-kernel/use-workspace-kernel-roster-index";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

export interface GroupContextType {
    createdGroups: ReadonlyArray<GroupConversation>;
  hasHydratedGroups: boolean;
    communityRosterByConversationId: Readonly<Record<string, CommunityRosterProjection>>;
    communityKnownParticipantDirectoryByConversationId: Readonly<Record<string, CommunityKnownParticipantDirectory>>;
    setCreatedGroups: React.Dispatch<React.SetStateAction<ReadonlyArray<GroupConversation>>>;
    isNewGroupOpen: boolean;
    setIsNewGroupOpen: (open: boolean) => void;
    isCreatingGroup: boolean;
    setIsCreatingGroup: (creating: boolean) => void;
    isGroupInfoOpen: boolean;
    setIsGroupInfoOpen: (open: boolean) => void;
    newGroupName: string;
    setNewGroupName: (name: string) => void;
    newGroupMemberPubkeys: string;
    setNewGroupMemberPubkeys: (pubkeys: string) => void;
  addGroup: (
    group: GroupConversation,
    options?: Readonly<{ allowRevive?: boolean; provisionalJoin?: boolean; relayConfirmed?: boolean }>,
  ) => void;
  updateGroup: (params: Readonly<{
    groupId: string;
    relayUrl?: string;
    conversationId?: string;
    updates: Partial<GroupConversation>;
  }>) => void;
  leaveGroup: (params: Readonly<{
    groupId: string;
    relayUrl?: string;
    conversationId?: string;
    relayConfirmed?: boolean;
  }>) => void;
    removeGroupConversation: (conversationId: string) => void;
    forcePurgeCommunity: (params: Readonly<{ groupId: string; relayUrl?: string; conversationId?: string }>) => void;
    recordMembershipLedgerAfterInviteDecline: (group: GroupConversation) => void;
}

const GroupContext = createContext<GroupContextType | null>(null);

export const GroupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const identity = useIdentity();
  const optionalProfileRuntime = useOptionalProfileRuntime();
  const resolvedProfileId = optionalProfileRuntime?.profileId ?? getResolvedProfileId();
  const publicKeyHex = identity.state.publicKeyHex;

    const [createdGroups, setCreatedGroups] = useState<ReadonlyArray<GroupConversation>>([]);
  const [hasHydratedGroups, setHasHydratedGroups] = useState(false);
    const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [newGroupMemberPubkeys, setNewGroupMemberPubkeys] = useState("");

    useEffect(() => {
    if (!publicKeyHex) {
      setCreatedGroups([]);
      setHasHydratedGroups(false);
            return;
        }
    const persisted = chatStateStoreService.load(publicKeyHex, { profileId: resolvedProfileId });
    const groups = (persisted?.createdGroups ?? [])
      .map((row) => fromPersistedGroupConversation(row))
      .filter((group) => !isGroupTombstoned(publicKeyHex, {
        groupId: group.groupId,
        relayUrl: group.relayUrl,
      }, { profileId: resolvedProfileId }));
    setCreatedGroups(groups);
    setHasHydratedGroups(true);
  }, [publicKeyHex, resolvedProfileId]);

  const persistGroupList = useCallback((groups: ReadonlyArray<GroupConversation>): void => {
    if (!publicKeyHex) {
            return;
        }
        chatStateStoreService.update(
      publicKeyHex,
            (prev) => ({
                ...prev,
        createdGroups: groups.map((group) => toPersistedGroupConversation(group)),
        groupMessages: {},
      }),
      { profileId: resolvedProfileId, debounceMs: 0 },
    );
  }, [publicKeyHex, resolvedProfileId]);

  const addGroup = useCallback((
        group: GroupConversation,
        ): void => {
    setCreatedGroups((prev) => {
      const next = prev.some((row) => row.id === group.id) ? prev : [...prev, group];
      persistGroupList(next);
            return next;
        });
  }, [persistGroupList]);

  const updateGroup = useCallback((params: Readonly<{
        groupId: string;
        relayUrl?: string;
        conversationId?: string;
    updates: Partial<GroupConversation>;
  }>): void => {
            setCreatedGroups((prev) => {
                const next = prev.map((group) => {
        const matches = params.conversationId
          ? group.id === params.conversationId
          : group.groupId === params.groupId && (!params.relayUrl || group.relayUrl === params.relayUrl);
        return matches ? { ...group, ...params.updates } : group;
      });
      persistGroupList(next);
                return next;
            });
  }, [persistGroupList]);

  const resolveGroupForScope = useCallback((params: Readonly<{
    groupId: string;
    relayUrl?: string;
    conversationId?: string;
  }>): GroupConversation | undefined => {
    if (params.conversationId) {
      return createdGroups.find((group) => group.id === params.conversationId);
    }
    return createdGroups.find((group) => (
      group.groupId === params.groupId
      && (!params.relayUrl || group.relayUrl === params.relayUrl)
    ));
  }, [createdGroups]);

  const removeGroupConversation = useCallback((conversationId: string): void => {
            setCreatedGroups((prev) => {
      const next = prev.filter((group) => group.id !== conversationId);
      persistGroupList(next);
                return next;
            });
  }, [persistGroupList]);

  const leaveGroup = useCallback((params: Readonly<{
    groupId: string;
    relayUrl?: string;
    conversationId?: string;
    relayConfirmed?: boolean;
  }>): void => {
    if (!publicKeyHex) {
      return;
    }
    if (isRelayAuthoritativeMembershipEnforced() && params.relayConfirmed !== true) {
      return;
    }
    const group = resolveGroupForScope(params);
    if (!group) {
      return;
    }
    commitCommunityLeaveAfterRelayConfirmation({
      publicKeyHex,
      group,
      profileId: resolvedProfileId,
    });
    removeGroupConversation(group.id);
  }, [publicKeyHex, removeGroupConversation, resolveGroupForScope, resolvedProfileId]);

  const forcePurgeCommunity = useCallback((params: Readonly<{
    groupId: string;
    relayUrl?: string;
    conversationId?: string;
    relayConfirmed?: boolean;
  }>): void => {
    if (!publicKeyHex) {
      return;
    }
    if (isRelayAuthoritativeMembershipEnforced() && params.relayConfirmed !== true) {
      return;
    }
    const group = resolveGroupForScope(params);
    if (!group) {
      return;
    }
    commitCommunityLeaveAfterRelayConfirmation({
      publicKeyHex,
      group,
      profileId: resolvedProfileId,
      tombstone: true,
    });
    chatStateStoreService.update(
      publicKeyHex,
      (prev) => {
        const nextGroupMessages = { ...(prev.groupMessages ?? {}) };
        delete nextGroupMessages[group.id];
        const nextCreatedGroups = (prev.createdGroups ?? []).filter((row) => {
          const conversation = fromPersistedGroupConversation(row);
          return conversation.id !== group.id;
        });
        return {
          ...prev,
          createdGroups: nextCreatedGroups,
          groupMessages: nextGroupMessages,
        };
      },
      { profileId: resolvedProfileId, debounceMs: 0 },
    );
    removeGroupConversation(group.id);
  }, [publicKeyHex, removeGroupConversation, resolveGroupForScope, resolvedProfileId]);
  const recordMembershipLedgerAfterInviteDecline = useCallback((_group: GroupConversation): void => undefined, []);

  const workspaceKernelRosterByConversationId = useWorkspaceKernelRosterIndex({
    groups: createdGroups,
    profileId: resolvedProfileId,
    localMemberPubkey: publicKeyHex as PublicKeyHex | null,
    enabled: isWorkspaceKernelAuthority(),
  });

  const communityRosterByConversationId = isWorkspaceKernelAuthority()
    ? workspaceKernelRosterByConversationId
    : {};

  const value = useMemo<GroupContextType>(() => ({
        createdGroups,
    hasHydratedGroups,
    communityRosterByConversationId,
    communityKnownParticipantDirectoryByConversationId: {},
        setCreatedGroups,
        isNewGroupOpen,
        setIsNewGroupOpen,
        isCreatingGroup,
        setIsCreatingGroup,
        isGroupInfoOpen,
        setIsGroupInfoOpen,
        newGroupName,
        setNewGroupName,
        newGroupMemberPubkeys,
        setNewGroupMemberPubkeys,
        addGroup,
        updateGroup,
        leaveGroup,
        removeGroupConversation,
        forcePurgeCommunity,
        recordMembershipLedgerAfterInviteDecline,
  }), [
    addGroup,
    communityRosterByConversationId,
    createdGroups,
    forcePurgeCommunity,
    hasHydratedGroups,
    isCreatingGroup,
    isGroupInfoOpen,
    isNewGroupOpen,
    leaveGroup,
    newGroupMemberPubkeys,
    newGroupName,
    recordMembershipLedgerAfterInviteDecline,
    removeGroupConversation,
    updateGroup,
  ]);

  return (
    <GroupContext.Provider value={value}>
      {children}
    </GroupContext.Provider>
  );
};

export const useGroups = (): GroupContextType => {
    const context = useContext(GroupContext);
    if (!context) {
    throw new Error("useGroups must be used within GroupProvider");
    }
    return context;
};

export const useGroupsSafe = (): GroupContextType | null => useContext(GroupContext);
