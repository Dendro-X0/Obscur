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
import {
  isGroupTombstoned,
  removeGroupTombstonesForScope,
} from "@/app/features/groups/services/group-tombstone-store";
import { clearDurableCommunityLeaveIntentOnExplicitRejoin } from "@/app/features/groups/services/community-membership-leave-intent";
import { COORDINATION_MEMBERSHIP_DIRECTORY_CHANGED_EVENT } from "@/app/features/groups/services/community-coordination-membership-directory-store";
import {
  loadCommunityMembershipLedger,
  toCommunityMembershipLedgerEntryFromGroup,
  toGroupConversationFromMembershipLedgerEntry,
} from "@/app/features/groups/services/community-membership-ledger";
import { persistCommunityMembershipLedgerMutation } from "@/app/features/groups/services/community-membership-mutation-owner";
import { deriveCommunityId } from "@/app/features/groups/utils/community-identity";
import { resolveGroupConversationIdAliases, toGroupConversationId } from "@/app/features/groups/utils/group-conversation-id";
import { refreshCoordinationMembershipDirectory } from "@/app/features/groups/services/community-coordination-membership-directory-store";
import {
  loadWorkspaceGroupMetadataCache,
  persistWorkspaceGroupMetadataCache,
  removeWorkspaceGroupMetadata,
  upsertWorkspaceGroupMetadata,
} from "@/app/features/workspace-kernel/workspace-kernel-group-metadata-cache";
import { isWorkspaceKernelAuthority } from "@/app/features/workspace-kernel/workspace-kernel-policy";
import { resolveManagedWorkspaceGroupList } from "@/app/features/workspace-kernel/workspace-kernel-list-port";
import { hasTerminalLedgerScopeEvidence, listManagedWorkspaceCommunityIdCandidates } from "@/app/features/workspace-kernel/workspace-kernel-membership-scope";
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

  const loadGroupMetadataCache = useCallback((): ReadonlyArray<GroupConversation> => {
    if (!publicKeyHex) {
      return [];
    }
    if (isWorkspaceKernelAuthority()) {
      return loadWorkspaceGroupMetadataCache(publicKeyHex, resolvedProfileId);
    }
    const persisted = chatStateStoreService.load(publicKeyHex, { profileId: resolvedProfileId });
    return (persisted?.createdGroups ?? [])
      .map((row) => fromPersistedGroupConversation(row))
      .filter((group) => !isGroupTombstoned(publicKeyHex, {
        groupId: group.groupId,
        relayUrl: group.relayUrl,
      }, { profileId: resolvedProfileId }));
  }, [publicKeyHex, resolvedProfileId]);

  const persistGroupMetadataCache = useCallback((groups: ReadonlyArray<GroupConversation>): void => {
    if (!publicKeyHex) {
      return;
    }
    if (isWorkspaceKernelAuthority()) {
      persistWorkspaceGroupMetadataCache(publicKeyHex, resolvedProfileId, groups);
      return;
    }
    chatStateStoreService.update(
      publicKeyHex,
      (prev) => ({
        ...prev,
        createdGroups: groups.map((group) => toPersistedGroupConversation(group)),
      }),
      { profileId: resolvedProfileId, debounceMs: 0 },
    );
  }, [publicKeyHex, resolvedProfileId]);

  const upsertGroupMetadata = useCallback((group: GroupConversation): ReadonlyArray<GroupConversation> => {
    if (!publicKeyHex) {
      return [];
    }
    if (isWorkspaceKernelAuthority()) {
      return upsertWorkspaceGroupMetadata(publicKeyHex, resolvedProfileId, group);
    }
    const current = loadGroupMetadataCache();
    const existingIndex = current.findIndex((row) => row.id === group.id);
    const next = existingIndex >= 0
      ? current.map((row, index) => (index === existingIndex ? { ...row, ...group } : row))
      : [...current, group];
    persistGroupMetadataCache(next);
    return next;
  }, [loadGroupMetadataCache, persistGroupMetadataCache, publicKeyHex, resolvedProfileId]);

    useEffect(() => {
    if (!publicKeyHex) {
      setCreatedGroups([]);
      setHasHydratedGroups(false);
            return;
        }
    const metadataCache = loadGroupMetadataCache();
    const groups = resolveManagedWorkspaceGroupList({
      publicKeyHex,
      profileId: resolvedProfileId,
      persistedGroups: metadataCache,
    });
    setCreatedGroups(groups);
    setHasHydratedGroups(true);
  }, [loadGroupMetadataCache, publicKeyHex, resolvedProfileId]);

  const deriveDisplayGroupList = useCallback((metadataCache: ReadonlyArray<GroupConversation>): ReadonlyArray<GroupConversation> => {
    if (!publicKeyHex) {
      return metadataCache;
    }
    return resolveManagedWorkspaceGroupList({
      publicKeyHex,
      profileId: resolvedProfileId,
      persistedGroups: metadataCache,
    });
  }, [publicKeyHex, resolvedProfileId]);

  const refreshDisplayFromMetadataCache = useCallback((): void => {
    if (!publicKeyHex) {
      return;
    }
    setCreatedGroups(deriveDisplayGroupList(loadGroupMetadataCache()));
  }, [deriveDisplayGroupList, loadGroupMetadataCache, publicKeyHex]);

  useEffect(() => {
    if (!publicKeyHex || !hasHydratedGroups || !isWorkspaceKernelAuthority()) {
      return;
    }
    let cancelled = false;
    const refreshFromCoordinationDirectory = (): void => {
      refreshDisplayFromMetadataCache();
    };
    const bootstrapCoordinationDirectories = async (): Promise<void> => {
      const ledger = loadCommunityMembershipLedger(publicKeyHex, { profileId: resolvedProfileId });
      const communityIds = Array.from(new Set(
        ledger
          .filter((entry) => {
            if (entry.status !== "joined") {
              return false;
            }
            const groupId = entry.groupId.trim();
            const relayUrl = (entry.relayUrl ?? "").trim();
            if (!groupId || !relayUrl) {
              return false;
            }
            if (isGroupTombstoned(publicKeyHex, { groupId, relayUrl }, { profileId: resolvedProfileId })) {
              return false;
            }
            return !hasTerminalLedgerScopeEvidence(ledger, { groupId, relayUrl });
          })
          .flatMap((entry) => {
            const group = toGroupConversationFromMembershipLedgerEntry(entry);
            return listManagedWorkspaceCommunityIdCandidates({
              group,
              publicKeyHex,
              profileId: resolvedProfileId,
            });
          }),
      ));
      await Promise.all(communityIds.map(async (communityId) => {
        try {
          await refreshCoordinationMembershipDirectory({
            communityId,
            profileId: resolvedProfileId,
            forceFull: true,
          });
        } catch {
          // Best-effort refresh; joined ledger + metadata cache retain rows until proof arrives.
        }
      }));
      if (!cancelled) {
        refreshFromCoordinationDirectory();
      }
    };
    const onDirectoryChanged = (): void => {
      refreshFromCoordinationDirectory();
    };
    window.addEventListener(COORDINATION_MEMBERSHIP_DIRECTORY_CHANGED_EVENT, onDirectoryChanged);
    void bootstrapCoordinationDirectories();
    return () => {
      cancelled = true;
      window.removeEventListener(COORDINATION_MEMBERSHIP_DIRECTORY_CHANGED_EVENT, onDirectoryChanged);
    };
  }, [hasHydratedGroups, publicKeyHex, refreshDisplayFromMetadataCache, resolvedProfileId]);

  const addGroup = useCallback((
        group: GroupConversation,
        options?: Readonly<{ allowRevive?: boolean; provisionalJoin?: boolean; relayConfirmed?: boolean }>,
        ): void => {
    if (!publicKeyHex) {
      return;
    }
    const groupId = group.groupId.trim();
    const relayUrl = group.relayUrl.trim();
    if (!groupId || !relayUrl) {
      return;
    }
    const tombstoned = isGroupTombstoned(publicKeyHex, { groupId, relayUrl }, { profileId: resolvedProfileId });
    if (tombstoned && !(options?.allowRevive === true && options?.relayConfirmed === true)) {
      return;
    }
    if (tombstoned) {
      removeGroupTombstonesForScope(publicKeyHex, { groupId, relayUrl }, { profileId: resolvedProfileId });
      clearDurableCommunityLeaveIntentOnExplicitRejoin({
        publicKeyHex,
        profileId: resolvedProfileId,
        groupId,
        relayUrl,
      });
    }
    if (isWorkspaceKernelAuthority() && options?.relayConfirmed === true) {
      persistCommunityMembershipLedgerMutation(
        publicKeyHex,
        {
          reason: "runtime_join_confirmed",
          entry: toCommunityMembershipLedgerEntryFromGroup(group, {
            status: options?.provisionalJoin ? "pending" : "joined",
          }),
        },
        { profileId: resolvedProfileId },
      );
    }
    const metadataCache = upsertGroupMetadata(group);
    setCreatedGroups(deriveDisplayGroupList(metadataCache));
  }, [deriveDisplayGroupList, publicKeyHex, resolvedProfileId, upsertGroupMetadata]);

  const updateGroup = useCallback((params: Readonly<{
        groupId: string;
        relayUrl?: string;
        conversationId?: string;
    updates: Partial<GroupConversation>;
  }>): void => {
    if (!publicKeyHex) {
      return;
    }
    const metadataCache = loadGroupMetadataCache().map((group) => {
      const matches = params.conversationId
        ? group.id === params.conversationId
        : group.groupId === params.groupId && (!params.relayUrl || group.relayUrl === params.relayUrl);
      return matches ? { ...group, ...params.updates } : group;
    });
    persistGroupMetadataCache(metadataCache);
    setCreatedGroups(deriveDisplayGroupList(metadataCache));
  }, [deriveDisplayGroupList, loadGroupMetadataCache, persistGroupMetadataCache, publicKeyHex]);

  const resolveGroupForScope = useCallback((params: Readonly<{
    groupId: string;
    relayUrl?: string;
    conversationId?: string;
  }>): GroupConversation | undefined => {
    if (params.conversationId) {
      const fromList = createdGroups.find((group) => group.id === params.conversationId);
      if (fromList) {
        return fromList;
      }
    }
    return createdGroups.find((group) => (
      group.groupId === params.groupId
      && (!params.relayUrl || group.relayUrl === params.relayUrl)
    ));
  }, [createdGroups]);

  const resolveGroupForPurge = useCallback((params: Readonly<{
    groupId: string;
    relayUrl?: string;
    conversationId?: string;
  }>): GroupConversation | undefined => {
    const fromList = resolveGroupForScope(params);
    if (fromList) {
      return fromList;
    }
    if (!publicKeyHex) {
      return undefined;
    }
    const groupId = params.groupId.trim();
    const relayUrl = params.relayUrl?.trim() ?? "";
    if (!groupId || !relayUrl) {
      return undefined;
    }

    const fromMetadata = loadGroupMetadataCache().find((group) => (
      group.groupId.trim() === groupId && group.relayUrl.trim() === relayUrl
    ));
    if (fromMetadata) {
      return fromMetadata;
    }

    const ledgerEntry = loadCommunityMembershipLedger(publicKeyHex, { profileId: resolvedProfileId })
      .find((entry) => entry.groupId.trim() === groupId && (entry.relayUrl ?? "").trim() === relayUrl);
    if (ledgerEntry) {
      return toGroupConversationFromMembershipLedgerEntry(ledgerEntry);
    }

    const communityId = deriveCommunityId({ groupId, relayUrl });
    return {
      kind: "group",
      id: params.conversationId?.trim()
        || toGroupConversationId({ groupId, relayUrl, communityId }),
      communityId,
      groupId,
      relayUrl,
      displayName: groupId,
      memberPubkeys: [publicKeyHex as PublicKeyHex],
      lastMessage: "",
      unreadCount: 0,
      lastMessageTime: new Date(0),
      access: "invite-only",
      memberCount: 1,
      adminPubkeys: [],
      communityMode: "managed_workspace",
    };
  }, [loadGroupMetadataCache, publicKeyHex, resolveGroupForScope, resolvedProfileId]);

  const removeGroupConversation = useCallback((conversationId: string): void => {
    if (!publicKeyHex) {
      return;
    }
    if (isWorkspaceKernelAuthority()) {
      removeWorkspaceGroupMetadata(publicKeyHex, resolvedProfileId, conversationId);
    } else {
      persistGroupMetadataCache(loadGroupMetadataCache().filter((group) => group.id !== conversationId));
    }
    refreshDisplayFromMetadataCache();
  }, [loadGroupMetadataCache, persistGroupMetadataCache, publicKeyHex, refreshDisplayFromMetadataCache, resolvedProfileId]);

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
      tombstone: isWorkspaceKernelAuthority(),
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
    const group = resolveGroupForPurge(params);
    if (!group) {
      return;
    }
    commitCommunityLeaveAfterRelayConfirmation({
      publicKeyHex,
      group,
      profileId: resolvedProfileId,
      tombstone: true,
    });
    const conversationAliases = resolveGroupConversationIdAliases({
      conversationId: group.id,
      groupId: group.groupId,
      relayUrl: group.relayUrl,
      communityId: group.communityId,
      genesisEventId: group.genesisEventId,
      creatorPubkey: group.creatorPubkey,
    });
    chatStateStoreService.update(
      publicKeyHex,
      (prev) => {
        const nextGroupMessages = { ...(prev.groupMessages ?? {}) };
        for (const conversationId of conversationAliases) {
          delete nextGroupMessages[conversationId];
        }
        return {
          ...prev,
          groupMessages: nextGroupMessages,
          createdGroups: (prev.createdGroups ?? []).filter((row) => (
            !conversationAliases.includes(row.id)
          )),
        };
      },
      { profileId: resolvedProfileId, debounceMs: 0 },
    );
    for (const conversationId of conversationAliases) {
      if (isWorkspaceKernelAuthority()) {
        removeWorkspaceGroupMetadata(publicKeyHex, resolvedProfileId, conversationId);
      }
    }
    removeGroupConversation(group.id);
    refreshDisplayFromMetadataCache();
  }, [
    publicKeyHex,
    refreshDisplayFromMetadataCache,
    removeGroupConversation,
    resolveGroupForPurge,
    resolvedProfileId,
  ]);
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
