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
import { messagingChatStateMessagePort } from "@/app/features/messaging/services/messaging-chat-state-message-port";
import { messagingChatStateReadPort } from "@/app/features/messaging/services/messaging-chat-state-read-port";
import { fromPersistedGroupConversation, toPersistedGroupConversation } from "@/app/features/messaging/utils/persistence";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useOptionalProfileRuntime } from "@/app/features/profiles/providers/profile-runtime-provider";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { commitCommunityLeaveAfterRelayConfirmation } from "@/app/features/groups/services/community-relay-confirmed-leave";
import { isRelayAuthoritativeMembershipEnforced } from "@/app/features/groups/services/community-relay-authoritative-membership-policy";
import {
  isGroupTombstoned,
  removeGroupTombstonesForScope,
} from "@/app/features/groups/services/group-tombstone-store";
import { clearDurableCommunityLeaveIntentOnExplicitRejoin } from "@/app/features/groups/services/community-membership-leave-intent";
import { COORDINATION_MEMBERSHIP_DIRECTORY_CHANGED_EVENT, refreshCoordinationMembershipDirectory } from "@/app/features/groups/services/community-coordination-membership-directory-store";
import {
  loadCommunityMembershipLedger,
  removeCommunityMembershipLedgerScopes,
  toCommunityMembershipLedgerEntryFromGroup,
  toGroupConversationFromMembershipLedgerEntry,
} from "@/app/features/groups/services/community-membership-ledger";
import {
  listArchivedCommunityMembershipLedgerRows,
} from "@/app/features/groups/services/community-membership-ledger-archive";
import { persistCommunityMembershipLedgerMutation } from "@/app/features/groups/services/community-membership-mutation-owner";
import { deriveCommunityId } from "@/app/features/groups/utils/community-identity";
import { resolveGroupConversationIdAliases, toGroupConversationId } from "@/app/features/groups/utils/group-conversation-id";
import { readCommunityLeaveOutbox } from "@/app/features/groups/services/community-leave-outbox";
import { communityMembershipScopeMatches } from "@/app/features/groups/services/community-membership-scope-key";
import {
  loadWorkspaceGroupMetadataCache,
  persistWorkspaceGroupMetadataCache,
  removeWorkspaceGroupMetadata,
  upsertWorkspaceGroupMetadata,
} from "@/app/features/workspace-kernel/workspace-kernel-group-metadata-cache";
import { isWorkspaceKernelAuthority } from "@/app/features/workspace-kernel/workspace-kernel-policy";
import { resolveManagedWorkspaceGroupList } from "@/app/features/workspace-kernel/workspace-kernel-list-port";
import { repairGroupMetadataAfterStorageLoss } from "@/app/features/profiles/services/data-root-group-metadata-repair";
import { hydrateGroupSidebarPreviewsFromSqlite } from "@/app/features/groups/services/group-sidebar-preview-sqlite-hydrate";
import { subscribeGroupThreadMessagesChanged } from "@/app/features/messaging/services/thread-history/group-thread-messages-changed";
import { hasTerminalLedgerScopeEvidence, listManagedWorkspaceCommunityIdCandidates } from "@/app/features/workspace-kernel/workspace-kernel-membership-scope";
import { useWorkspaceKernelRosterIndex } from "@/app/features/workspace-kernel/use-workspace-kernel-roster-index";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { GroupContextType } from "@/app/features/groups/providers/group-provider-types";

export type { GroupContextType } from "@/app/features/groups/providers/group-provider-types";

const GroupContext = createContext<GroupContextType | null>(null);

export const LegacyGroupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
    const persisted = messagingChatStateReadPort.load(publicKeyHex, { profileId: resolvedProfileId });
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
    messagingChatStateMessagePort.update(
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
    const baseGroups = deriveDisplayGroupList(loadGroupMetadataCache());
    if (!isWorkspaceKernelAuthority()) {
      setCreatedGroups(baseGroups);
      return;
    }
    void hydrateGroupSidebarPreviewsFromSqlite({
      groups: baseGroups,
      publicKeyHex: publicKeyHex as PublicKeyHex,
      profileId: resolvedProfileId,
    }).then((hydrated) => {
      setCreatedGroups(hydrated);
    });
  }, [deriveDisplayGroupList, loadGroupMetadataCache, publicKeyHex, resolvedProfileId]);

  useEffect(() => {
    if (!publicKeyHex) {
      setCreatedGroups([]);
      setHasHydratedGroups(false);
      return;
    }
    let cancelled = false;
    const metadataCache = loadGroupMetadataCache();
    const baseGroups = resolveManagedWorkspaceGroupList({
      publicKeyHex,
      profileId: resolvedProfileId,
      persistedGroups: metadataCache,
    });
    if (!isWorkspaceKernelAuthority()) {
      setCreatedGroups(baseGroups);
      setHasHydratedGroups(true);
      return;
    }
    void hydrateGroupSidebarPreviewsFromSqlite({
      groups: baseGroups,
      publicKeyHex: publicKeyHex as PublicKeyHex,
      profileId: resolvedProfileId,
    }).then((hydrated) => {
      if (!cancelled) {
        setCreatedGroups(hydrated);
        setHasHydratedGroups(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loadGroupMetadataCache, publicKeyHex, resolvedProfileId]);

  useEffect(() => {
    if (!publicKeyHex || !hasHydratedGroups || !isWorkspaceKernelAuthority()) {
      return;
    }
    return subscribeGroupThreadMessagesChanged((detail) => {
      if (detail.profileId !== resolvedProfileId) {
        return;
      }
      refreshDisplayFromMetadataCache();
    });
  }, [hasHydratedGroups, publicKeyHex, refreshDisplayFromMetadataCache, resolvedProfileId]);

  useEffect(() => {
    if (!publicKeyHex || !hasHydratedGroups) {
      return;
    }
    void repairGroupMetadataAfterStorageLoss({
      publicKeyHex,
      profileId: resolvedProfileId,
    }).then((restoredCount) => {
      if (restoredCount > 0) {
        refreshDisplayFromMetadataCache();
      }
    });
  }, [hasHydratedGroups, publicKeyHex, refreshDisplayFromMetadataCache, resolvedProfileId]);

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
      const leaveOutbox = readCommunityLeaveOutbox(publicKeyHex, resolvedProfileId);
      const communityIds = Array.from(new Set(
        ledger
          .filter((entry) => {
            const groupId = entry.groupId.trim();
            const relayUrl = (entry.relayUrl ?? "").trim();
            if (!groupId || !relayUrl) {
              return false;
            }
            if (isGroupTombstoned(publicKeyHex, { groupId, relayUrl }, { profileId: resolvedProfileId })) {
              return false;
            }
            const hasLeaveOutbox = leaveOutbox.some((item) => (
              communityMembershipScopeMatches(
                { groupId, relayUrl },
                { groupId: item.groupId, relayUrl: item.relayUrl },
              )
            ));
            if (hasLeaveOutbox) {
              return false;
            }
            if (entry.status === "joined") {
              return !hasTerminalLedgerScopeEvidence(ledger, { groupId, relayUrl });
            }
            return entry.status === "left" && (entry.communityId?.trim().length ?? 0) > 0;
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
      const ledger = loadCommunityMembershipLedger(publicKeyHex, { profileId: resolvedProfileId });
      const hadTerminalLedger = hasTerminalLedgerScopeEvidence(ledger, { groupId, relayUrl });
      const isExplicitRejoin = options?.allowRevive === true
        || tombstoned
        || hadTerminalLedger;
      persistCommunityMembershipLedgerMutation(
        publicKeyHex,
        {
          reason: isExplicitRejoin ? "explicit_rejoin" : "runtime_join_confirmed",
          entry: toCommunityMembershipLedgerEntryFromGroup(group, {
            status: options?.provisionalJoin ? "pending" : "joined",
            updatedAtUnixMs: Date.now(),
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
    messagingChatStateMessagePort.update(
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
    removeCommunityMembershipLedgerScopes(
      publicKeyHex,
      [{ groupId: group.groupId, relayUrl: group.relayUrl }],
      { profileId: resolvedProfileId },
    );
    refreshDisplayFromMetadataCache();
  }, [
    publicKeyHex,
    refreshDisplayFromMetadataCache,
    removeGroupConversation,
    resolveGroupForPurge,
    resolvedProfileId,
  ]);

  const purgeArchivedCommunityMembership = useCallback((params: Readonly<{
    groupId: string;
    relayUrl?: string;
  }>): number => {
    forcePurgeCommunity(params);
    return 1;
  }, [forcePurgeCommunity]);

  const purgeAllArchivedCommunityMemberships = useCallback((): number => {
    if (!publicKeyHex) {
      return 0;
    }
    const archivedRows = listArchivedCommunityMembershipLedgerRows({
      publicKeyHex,
      profileId: resolvedProfileId,
      visibleGroups: createdGroups,
    });
    archivedRows.forEach((row) => {
      forcePurgeCommunity({
        groupId: row.entry.groupId,
        relayUrl: row.entry.relayUrl,
      });
    });
    return archivedRows.length;
  }, [createdGroups, forcePurgeCommunity, publicKeyHex, resolvedProfileId]);

  const archivedCommunityMembershipRows = useMemo(
    () => (
      publicKeyHex
        ? listArchivedCommunityMembershipLedgerRows({
          publicKeyHex,
          profileId: resolvedProfileId,
          visibleGroups: createdGroups,
        })
        : []
    ),
    [createdGroups, publicKeyHex, resolvedProfileId],
  );
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
        purgeArchivedCommunityMembership,
        purgeAllArchivedCommunityMemberships,
        archivedCommunityMembershipRows,
        recordMembershipLedgerAfterInviteDecline,
  }), [
    addGroup,
    archivedCommunityMembershipRows,
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
    purgeAllArchivedCommunityMemberships,
    purgeArchivedCommunityMembership,
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

/** @deprecated Use LegacyGroupProvider */
export const GroupProvider = LegacyGroupProvider;
