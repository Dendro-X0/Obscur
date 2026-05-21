"use client";

import React, { createContext, useContext, useState, useMemo, useEffect, useRef, useCallback } from "react";
import type { GroupConversation } from "@/app/features/messaging/types";
import { CHAT_STATE_REPLACED_EVENT, chatStateStoreService } from "@/app/features/messaging/services/chat-state-store";
import {
    ACCOUNT_RESTORE_MATERIALIZATION_COMPLETED_EVENT,
    ACCOUNT_RESTORE_MATERIALIZATION_STARTED_EVENT,
} from "@/app/features/account-sync/services/restore-materialization-events";
import { fromPersistedGroupConversation, toPersistedGroupConversation } from "@/app/features/messaging/utils/persistence";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { toGroupConversationId } from "@/app/features/groups/utils/group-conversation-id";
import { deriveCommunityId, pickPreferredCommunityId } from "@/app/features/groups/utils/community-identity";
import {
    useOptionalProfileMessageBus,
    useOptionalProfileRuntime,
} from "@/app/features/profiles/providers/profile-runtime-provider";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { subscribeChatStateReplacedDual } from "@/app/features/profiles/services/subscribe-chat-state-replaced-dual";
import { subscribeAccountRestoreMaterializationCompletedDual } from "@/app/features/profiles/services/subscribe-account-restore-materialization-completed-dual";
import { subscribeAccountRestoreMaterializationStartedDual } from "@/app/features/profiles/services/subscribe-account-restore-materialization-started-dual";
import { subscribeCommunityMembershipLedgerUpdatedDual } from "@/app/features/profiles/services/subscribe-community-membership-ledger-updated-dual";
import { subscribeGroupInviteAcceptedDual } from "@/app/features/profiles/services/subscribe-group-invite-accepted-dual";
import { subscribeGroupInviteReceivedDual } from "@/app/features/profiles/services/subscribe-group-invite-received-dual";
import { subscribeCommunityMembershipIngress } from "@/app/features/profiles/services/subscribe-community-membership-ingress";
import { applyCommunityMembershipIngress } from "@/app/features/groups/services/apply-community-membership-ingress";
import type { CommunityMembershipIngressDetail } from "@/app/features/groups/services/community-membership-ingress-contract";
import { subscribeGroupMembershipConfirmedDual } from "@/app/features/profiles/services/subscribe-group-membership-confirmed-dual";
import { subscribeGroupRemoveDual } from "@/app/features/profiles/services/subscribe-group-remove-dual";
import { subscribeGroupMembershipSnapshotDual } from "@/app/features/profiles/services/subscribe-group-membership-snapshot-dual";
import {
    reinstateCommunityMemberTerminalEvidence,
    saveCommunityTerminalMembershipCache,
} from "../services/community-terminal-membership-cache";
import {
    canApplyRelayInferredMemberRemoval,
    resolveRelayEvidenceConfidence,
    type RelayEvidenceConfidence,
} from "../services/community-relay-evidence-policy";
import {
    markCommunityProvisionalMembers,
    stripProvisionalCommunityMembersConfirmedOnRelay,
} from "../services/community-provisional-membership-cache";
import { subscribeGroupDescriptorUpdatedDual } from "@/app/features/profiles/services/subscribe-group-descriptor-updated-dual";
import { subscribeCommunityKnownParticipantsObservedDual } from "@/app/features/profiles/services/subscribe-community-known-participants-observed-dual";
import type {
    CommunityKnownParticipantsObservedDispatchDetail,
    GroupDescriptorUpdatedDispatchDetail,
    GroupMembershipSnapshotDispatchDetail,
} from "@/app/features/profiles/services/profile-bus-dispatch";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
    addGroupTombstone,
    addGroupTombstoneFromConversationId,
    isGroupTombstoned,
    loadGroupTombstones,
    removeGroupTombstone,
    toGroupTombstoneKey
} from "@/app/features/groups/services/group-tombstone-store";
import { auditCommunityMigrationState } from "@/app/features/groups/services/community-migration-audit";
import { pickPreferredCommunityDisplayName } from "@/app/features/groups/services/community-display-name";
import {
    persistCommunityDescriptorUpdate,
    persistCommunityGovernanceDescriptorAccepted,
} from "@/app/features/groups/services/community-descriptor-mutation-owner";
import { logRuntimeEvent } from "@/app/shared/runtime-log-classification";
import {
    COMMUNITY_MEMBERSHIP_LEDGER_UPDATED_EVENT,
    loadCommunityMembershipLedger,
    replaceCommunityMembershipLedger,
    toCommunityMembershipLedgerKey,
    toGroupConversationFromMembershipLedgerEntry,
} from "@/app/features/groups/services/community-membership-ledger";
import {
    computeCommunityState,
    getLocalMembershipState,
    type ComputedCommunityState,
} from "@/app/features/groups/services/community-crdt-engine";
import {
    resolveCommunityMembershipCoordinator,
    resolveCommunityMembershipRuntimeEvidenceDecision,
    type CommunityMembershipRuntimeEvidence,
} from "@/app/features/groups/services/community-membership-coordinator";
import {
    applyCommunityMembershipLedgerMutations,
    applyCommunityMembershipRuntimeEvidence,
    persistCommunityMembershipDisband,
    persistCommunityMembershipRosterTerminal,
    persistExplicitCommunityMembershipLeave,
} from "@/app/features/groups/services/community-membership-mutation-owner";
import { enqueueCommunityLeaveOutboxItem } from "@/app/features/groups/services/community-leave-outbox";
import { logAppEvent } from "@/app/shared/log-app-event";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import {
    buildCommunityRosterProjection,
    dedupeCommunityMemberPubkeys,
    type CommunityRosterProjection,
} from "@/app/features/groups/services/community-member-roster-projection";
import { getResolvedClientGateway } from "@/app/features/profiles/services/resolve-client-gateway";
import {
    resolveEnhancedSnapshotApplication,
    type EnhancedSnapshotApplicationResult,
} from "@/app/features/groups/services/community-member-snapshot-policy";
import {
    buildCommunityKnownParticipantDirectoryByConversationId,
    mergeKnownParticipantSeedPubkeys,
    type CommunityKnownParticipantDirectory,
} from "@/app/features/groups/services/community-known-participant-directory";
import {
    loadCommunityKnownParticipantsEntries,
} from "@/app/features/groups/services/community-known-participants-store";

interface GroupContextType {
    createdGroups: ReadonlyArray<GroupConversation>;
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
    addGroup: (group: GroupConversation, options?: Readonly<{ allowRevive?: boolean; provisionalJoin?: boolean }>) => void;
    updateGroup: (params: Readonly<{ groupId: string; relayUrl?: string; conversationId?: string; updates: Partial<GroupConversation> }>) => void;
    leaveGroup: (params: Readonly<{ groupId: string; relayUrl?: string; conversationId?: string }>) => void;
    removeGroupConversation: (conversationId: string) => void;
    forcePurgeCommunity: (params: Readonly<{ groupId: string; relayUrl?: string; conversationId?: string }>) => void;
    /** Phase 3 M3: after invitee declines (DM response only), persist terminal ledger so ambient join evidence cannot resurrect membership. */
    recordMembershipLedgerAfterInviteDecline: (group: GroupConversation) => void;
}

const GroupContext = createContext<GroupContextType | null>(null);

type InviteMembershipPayload = Readonly<{
    type: "community-invite" | "community-invite-response";
    groupId?: string;
    relayUrl?: string;
    communityId?: string;
    status?: string;
}>;

const parseInviteMembershipPayload = (content: string): InviteMembershipPayload | null => {
    try {
        const parsed = JSON.parse(content) as InviteMembershipPayload;
        if (!parsed || typeof parsed !== "object") {
            return null;
        }
        if (parsed.type !== "community-invite" && parsed.type !== "community-invite-response") {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
};

const inferPeerFromDmConversationId = (params: Readonly<{
    conversationId: string;
    localPublicKeyHex: string;
}>): string | null => {
    const trimmedConversationId = params.conversationId.trim();
    const normalizedDirectPeer = normalizePublicKeyHex(trimmedConversationId);
    if (normalizedDirectPeer && normalizedDirectPeer !== params.localPublicKeyHex) {
        return normalizedDirectPeer;
    }
    const parts = trimmedConversationId.split(":");
    if (parts.length !== 2) {
        return null;
    }
    const left = normalizePublicKeyHex(parts[0]);
    const right = normalizePublicKeyHex(parts[1]);
    if (!left || !right) {
        return null;
    }
    if (left === params.localPublicKeyHex && right !== params.localPublicKeyHex) {
        return right;
    }
    if (right === params.localPublicKeyHex && left !== params.localPublicKeyHex) {
        return left;
    }
    return null;
};

const buildInviteMemberPubkeysByGroupKey = (params: Readonly<{
    localPublicKeyHex: string;
    chatState: ReturnType<typeof chatStateStoreService.load>;
}>): Readonly<Record<string, ReadonlyArray<string>>> => {
    const invitePeersByGroupKey = new Map<string, Set<string>>();
    const terminalInvitePeersByGroupKey = new Map<string, Set<string>>();
    const createdConnections = params.chatState?.createdConnections ?? [];
    const peerByConversationId = new Map<string, string>();
    createdConnections.forEach((connection) => {
        const normalizedPeer = normalizePublicKeyHex(connection.pubkey);
        if (normalizedPeer) {
            peerByConversationId.set(connection.id, normalizedPeer);
        }
    });

    const recordTerminalInvitePeer = (groupKey: string, peerPublicKeyHex: string): void => {
        const current = terminalInvitePeersByGroupKey.get(groupKey) ?? new Set<string>();
        current.add(peerPublicKeyHex);
        terminalInvitePeersByGroupKey.set(groupKey, current);
    };

    const recordInvitePeer = (groupKey: string, peerPublicKeyHex: string): void => {
        const current = invitePeersByGroupKey.get(groupKey) ?? new Set<string>();
        current.add(peerPublicKeyHex);
        invitePeersByGroupKey.set(groupKey, current);
    };

    Object.entries(params.chatState?.messagesByConversationId ?? {}).forEach(([conversationId, messages]) => {
        const peerPublicKeyHex = peerByConversationId.get(conversationId)
            ?? inferPeerFromDmConversationId({
                conversationId,
                localPublicKeyHex: params.localPublicKeyHex,
            });
        if (!peerPublicKeyHex) {
            return;
        }
        messages.forEach((message) => {
            if (typeof message.content !== "string" || message.content.trim().length === 0) {
                return;
            }
            const parsed = parseInviteMembershipPayload(message.content);
            if (!parsed) {
                return;
            }
            const groupId = typeof parsed.groupId === "string" ? parsed.groupId.trim() : "";
            const relayUrl = typeof parsed.relayUrl === "string" ? parsed.relayUrl.trim() : "";
            if (!groupId || !relayUrl) {
                return;
            }
            const groupKey = toGroupTombstoneKey({ groupId, relayUrl });
            if (parsed.type === "community-invite-response") {
                if (parsed.status === "declined" || parsed.status === "canceled") {
                    recordTerminalInvitePeer(groupKey, peerPublicKeyHex);
                } else if (parsed.status === "accepted") {
                    recordInvitePeer(groupKey, peerPublicKeyHex);
                }
                return;
            }
            if (parsed.type === "community-invite") {
                recordInvitePeer(groupKey, peerPublicKeyHex);
            }
        });
    });

    const groupedPeers = new Map<string, Set<string>>();
    invitePeersByGroupKey.forEach((peerSet, groupKey) => {
        const terminalPeers = terminalInvitePeersByGroupKey.get(groupKey) ?? new Set<string>();
        const activePeers = Array.from(peerSet).filter((peer) => !terminalPeers.has(peer));
        if (activePeers.length > 0) {
            groupedPeers.set(groupKey, new Set(activePeers));
        }
    });

    return Object.fromEntries(
        Array.from(groupedPeers.entries()).map(([groupKey, peerSet]) => ([groupKey, Array.from(peerSet)])),
    );
};

export const GroupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const identity = useIdentity();
    const optionalProfileBus = useOptionalProfileMessageBus();
    const [createdGroups, setCreatedGroups] = useState<ReadonlyArray<GroupConversation>>([]);
    const [communityRosterByConversationId, setCommunityRosterByConversationId] = useState<Readonly<Record<string, CommunityRosterProjection>>>({});
    const relayEvidenceByGroupIdRef = useRef<Readonly<Record<string, {
        subscriptionEstablishedAt: number | null;
        lastEventReceivedAt: number | null;
        eoseReceivedAt: number | null;
        eventCount: number;
    }>>>({});
    const [communityKnownParticipantDirectoryByConversationId, setCommunityKnownParticipantDirectoryByConversationId] = useState<Readonly<Record<string, CommunityKnownParticipantDirectory>>>({});
    const communityKnownParticipantDirectoryByConversationIdRef = useRef<Readonly<Record<string, CommunityKnownParticipantDirectory>>>({});
    const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [newGroupMemberPubkeys, setNewGroupMemberPubkeys] = useState("");
    const lastHydratedScopeRef = useRef<string | null>(null);
    const optionalProfileRuntime = useOptionalProfileRuntime();
    const resolvedProfileId = optionalProfileRuntime?.profileId ?? getResolvedProfileId();

    const toMembershipHydrationScopeKey = (pk: string, profileId: string): string => (
        `${profileId}::${pk}`
    );

    const resetLiveGroupProjectionState = useCallback(() => {
        setCreatedGroups([]);
        setCommunityRosterByConversationId({});
        communityKnownParticipantDirectoryByConversationIdRef.current = {};
        setCommunityKnownParticipantDirectoryByConversationId({});
    }, []);
    const createdGroupsRef = useRef<ReadonlyArray<GroupConversation>>([]);
    const activeRestoreMaterializationRef = useRef<Readonly<{ publicKeyHex: string; profileId: string }> | null>(null);
    const dedupePubkeys = (values: ReadonlyArray<string>): ReadonlyArray<string> => (
        Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)))
    );
    const PLACEHOLDER_GROUP_DISPLAY_NAME = "Private Group";
    const toPublicKeySuffix = (value: string): string => value.slice(-8);

    const sanitizeGroup = (group: GroupConversation): GroupConversation => {
        const relayUrl = typeof group.relayUrl === "string" && group.relayUrl.trim().length > 0
            ? group.relayUrl.trim()
            : "";
        const communityId = deriveCommunityId({
            existingCommunityId: group.communityId,
            groupId: group.groupId,
            relayUrl,
            genesisEventId: group.genesisEventId,
            creatorPubkey: group.creatorPubkey
        });
        const canonicalId = toGroupConversationId({
            groupId: group.groupId,
            relayUrl,
            communityId,
            genesisEventId: group.genesisEventId,
            creatorPubkey: group.creatorPubkey
        });
        return {
            ...group,
            id: canonicalId,
            communityId,
            displayName: group.displayName?.trim() || "Private Group",
            memberPubkeys: Array.isArray(group.memberPubkeys) ? group.memberPubkeys : [],
            adminPubkeys: Array.isArray(group.adminPubkeys) ? group.adminPubkeys : []
        };
    };

    const mergeGroupConversations = useCallback((params: Readonly<{
        current: GroupConversation;
        incoming: GroupConversation;
        localPublicKeyHex: string | null;
    }>): GroupConversation => {
        const current = sanitizeGroup(params.current);
        const incoming = sanitizeGroup(params.incoming);
        const currentLastMessageUnixMs = current.lastMessageTime?.getTime?.() ?? 0;
        const incomingLastMessageUnixMs = incoming.lastMessageTime?.getTime?.() ?? 0;
        const incomingIsNewer = incomingLastMessageUnixMs >= currentLastMessageUnixMs;
        const primary = incomingIsNewer ? incoming : current;
        const secondary = incomingIsNewer ? current : incoming;
        const mergedMemberPubkeys = dedupePubkeys([
            ...current.memberPubkeys,
            ...incoming.memberPubkeys,
            ...(params.localPublicKeyHex ? [params.localPublicKeyHex] : []),
        ]);
        const mergedAdminPubkeys = dedupePubkeys([
            ...current.adminPubkeys,
            ...incoming.adminPubkeys,
        ]);
        const primaryAvatar = primary.avatar?.trim();
        const secondaryAvatar = secondary.avatar?.trim();
        const primaryAbout = primary.about?.trim();
        const secondaryAbout = secondary.about?.trim();

        return sanitizeGroup({
            ...secondary,
            ...primary,
            communityId: pickPreferredCommunityId(primary.communityId, secondary.communityId),
            displayName: pickPreferredCommunityDisplayName(
                primary.displayName,
                secondary.displayName,
                {
                    groupId: primary.groupId ?? secondary.groupId,
                    communityId: pickPreferredCommunityId(primary.communityId, secondary.communityId),
                },
            ),
            memberPubkeys: mergedMemberPubkeys,
            adminPubkeys: mergedAdminPubkeys,
            memberCount: Math.max(
                current.memberCount ?? 0,
                incoming.memberCount ?? 0,
                mergedMemberPubkeys.length,
                1,
            ),
            avatar: primaryAvatar && primaryAvatar.length > 0
                ? primaryAvatar
                : secondaryAvatar && secondaryAvatar.length > 0
                    ? secondaryAvatar
                    : undefined,
            about: primaryAbout && primaryAbout.length > 0
                ? primaryAbout
                : secondaryAbout && secondaryAbout.length > 0
                    ? secondaryAbout
                    : undefined,
        });
    }, []);

    const areGroupsEquivalent = useCallback((left: GroupConversation, right: GroupConversation): boolean => {
        return (
            left.id === right.id
            && left.communityId === right.communityId
            && left.groupId === right.groupId
            && left.relayUrl === right.relayUrl
            && left.communityMode === right.communityMode
            && left.relayCapabilityTier === right.relayCapabilityTier
            && left.displayName === right.displayName
            && left.lastMessage === right.lastMessage
            && left.unreadCount === right.unreadCount
            && (left.lastMessageTime?.getTime?.() ?? 0) === (right.lastMessageTime?.getTime?.() ?? 0)
            && left.access === right.access
            && left.memberCount === right.memberCount
            && left.avatar === right.avatar
            && left.about === right.about
            && left.memberPubkeys.join(",") === right.memberPubkeys.join(",")
            && left.adminPubkeys.join(",") === right.adminPubkeys.join(",")
        );
    }, []);

    const getPublicKeyHex = useCallback(() => {
        return identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? null;
    }, [identity.state.publicKeyHex, identity.state.stored?.publicKeyHex]);

    useEffect(() => {
        createdGroupsRef.current = createdGroups;
    }, [createdGroups]);

    useEffect(() => {
        communityKnownParticipantDirectoryByConversationIdRef.current = communityKnownParticipantDirectoryByConversationId;
    }, [communityKnownParticipantDirectoryByConversationId]);

    const areCommunityRosterProjectionsEquivalent = useCallback((
        left: Readonly<Record<string, CommunityRosterProjection>>,
        right: Readonly<Record<string, CommunityRosterProjection>>,
    ): boolean => {
        const leftKeys = Object.keys(left);
        const rightKeys = Object.keys(right);
        if (leftKeys.length !== rightKeys.length) {
            return false;
        }
        return leftKeys.every((key) => {
            const leftProjection = left[key];
            const rightProjection = right[key];
            if (!leftProjection || !rightProjection) {
                return false;
            }
            return (
                leftProjection.conversationId === rightProjection.conversationId
                && leftProjection.groupId === rightProjection.groupId
                && leftProjection.relayUrl === rightProjection.relayUrl
                && leftProjection.communityId === rightProjection.communityId
                && leftProjection.memberCount === rightProjection.memberCount
                && leftProjection.activeMemberPubkeys.join(",") === rightProjection.activeMemberPubkeys.join(",")
            );
        });
    }, []);

    const reconcileCommunityRosterProjectionState = useCallback((
        groups: ReadonlyArray<GroupConversation>,
        currentProjectionByConversationId: Readonly<Record<string, CommunityRosterProjection>>,
    ): Readonly<Record<string, CommunityRosterProjection>> => (
        Object.fromEntries(
            groups.map((group) => {
                const currentProjection = currentProjectionByConversationId[group.id];
                if (!currentProjection) {
                    return [group.id, buildCommunityRosterProjection(group)];
                }
                return [group.id, {
                    ...currentProjection,
                    conversationId: group.id,
                    groupId: group.groupId,
                    relayUrl: group.relayUrl,
                    communityId: group.communityId,
                    memberCount: Math.max(currentProjection.activeMemberPubkeys.length, 1),
                }];
            })
        )
    ), []);

    useEffect(() => {
        setCommunityRosterByConversationId((previous) => {
            const next = reconcileCommunityRosterProjectionState(createdGroups, previous);
            return areCommunityRosterProjectionsEquivalent(previous, next)
                ? previous
                : next;
        });
    }, [areCommunityRosterProjectionsEquivalent, createdGroups, reconcileCommunityRosterProjectionState]);

    const areCommunityKnownParticipantDirectoriesEquivalent = useCallback((
        left: Readonly<Record<string, CommunityKnownParticipantDirectory>>,
        right: Readonly<Record<string, CommunityKnownParticipantDirectory>>,
    ): boolean => {
        const leftKeys = Object.keys(left);
        const rightKeys = Object.keys(right);
        if (leftKeys.length !== rightKeys.length) {
            return false;
        }
        return leftKeys.every((key) => {
            const leftDirectory = left[key];
            const rightDirectory = right[key];
            if (!leftDirectory || !rightDirectory) {
                return false;
            }
            return (
                leftDirectory.conversationId === rightDirectory.conversationId
                && leftDirectory.groupId === rightDirectory.groupId
                && leftDirectory.relayUrl === rightDirectory.relayUrl
                && leftDirectory.communityId === rightDirectory.communityId
                && leftDirectory.participantCount === rightDirectory.participantCount
                && leftDirectory.participantPubkeys.join(",") === rightDirectory.participantPubkeys.join(",")
            );
        });
    }, []);

    useEffect(() => {
        const pk = getPublicKeyHex();
        if (!pk) {
            setCommunityKnownParticipantDirectoryByConversationId({});
            return;
        }
        setCommunityKnownParticipantDirectoryByConversationId((previous) => {
            const profileId = getResolvedProfileId();
            const next = buildCommunityKnownParticipantDirectoryByConversationId({
                groups: createdGroups,
                rosterProjectionByConversationId: communityRosterByConversationId,
                storedEntries: loadCommunityKnownParticipantsEntries(pk as PublicKeyHex, profileId),
                localMemberPubkey: pk as PublicKeyHex,
            });
            return areCommunityKnownParticipantDirectoriesEquivalent(previous, next)
                ? previous
                : next;
        });
    }, [areCommunityKnownParticipantDirectoriesEquivalent, communityRosterByConversationId, createdGroups, getPublicKeyHex]);

    useEffect(() => {
        const pk = getPublicKeyHex();
        if (!pk) {
            return;
        }
        const profileId = getResolvedProfileId();
        const storedEntries = loadCommunityKnownParticipantsEntries(pk as PublicKeyHex, profileId);
        Object.values(communityKnownParticipantDirectoryByConversationId).forEach((directory) => {
            const storedEntry = storedEntries.find((entry) => (
                entry.groupId === directory.groupId && entry.relayUrl === directory.relayUrl
            ));
            const group = createdGroups.find((g) => g.id === directory.conversationId);
            getResolvedClientGateway().communityRoster.persistKnownParticipantDirectoryIfWidened({
                publicKeyHex: pk as PublicKeyHex,
                profileId,
                directory,
                persistedGroupMemberPubkeys: (group?.memberPubkeys ?? []) as ReadonlyArray<PublicKeyHex>,
                storedEntry,
            });
        });
    }, [communityKnownParticipantDirectoryByConversationId, createdGroups, getPublicKeyHex]);

    const upsertCommunityRosterProjection = useCallback((params: Readonly<{
        group: GroupConversation;
        activeMemberPubkeys?: ReadonlyArray<string>;
    }>): void => {
        setCommunityRosterByConversationId((previous) => {
            const current = previous[params.group.id];

            // Get members from group (this may be thinned after refresh)
            const groupMembers = dedupePubkeys(
                (params.activeMemberPubkeys ?? params.group.memberPubkeys) as ReadonlyArray<string>
            ) as ReadonlyArray<PublicKeyHex>;

            // Get known participants from directory (OR-Set merged, never thins)
            const knownParticipants = communityKnownParticipantDirectoryByConversationId[params.group.id]?.participantPubkeys ?? [];

            // FIX: Merge with current projection if it exists (OR-Set style union)
            // This prevents member thinning when group updates come in with partial member lists
            const currentMembers = current?.activeMemberPubkeys ?? [];
            const allMembers = new Set([...groupMembers, ...knownParticipants, ...currentMembers]);
            const mergedMembers = Array.from(allMembers) as ReadonlyArray<PublicKeyHex>;

            const nextProjection: CommunityRosterProjection = {
                conversationId: params.group.id,
                groupId: params.group.groupId,
                relayUrl: params.group.relayUrl,
                communityId: params.group.communityId,
                activeMemberPubkeys: mergedMembers,
                memberCount: Math.max(mergedMembers.length, 1),
            };

            if (
                current
                && current.conversationId === nextProjection.conversationId
                && current.groupId === nextProjection.groupId
                && current.relayUrl === nextProjection.relayUrl
                && current.communityId === nextProjection.communityId
                && current.memberCount === nextProjection.memberCount
                && current.activeMemberPubkeys.join(",") === nextProjection.activeMemberPubkeys.join(",")
            ) {
                return previous;
            }
            return {
                ...previous,
                [params.group.id]: nextProjection,
            };
        });
    }, [communityKnownParticipantDirectoryByConversationId]);

    const dedupeGroups = (groups: ReadonlyArray<GroupConversation>): ReadonlyArray<GroupConversation> => {
        const map = new Map<string, GroupConversation>();
        const localPublicKeyHex = getPublicKeyHex();
        groups.forEach((group) => {
            const normalized = sanitizeGroup(group);
            const key = toGroupTombstoneKey({ groupId: normalized.groupId, relayUrl: normalized.relayUrl });
            const existing = map.get(key);
            if (!existing) {
                map.set(key, normalized);
                return;
            }
            map.set(key, mergeGroupConversations({
                current: existing,
                incoming: normalized,
                localPublicKeyHex,
            }));
        });
        return Array.from(map.values());
    };

    const hydrateGroupsForPublicKey = useCallback((pk: string, options?: Readonly<{ profileId?: string }>) => {
        const profileId = options?.profileId ?? getResolvedProfileId();

        const persisted = chatStateStoreService.load(pk);
        const tombstones = loadGroupTombstones(pk, { profileId });
        const inviteMemberPubkeysByGroupKey = buildInviteMemberPubkeysByGroupKey({
            localPublicKeyHex: pk,
            chatState: persisted,
        });
        if (persisted?.createdGroups) {
            const audit = auditCommunityMigrationState({ state: persisted, tombstones });
            if (!audit.ok) {
                logRuntimeEvent(
                    "community_migration.audit_findings",
                    "expected",
                    ["[CommunityMigrationAudit] findings", audit],
                );
            }
        }
        const persistedGroups = persisted?.createdGroups
            ? dedupeGroups(persisted.createdGroups.map(fromPersistedGroupConversation))
            : [];
        const coordinator = resolveCommunityMembershipCoordinator({
            publicKeyHex: pk,
            profileId,
            persistedGroups,
            membershipLedger: loadCommunityMembershipLedger(pk, { profileId }),
            tombstones,
            inviteMemberPubkeysByGroupKey,
            groupMessageAuthorsByConversationId: Object.fromEntries(
                Object.entries(persisted?.groupMessages ?? {}).map(([conversationId, messages]) => ([
                    conversationId,
                    getResolvedClientGateway().communityRoster.resolveAuthorEvidencePubkeysFromMessages(messages),
                ]))
            ),
        });
        const groups = dedupeGroups(coordinator.groups.map((group) => {
            const messageAuthorPubkeys = getResolvedClientGateway().communityRoster.resolveAuthorEvidencePubkeysFromMessages(
                persisted?.groupMessages?.[group.id] ?? [],
            );
            const mergedMemberPubkeys = dedupePubkeys([
                ...(group.memberPubkeys ?? []),
                ...messageAuthorPubkeys,
                pk,
            ]);
            if (mergedMemberPubkeys.join(",") === (group.memberPubkeys ?? []).join(",")) {
                return group;
            }
            return {
                ...group,
                memberPubkeys: mergedMemberPubkeys,
                memberCount: Math.max(group.memberCount ?? 0, mergedMemberPubkeys.length, 1),
            };
        }))
            .filter((group) => !tombstones.has(toGroupTombstoneKey({ groupId: group.groupId, relayUrl: group.relayUrl })));
        queueMicrotask(() => {
            const activePublicKey = getPublicKeyHex();
            if (activePublicKey !== pk) {
                return;
            }
            setCreatedGroups(groups);
        });
        logAppEvent({
            name: "groups.membership_recovery_hydrate",
            level: "info",
            scope: { feature: "groups", action: "membership_recovery" },
            context: {
                publicKeySuffix: toPublicKeySuffix(pk),
                profileId,
                persistedGroupCount: coordinator.diagnostics.persistedGroupCount,
                persistedDuplicateMergeCount: coordinator.diagnostics.persistedDuplicateMergeCount,
                ledgerEntryCount: coordinator.diagnostics.ledgerEntryCount,
                visibleGroupCount: coordinator.diagnostics.visibleGroupCount,
                hydratedFromPersistedWithLedgerCount: coordinator.diagnostics.hydratedFromPersistedWithLedgerCount,
                hydratedFromPersistedFallbackCount: coordinator.diagnostics.hydratedFromPersistedFallbackCount,
                hydratedFromLedgerOnlyCount: coordinator.diagnostics.hydratedFromLedgerOnlyCount,
                descriptorProjectionCount: coordinator.descriptorProjections.length,
                membershipProjectionCount: coordinator.membershipProjections.length,
                projectionVisibleCount: coordinator.descriptorProjections.filter((entry) => entry.visibilityState === "visible").length,
                projectionJoinedCount: coordinator.membershipProjections.filter((entry) => entry.status === "joined").length,
                projectionPersistedFallbackCount: coordinator.membershipProjections.filter((entry) => entry.sourceOfTruth === "persisted_fallback").length,
                projectionLedgerCount: coordinator.membershipProjections.filter((entry) => entry.sourceOfTruth === "ledger").length,
                placeholderDisplayNameRecoveredCount: coordinator.diagnostics.placeholderDisplayNameRecoveredCount,
                localMemberBackfillCount: coordinator.diagnostics.localMemberBackfillCount,
                hiddenByTombstoneCount: coordinator.diagnostics.hiddenByTombstoneCount,
                hiddenByLedgerStatusCount: coordinator.diagnostics.hiddenByLedgerStatusCount,
                hiddenByLeaveIntentCount: coordinator.diagnostics.hiddenByLeaveIntentCount,
                missingLedgerCoverageCount: coordinator.diagnostics.missingLedgerCoverageCount,
                missingLedgerCoverageBackfillCount: coordinator.ledgerMutations.filter((mutation) => mutation.reason === "persisted_fallback_backfill").length,
                coordinatorLedgerMutationCount: coordinator.diagnostics.ledgerMutationCount,
                coordinatorRuntimeJoinSuppressedByTerminalCount: coordinator.diagnostics.runtimeJoinSuppressedByTerminalCount,
                coordinatorExplicitTerminalLedgerCount: coordinator.diagnostics.explicitTerminalLedgerCount,
                tombstoneCount: tombstones.size,
            },
        });
        // Self-heal legacy/non-canonical persisted group entries.
        chatStateStoreService.updateGroups(pk, groups.map(g => toPersistedGroupConversation(g)));
        groups.forEach((group) => {
            getResolvedClientGateway().communityRoster.persistHydratedGroupKnownParticipants({
                publicKeyHex: pk as PublicKeyHex,
                profileId,
                group,
                additionalParticipantPubkeys: dedupePubkeys(
                    inviteMemberPubkeysByGroupKey[toGroupTombstoneKey({ groupId: group.groupId, relayUrl: group.relayUrl })] ?? [],
                ) as ReadonlyArray<PublicKeyHex>,
            });
        });
        applyCommunityMembershipLedgerMutations(pk, coordinator.ledgerMutations, { profileId });
    }, [getPublicKeyHex]);

    const applyCoordinatorRuntimeMembershipEvidence = useCallback((
        pk: string,
        evidence: CommunityMembershipRuntimeEvidence,
        options?: Readonly<{ profileId?: string }>,
    ) => {
        const profileId = options?.profileId ?? getResolvedProfileId();
        return applyCommunityMembershipRuntimeEvidence({
            publicKeyHex: pk,
            profileId,
            evidence,
            membershipLedger: loadCommunityMembershipLedger(pk, { profileId }),
            tombstones: loadGroupTombstones(pk, { profileId }),
        });
    }, []);

    const applyCoordinatorExplicitLeave = useCallback((
        pk: string,
        group: GroupConversation,
        options?: Readonly<{ profileId?: string }>,
    ) => {
        const profileId = options?.profileId ?? getResolvedProfileId();
        return persistExplicitCommunityMembershipLeave({
            publicKeyHex: pk,
            group,
            profileId,
        });
    }, []);

    const applyCoordinatorRosterSnapshotTerminalEvidence = useCallback((params: Readonly<{
        pk: string;
        group: GroupConversation;
        leftMemberPubkeys: ReadonlyArray<string>;
        expelledMemberPubkeys: ReadonlyArray<string>;
        updatedAtUnixMs?: number;
        profileId?: string;
    }>) => {
        const profileId = params.profileId ?? getResolvedProfileId();
        return persistCommunityMembershipRosterTerminal({
            publicKeyHex: params.pk,
            group: params.group,
            leftMemberPubkeys: params.leftMemberPubkeys,
            expelledMemberPubkeys: params.expelledMemberPubkeys,
            updatedAtUnixMs: params.updatedAtUnixMs,
            profileId,
        });
    }, []);

    const applyCoordinatorDisbandEvidence = useCallback((params: Readonly<{
        pk: string;
        group: GroupConversation;
        disbandedAtUnixMs: number;
        profileId?: string;
    }>) => {
        const profileId = params.profileId ?? getResolvedProfileId();
        return persistCommunityMembershipDisband({
            publicKeyHex: params.pk,
            group: params.group,
            disbandedAtUnixMs: params.disbandedAtUnixMs,
            profileId,
        });
    }, []);

    const recordMembershipLedgerAfterInviteDecline = useCallback((group: GroupConversation) => {
        const pk = getPublicKeyHex();
        if (!pk) {
            return;
        }
        applyCoordinatorExplicitLeave(pk, sanitizeGroup(group), { profileId: getResolvedProfileId() });
    }, [applyCoordinatorExplicitLeave, getPublicKeyHex]);

    useEffect(() => {
        const pk = getPublicKeyHex();
        if (!pk) {
            lastHydratedScopeRef.current = null;
            resetLiveGroupProjectionState();
            return;
        }
        const scopeKey = toMembershipHydrationScopeKey(pk, resolvedProfileId);
        if (lastHydratedScopeRef.current === scopeKey) {
            return;
        }
        logAppEvent({
            name: "groups.membership_recovery_primary_hydrate_triggered",
            level: "info",
            scope: { feature: "groups", action: "membership_recovery" },
            context: {
                publicKeySuffix: toPublicKeySuffix(pk),
                profileId: resolvedProfileId,
                trigger: lastHydratedScopeRef.current === null
                    ? "identity_or_profile_scope_initial"
                    : "identity_or_profile_scope_changed",
            },
        });
        resetLiveGroupProjectionState();
        hydrateGroupsForPublicKey(pk, { profileId: resolvedProfileId });
        lastHydratedScopeRef.current = scopeKey;
    }, [getPublicKeyHex, hydrateGroupsForPublicKey, resetLiveGroupProjectionState, resolvedProfileId]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const applyScopedHydrateRefresh = (
            triggerEvent: string,
            detail?: Readonly<{ publicKeyHex?: string; profileId?: string }>,
        ): void => {
            const pk = getPublicKeyHex();
            if (!pk) return;
            const profileId = getResolvedProfileId();
            if (detail?.publicKeyHex && detail.publicKeyHex !== pk) {
                return;
            }
            if (detail?.profileId && detail.profileId !== profileId) {
                return;
            }
            const activeRestore = activeRestoreMaterializationRef.current;
            if (
                triggerEvent === COMMUNITY_MEMBERSHIP_LEDGER_UPDATED_EVENT
                && activeRestore?.publicKeyHex === pk
                && activeRestore.profileId === profileId
            ) {
                return;
            }
            logAppEvent({
                name: "groups.membership_recovery_refresh_triggered",
                level: "info",
                scope: { feature: "groups", action: "membership_recovery" },
                context: {
                    publicKeySuffix: toPublicKeySuffix(pk),
                    profileId,
                    triggerEvent,
                    scopedPublicKeyMatch: detail?.publicKeyHex ? 1 : 0,
                },
            });
            hydrateGroupsForPublicKey(pk, { profileId });
            lastHydratedScopeRef.current = toMembershipHydrationScopeKey(pk, profileId);
        };

        const unsubChatDual = subscribeChatStateReplacedDual((detail) => {
            applyScopedHydrateRefresh(CHAT_STATE_REPLACED_EVENT, detail);
        }, optionalProfileBus);

        const unsubRestoreStartedDual = subscribeAccountRestoreMaterializationStartedDual((detail) => {
            activeRestoreMaterializationRef.current = {
                publicKeyHex: detail.publicKeyHex,
                profileId: detail.profileId,
            };
        }, optionalProfileBus);

        const unsubRestoreCompletedDual = subscribeAccountRestoreMaterializationCompletedDual((detail) => {
            const pk = getPublicKeyHex();
            const profileId = getResolvedProfileId();
            if (
                !pk
                || detail.publicKeyHex !== pk
                || detail.profileId !== profileId
            ) {
                return;
            }
            activeRestoreMaterializationRef.current = null;
            applyScopedHydrateRefresh(ACCOUNT_RESTORE_MATERIALIZATION_COMPLETED_EVENT, detail);
        }, optionalProfileBus);

        const unsubLedgerDual = subscribeCommunityMembershipLedgerUpdatedDual((detail) => {
            applyScopedHydrateRefresh(COMMUNITY_MEMBERSHIP_LEDGER_UPDATED_EVENT, detail);
        }, optionalProfileBus);

        return () => {
            unsubChatDual();
            unsubRestoreStartedDual();
            unsubRestoreCompletedDual();
            unsubLedgerDual();
        };
    }, [getPublicKeyHex, hydrateGroupsForPublicKey, optionalProfileBus, resolvedProfileId]);

    const addGroup = useCallback((group: GroupConversation, options?: Readonly<{ allowRevive?: boolean; provisionalJoin?: boolean }>) => {
        setCreatedGroups(prev => {
            const normalized = sanitizeGroup(group);
            const pk = getPublicKeyHex();
            if (pk) {
                const profileId = getResolvedProfileId();
                const tombstoned = isGroupTombstoned(pk, { groupId: normalized.groupId, relayUrl: normalized.relayUrl }, { profileId });
                if (tombstoned && !options?.allowRevive) {
                    return prev;
                }
                if (options?.allowRevive) {
                    removeGroupTombstone(pk, { groupId: normalized.groupId, relayUrl: normalized.relayUrl }, { profileId });
                }
            }
            const hasExisting = prev.some(g => g.groupId === normalized.groupId && g.relayUrl === normalized.relayUrl);
            if (hasExisting) {
                const next = prev.map((group) => {
                    if (group.groupId !== normalized.groupId || group.relayUrl !== normalized.relayUrl) {
                        return group;
                    }
                    return mergeGroupConversations({
                        current: group,
                        incoming: normalized,
                        localPublicKeyHex: pk,
                    });
                });
                const merged = next.find((group) => (
                    group.groupId === normalized.groupId && group.relayUrl === normalized.relayUrl
                )) ?? normalized;
                if (pk && !options?.provisionalJoin) {
                    chatStateStoreService.updateGroups(pk, next.map(g => toPersistedGroupConversation(g)));
                    applyCoordinatorRuntimeMembershipEvidence(pk, {
                        kind: options?.allowRevive ? "user_explicit_rejoin" : "user_explicit_join",
                        group: merged,
                    });
                } else if (pk) {
                    chatStateStoreService.updateGroups(pk, next.map(g => toPersistedGroupConversation(g)));
                }
                setCommunityRosterByConversationId((previous) => (
                    previous[merged.id]
                        ? previous
                        : {
                            ...previous,
                            [merged.id]: buildCommunityRosterProjection(merged),
                        }
                ));
                return areGroupsEquivalent(prev.find((group) => (
                    group.groupId === normalized.groupId && group.relayUrl === normalized.relayUrl
                )) ?? normalized, merged)
                    ? prev
                    : next;
            }
            const next = dedupeGroups([...prev, normalized]);
            if (pk && !options?.provisionalJoin) {
                chatStateStoreService.updateGroups(pk, next.map(g => toPersistedGroupConversation(g)));
                applyCoordinatorRuntimeMembershipEvidence(pk, {
                    kind: options?.allowRevive ? "user_explicit_rejoin" : "user_explicit_join",
                    group: normalized,
                });
            } else if (pk) {
                chatStateStoreService.updateGroups(pk, next.map(g => toPersistedGroupConversation(g)));
            }
            setCommunityRosterByConversationId((previous) => ({
                ...previous,
                [normalized.id]: buildCommunityRosterProjection(normalized),
            }));
            return next;
        });
    }, [applyCoordinatorRuntimeMembershipEvidence, getPublicKeyHex]);

    const updateGroup = useCallback((params: Readonly<{ groupId: string; relayUrl?: string; conversationId?: string; updates: Partial<GroupConversation> }>) => {
        setCreatedGroups(prev => {
            const index = prev.findIndex((g) => {
                if (params.conversationId) return g.id === params.conversationId;
                if (params.relayUrl) return g.groupId === params.groupId && g.relayUrl === params.relayUrl;
                return g.groupId === params.groupId;
            });
            if (index === -1) return prev;
            const next = [...prev];
            next[index] = { ...next[index], ...params.updates };
            const pk = getPublicKeyHex();
            if (pk) {
                chatStateStoreService.updateGroups(pk, next.map(g => toPersistedGroupConversation(g)));
                applyCoordinatorRuntimeMembershipEvidence(pk, {
                    kind: "runtime_membership_confirmed",
                    group: next[index],
                });
            }
            return next;
        });
    }, [applyCoordinatorRuntimeMembershipEvidence, getPublicKeyHex]);

    const leaveGroup = useCallback((params: Readonly<{ groupId: string; relayUrl?: string; conversationId?: string }>) => {
        setCreatedGroups(prev => {
            const removedGroups = prev.filter((g) => {
                if (params.conversationId) return g.id === params.conversationId;
                if (params.relayUrl) return g.groupId === params.groupId && g.relayUrl === params.relayUrl;
                return g.groupId === params.groupId;
            });
            const matched = params.conversationId
                ? removedGroups[0]
                : undefined;
            const next = prev.filter((g) => {
                if (params.conversationId) return g.id !== params.conversationId;
                if (params.relayUrl) return !(g.groupId === params.groupId && g.relayUrl === params.relayUrl);
                return g.groupId !== params.groupId;
            });
            const pk = getPublicKeyHex();
            if (pk) {
                const profileId = getResolvedProfileId();
                removedGroups.forEach((group) => {
                    applyCoordinatorExplicitLeave(pk, group, { profileId });
                    enqueueCommunityLeaveOutboxItem({
                        publicKeyHex: pk,
                        groupId: group.groupId,
                        relayUrl: group.relayUrl,
                        communityId: group.communityId,
                        profileId,
                    });
                });
                if (params.conversationId && matched) {
                    addGroupTombstone(pk, { groupId: matched.groupId, relayUrl: matched.relayUrl }, { profileId });
                } else if (params.relayUrl) {
                    addGroupTombstone(pk, { groupId: params.groupId, relayUrl: params.relayUrl }, { profileId });
                } else if (params.conversationId) {
                    addGroupTombstoneFromConversationId(pk, params.conversationId, { profileId }); // legacy fallback
                }
                chatStateStoreService.updateGroups(pk, next.map(g => toPersistedGroupConversation(g)));
            }
            return next;
        });
    }, [applyCoordinatorExplicitLeave, getPublicKeyHex]);

    const removeGroupConversation = useCallback((conversationId: string) => {
        setCreatedGroups(prev => {
            const matched = prev.find((g) => g.id === conversationId);
            const next = prev.filter(g => g.id !== conversationId);
            const pk = getPublicKeyHex();
            if (pk) {
                const profileId = getResolvedProfileId();
                if (matched) {
                    addGroupTombstone(pk, { groupId: matched.groupId, relayUrl: matched.relayUrl }, { profileId });
                    applyCoordinatorExplicitLeave(pk, matched, { profileId });
                } else {
                    addGroupTombstoneFromConversationId(pk, conversationId, { profileId }); // legacy fallback
                }
                chatStateStoreService.updateGroups(pk, next.map(g => toPersistedGroupConversation(g)));
            }
            return next;
        });
    }, [applyCoordinatorExplicitLeave, getPublicKeyHex]);

    /**
     * FORCE PURGE: Definitively removes a community regardless of member state
     * This bypasses the normal disband check and clears ALL local state for the community
     */
    const forcePurgeCommunity = useCallback((params: Readonly<{
        groupId: string;
        relayUrl?: string;
        conversationId?: string;
    }>) => {
        const pk = getPublicKeyHex();
        if (!pk) return;

        const { groupId, relayUrl, conversationId } = params;
        const targetConversationId = conversationId ?? (groupId && relayUrl
            ? toGroupConversationId({ groupId, relayUrl })
            : undefined);

        if (!targetConversationId) {
            logAppEvent({
                name: "groups.force_purge_failed",
                level: "error",
                context: { reason: "cannot_determine_conversation_id", groupId: groupId ?? null, relayUrl: relayUrl ?? null },
            });
            return;
        }

        // 1. Remove from UI state immediately
        setCreatedGroups(prev => {
            const profileId = getResolvedProfileId();
            const matched = prev.find(g => g.id === targetConversationId);
            const next = prev.filter(g => g.id !== targetConversationId);

            // 2. Add tombstone to prevent re-hydration
            if (matched) {
                addGroupTombstone(pk, { groupId: matched.groupId, relayUrl: matched.relayUrl }, { profileId });
            } else if (groupId && relayUrl) {
                addGroupTombstone(pk, { groupId, relayUrl }, { profileId });
            }

            // 3. Clear from chat state
            chatStateStoreService.updateGroups(pk, next.map(g => toPersistedGroupConversation(g)));

            // 4. Clear ALL ledger entries for this community (critical fix)
            const ledger = loadCommunityMembershipLedger(pk, { profileId });
            const communityId = matched?.communityId ?? (groupId && relayUrl
                ? deriveCommunityId({ groupId, relayUrl })
                : undefined);

            if (communityId) {
                const cleanedLedger = ledger.filter(entry => {
                    // Keep entries for OTHER communities, remove all for this one
                    const entryCommunityId = entry.communityId ??
                        (entry.groupId && entry.relayUrl
                            ? deriveCommunityId({ groupId: entry.groupId, relayUrl: entry.relayUrl, existingCommunityId: entry.communityId })
                            : undefined);
                    return entryCommunityId !== communityId;
                });

                // Save cleaned ledger through canonical owner (do not write localStorage directly).
                if (cleanedLedger.length !== ledger.length) {
                    replaceCommunityMembershipLedger(pk, cleanedLedger, { profileId });
                }
            }

            logAppEvent({
                name: "groups.force_purge_complete",
                level: "info",
                context: {
                    groupId: groupId ?? null,
                    relayUrl: relayUrl ?? null,
                    conversationId: targetConversationId,
                    hadLocalGroup: !!matched,
                },
            });

            return next;
        });
    }, [getPublicKeyHex]);

    useEffect(() => {
        const shouldMaterializeRuntimeEvidence = (
            pk: string | null | undefined,
            evidence: CommunityMembershipRuntimeEvidence,
            profileId?: string,
        ): boolean => {
            if (!pk) {
                return true;
            }
            return resolveCommunityMembershipRuntimeEvidenceDecision({
                evidence,
                membershipLedger: loadCommunityMembershipLedger(pk, { profileId }),
            }).shouldMaterializeGroup;
        };
        const handleGroupRemoveConversationId = (conversationId: string) => {
            if (typeof conversationId === "string" && conversationId.length > 0) {
                removeGroupConversation(conversationId);
            }
        };
        const handleInviteAcceptedDetail = (detail: {
            groupId?: string;
            relayUrl?: string;
            communityId?: string;
            memberPubkey?: string;
            recipientPublicKeyHex?: string;
        }) => {
            const groupId = detail?.groupId?.trim();
            const memberPubkey = detail?.memberPubkey?.trim();
            if (!groupId || !memberPubkey) {
                return;
            }
            const localPublicKey = getPublicKeyHex();
            const eventRecipient = detail?.recipientPublicKeyHex?.trim();
            if (eventRecipient && localPublicKey && eventRecipient !== localPublicKey) {
                logAppEvent({ name: "groups.event_quarantined_identity_mismatch", level: "warn", scope: { feature: "groups", action: "invite_accepted" }, context: { reason: "recipient_pubkey_mismatch", eventRecipientSuffix: eventRecipient.slice(-8), localPublicKeySuffix: localPublicKey.slice(-8), groupId } });
                return;
            }
            const relayHint = detail?.relayUrl?.trim();
            const communityHint = detail?.communityId?.trim();
            const profileId = getResolvedProfileId();
            if (relayHint) {
                reinstateCommunityMemberTerminalEvidence({
                    groupId,
                    relayUrl: relayHint,
                    memberPubkeys: [memberPubkey],
                    profileId,
                });
                markCommunityProvisionalMembers({
                    groupId,
                    relayUrl: relayHint,
                    memberPubkeys: [memberPubkey],
                    profileId,
                });
            }
            setCreatedGroups((prev) => {
                let changed = false;
                const next = prev.map((group) => {
                    const matchesGroup = group.groupId === groupId;
                    const matchesRelay = relayHint ? group.relayUrl === relayHint : true;
                    const matchesCommunity = communityHint ? group.communityId === communityHint : true;
                    if (!matchesGroup || !matchesRelay || !matchesCommunity) {
                        return group;
                    }
                    const evidenceGroup = sanitizeGroup({
                        ...group,
                        memberPubkeys: dedupePubkeys([
                            ...group.memberPubkeys,
                            memberPubkey,
                            ...(localPublicKey ? [localPublicKey] : []),
                        ]),
                    });
                    if (!shouldMaterializeRuntimeEvidence(localPublicKey, {
                        kind: "runtime_invite_accepted",
                        group: evidenceGroup,
                    }, profileId)) {
                        return group;
                    }
                    const nextMembers = dedupePubkeys([
                        ...group.memberPubkeys,
                        memberPubkey,
                        ...(localPublicKey ? [localPublicKey] : []),
                    ]);
                    if (nextMembers.join(",") === group.memberPubkeys.join(",")) {
                        return group;
                    }
                    changed = true;
                    return {
                        ...group,
                        memberPubkeys: nextMembers,
                        memberCount: Math.max(group.memberCount ?? 0, nextMembers.length),
                    };
                });
                // Always update roster projection for invite acceptance (even if member already exists)
                // This ensures the UI reflects the latest member state
                const matchedGroupForRoster = next.find((group) => {
                    const matchesGroup = group.groupId === groupId;
                    const matchesRelay = relayHint ? group.relayUrl === relayHint : true;
                    const matchesCommunity = communityHint ? group.communityId === communityHint : true;
                    return matchesGroup && matchesRelay && matchesCommunity;
                });
                if (matchedGroupForRoster) {
                    upsertCommunityRosterProjection({
                        group: matchedGroupForRoster,
                        activeMemberPubkeys: matchedGroupForRoster.memberPubkeys,
                    });
                }

                const pk = getPublicKeyHex();
                if (pk && (changed || matchedGroupForRoster)) {
                    chatStateStoreService.updateGroups(pk, next.map((group) => toPersistedGroupConversation(group)));
                }
                return next;
            });
        };
        const applyMembershipConfirmedDetail = (detail: {
            groupId?: string;
            relayUrl?: string;
            communityId?: string;
            displayName?: string;
            avatar?: string;
            access?: string;
            memberCount?: number;
            memberPubkeys?: ReadonlyArray<string>;
            adminPubkeys?: ReadonlyArray<string>;
            lastMessage?: string;
            lastMessageTimeUnixMs?: number;
            publicKeyHex?: string;
        }): void => {
            const groupId = detail?.groupId?.trim();
            const relayUrl = detail?.relayUrl?.trim();
            if (!groupId || !relayUrl) {
                return;
            }
            const localPk = getPublicKeyHex();
            const profileId = getResolvedProfileId();
            const eventPk = detail?.publicKeyHex?.trim();
            if (eventPk && localPk && eventPk !== localPk) {
                logAppEvent({ name: "groups.event_quarantined_identity_mismatch", level: "warn", scope: { feature: "groups", action: "membership_confirmed" }, context: { reason: "public_key_mismatch", eventPkSuffix: eventPk.slice(-8), localPkSuffix: localPk.slice(-8), groupId, relayUrl } });
                return;
            }
            const communityId = detail?.communityId?.trim();
            const nowUnixMs = Date.now();
            const lastMessageTimeUnixMs = Number.isFinite(detail?.lastMessageTimeUnixMs)
                && Number(detail?.lastMessageTimeUnixMs) > 0
                ? Number(detail?.lastMessageTimeUnixMs)
                : nowUnixMs;
            const displayName = detail?.displayName?.trim() || "Private Group";
            const memberPubkeys = dedupePubkeys(detail?.memberPubkeys ?? []);
            const adminPubkeys = dedupePubkeys(detail?.adminPubkeys ?? []);
            const access = detail?.access === "open" || detail?.access === "discoverable" || detail?.access === "invite-only"
                ? detail.access
                : "invite-only";
            const fallbackLastMessage = detail?.lastMessage?.trim() || "Group membership confirmed";
            const pk = localPk;
            const memberPubkeysWithIdentity = pk
                ? dedupePubkeys([...memberPubkeys, pk])
                : memberPubkeys;
            const candidateGroup = sanitizeGroup({
                kind: "group",
                id: toGroupConversationId({ groupId, relayUrl, communityId }),
                communityId,
                groupId,
                relayUrl,
                displayName,
                memberPubkeys: memberPubkeysWithIdentity,
                lastMessage: fallbackLastMessage,
                unreadCount: 0,
                lastMessageTime: new Date(lastMessageTimeUnixMs),
                access,
                memberCount: Math.max(
                    detail?.memberCount ?? 0,
                    memberPubkeysWithIdentity.length,
                    1,
                ),
                adminPubkeys,
                avatar: detail?.avatar?.trim() || undefined,
            });
            if (!shouldMaterializeRuntimeEvidence(pk, {
                kind: "runtime_membership_confirmed",
                group: candidateGroup,
                updatedAtUnixMs: lastMessageTimeUnixMs,
            }, profileId)) {
                return;
            }

            setCreatedGroups((prev) => {
                const existingIndex = prev.findIndex((group) => group.groupId === groupId && group.relayUrl === relayUrl);
                let next: ReadonlyArray<GroupConversation>;
                if (existingIndex === -1) {
                    next = dedupeGroups([...prev, candidateGroup]);
                } else {
                    const existing = prev[existingIndex];
                    if (!existing) {
                        return prev;
                    }
                    const mergedMemberPubkeys = dedupePubkeys([
                        ...(existing.memberPubkeys ?? []),
                        ...memberPubkeysWithIdentity,
                    ]);
                    const mergedAdminPubkeys = dedupePubkeys([
                        ...(existing.adminPubkeys ?? []),
                        ...adminPubkeys,
                    ]);
                    const mergedGroup = sanitizeGroup({
                        ...existing,
                        communityId: pickPreferredCommunityId(existing.communityId, candidateGroup.communityId),
                        displayName: (
                            existing.displayName?.trim().length ?? 0
                        ) > 0 && existing.displayName !== "Private Group"
                            ? existing.displayName
                            : candidateGroup.displayName,
                        memberPubkeys: mergedMemberPubkeys,
                        adminPubkeys: mergedAdminPubkeys,
                        memberCount: Math.max(
                            existing.memberCount ?? 0,
                            candidateGroup.memberCount ?? 0,
                            mergedMemberPubkeys.length,
                        ),
                        access: existing.access || candidateGroup.access,
                        avatar: existing.avatar || candidateGroup.avatar,
                        lastMessage: existing.lastMessage?.trim().length
                            ? existing.lastMessage
                            : candidateGroup.lastMessage,
                        lastMessageTime: existing.lastMessageTime || candidateGroup.lastMessageTime,
                    });
                    if (
                        existing.communityId === mergedGroup.communityId
                        && existing.displayName === mergedGroup.displayName
                        && existing.avatar === mergedGroup.avatar
                        && existing.access === mergedGroup.access
                        && existing.memberCount === mergedGroup.memberCount
                        && existing.lastMessage === mergedGroup.lastMessage
                        && existing.lastMessageTime?.getTime() === mergedGroup.lastMessageTime?.getTime()
                        && existing.memberPubkeys.join(",") === mergedGroup.memberPubkeys.join(",")
                        && existing.adminPubkeys.join(",") === mergedGroup.adminPubkeys.join(",")
                    ) {
                        return prev;
                    }
                    const mutableNext = [...prev];
                    mutableNext[existingIndex] = mergedGroup;
                    next = mutableNext;
                }

                if (pk) {
                    chatStateStoreService.updateGroups(pk, next.map((group) => toPersistedGroupConversation(group)));
                    const persistedMatch = next.find((group) => group.groupId === groupId && group.relayUrl === relayUrl);
                    if (persistedMatch) {
                        applyCoordinatorRuntimeMembershipEvidence(pk, {
                            kind: "runtime_membership_confirmed",
                            group: persistedMatch,
                            updatedAtUnixMs: lastMessageTimeUnixMs,
                        }, { profileId });
                    }
                }
                const projectionMatch = next.find((group) => group.groupId === groupId && group.relayUrl === relayUrl);
                if (projectionMatch) {
                    upsertCommunityRosterProjection({
                        group: projectionMatch,
                        activeMemberPubkeys: projectionMatch.memberPubkeys,
                    });
                }
                return next;
            });
        };
        const applyDescriptorUpdatedDetail = (detail: GroupDescriptorUpdatedDispatchDetail): void => {
            const groupId = detail.groupId?.trim();
            const relayUrl = detail.relayUrl?.trim();
            if (!groupId || !relayUrl) {
                return;
            }
            const pk = getPublicKeyHex();
            const profileId = getResolvedProfileId();
            const communityId = detail.communityId?.trim();
            const incomingName = pickPreferredCommunityDisplayName(
                detail.displayName,
                undefined,
                { groupId, communityId },
            );
            const access = detail.access === "open" || detail.access === "discoverable" || detail.access === "invite-only"
                ? detail.access
                : undefined;

            setCreatedGroups((prev) => {
                const existingIndex = prev.findIndex((group) => {
                    const matchesGroup = group.groupId === groupId;
                    const matchesRelay = group.relayUrl === relayUrl;
                    const matchesCommunity = communityId ? group.communityId === communityId : true;
                    return matchesGroup && matchesRelay && matchesCommunity;
                });
                if (existingIndex === -1) {
                    return prev;
                }
                const existing = prev[existingIndex];
                if (!existing) {
                    return prev;
                }
                const resolvedCommunityId = pickPreferredCommunityId(existing.communityId, communityId);
                const mergedDisplayName = pickPreferredCommunityDisplayName(
                    incomingName,
                    existing.displayName,
                    { groupId, communityId: resolvedCommunityId },
                );
                const mergedGroup = sanitizeGroup({
                    ...existing,
                    communityId: resolvedCommunityId,
                    displayName: mergedDisplayName,
                    about: detail.about?.trim() || existing.about,
                    avatar: detail.avatar?.trim() || existing.avatar,
                    access: access ?? existing.access,
                });
                if (
                    existing.communityId === mergedGroup.communityId
                    && existing.displayName === mergedGroup.displayName
                    && existing.about === mergedGroup.about
                    && existing.avatar === mergedGroup.avatar
                    && existing.access === mergedGroup.access
                ) {
                    return prev;
                }
                const mutableNext = [...prev];
                mutableNext[existingIndex] = mergedGroup;
                const next = mutableNext;
                if (pk) {
                    chatStateStoreService.updateGroups(pk, next.map((group) => toPersistedGroupConversation(group)));
                    const persistDescriptor = detail.governanceProposalId
                        ? persistCommunityGovernanceDescriptorAccepted
                        : persistCommunityDescriptorUpdate;
                    persistDescriptor({
                        publicKeyHex: pk,
                        group: mergedGroup,
                        displayName: mergedDisplayName,
                        about: mergedGroup.about,
                        avatar: mergedGroup.avatar,
                        access: mergedGroup.access,
                        lastEvidenceEventId: detail.lastEvidenceEventId,
                        profileId,
                    });
                }
                return next;
            });
        };
        const applyMembershipSnapshotDetail = (detail: GroupMembershipSnapshotDispatchDetail) => {
            const groupId = detail.groupId?.trim();
            const relayUrl = detail.relayUrl?.trim();
            if (!groupId || !relayUrl) {
                return;
            }
            if (typeof detail.disbandedAt === "number" && detail.disbandedAt > 0) {
                const existing = createdGroupsRef.current.find((group) => group.groupId === groupId && group.relayUrl === relayUrl);
                if (existing) {
                    const pk = getPublicKeyHex();
                    if (pk) {
                        const profileId = getResolvedProfileId();
                        applyCoordinatorDisbandEvidence({
                            pk,
                            group: existing,
                            disbandedAtUnixMs: detail.disbandedAt,
                            profileId,
                        });
                        addGroupTombstone(pk, { groupId: existing.groupId, relayUrl: existing.relayUrl }, { profileId });
                        setCreatedGroups((prev) => {
                            const next = prev.filter((group) => group.id !== existing.id);
                            chatStateStoreService.updateGroups(pk, next.map((group) => toPersistedGroupConversation(group)));
                            return next;
                        });
                    }
                }
                return;
            }
            const activeMemberPubkeys = dedupePubkeys(detail.activeMemberPubkeys);
            const leftMemberPubkeys = dedupePubkeys(detail.leftMembers);
            const expelledMemberPubkeys = dedupePubkeys(detail.expelledMembers);
            const activeSet = new Set(
                activeMemberPubkeys.map((pubkey) => pubkey.trim().toLowerCase()).filter((pubkey) => pubkey.length > 0),
            );
            const persistLeft = leftMemberPubkeys.filter(
                (pubkey) => !activeSet.has(pubkey.trim().toLowerCase()),
            );
            const persistExpelled = expelledMemberPubkeys.filter(
                (pubkey) => !activeSet.has(pubkey.trim().toLowerCase()),
            );
            const evidenceForTerminalPersist = relayEvidenceByGroupIdRef.current[groupId] ?? {
                subscriptionEstablishedAt: null,
                lastEventReceivedAt: null,
                eoseReceivedAt: null,
                eventCount: 0,
            };
            const terminalPersistConfidence = resolveRelayEvidenceConfidence({
                ...evidenceForTerminalPersist,
                nowMs: Date.now(),
            });
            if (canApplyRelayInferredMemberRemoval(terminalPersistConfidence)) {
                saveCommunityTerminalMembershipCache({
                    groupId,
                    relayUrl,
                    leftMemberPubkeys: persistLeft as ReadonlyArray<PublicKeyHex>,
                    expelledMemberPubkeys: persistExpelled as ReadonlyArray<PublicKeyHex>,
                    disbandedAtUnixMs: detail.disbandedAt,
                    profileId: getResolvedProfileId(),
                });
            }
            if (activeMemberPubkeys.length > 0) {
                stripProvisionalCommunityMembersConfirmedOnRelay({
                    groupId,
                    relayUrl,
                    relayBackedMemberPubkeys: activeMemberPubkeys,
                    profileId: getResolvedProfileId(),
                });
            }

            // Relay-evidence-backed rejoin recovery:
            // If the local user appears in activeMemberPubkeys (NOT in leftMembers/expelledMembers)
            // but their local ledger entry is terminal ("left"/"expelled"), and relay confidence
            // has reached steady_state, the terminal entry was written spuriously (e.g. during a
            // low-confidence reconnect phase). Recover by firing an explicit rejoin.
            const pk = getPublicKeyHex();
            if (pk) {
                const profileId = getResolvedProfileId();
                const localIsActiveInSnapshot = activeMemberPubkeys.map((p) => p.trim()).includes(pk);
                const localIsInTerminalList = leftMemberPubkeys.map((p) => p.trim()).includes(pk)
                    || expelledMemberPubkeys.map((p) => p.trim()).includes(pk);
                if (localIsActiveInSnapshot && !localIsInTerminalList) {
                    const currentLedger = loadCommunityMembershipLedger(pk, { profileId });
                    const targetKey = toCommunityMembershipLedgerKey({ groupId, relayUrl });
                    const terminalEntry = targetKey
                        ? currentLedger.find((e) => (
                            toCommunityMembershipLedgerKey(e) === targetKey
                            && (e.status === "left" || e.status === "expelled")
                        ))
                        : undefined;
                    if (terminalEntry) {
                        // Only recover at steady_state — partial/warm-up evidence is not
                        // authoritative enough to override an explicit terminal entry.
                        const evidenceForConfidence = relayEvidenceByGroupIdRef.current[groupId] ?? {
                            subscriptionEstablishedAt: null,
                            lastEventReceivedAt: null,
                            eoseReceivedAt: null,
                            eventCount: 0,
                        };
                        const nowMsForConfidence = Date.now();
                        const recoveryConfidence = resolveRelayEvidenceConfidence({ ...evidenceForConfidence, nowMs: nowMsForConfidence });
                        if (recoveryConfidence === "steady_state") {
                            // Prefer the live group from createdGroupsRef; fall back to
                            // reconstructing from the terminal ledger entry itself. The
                            // fallback is needed when the terminal status prevented hydration
                            // entirely (the common case for a spuriously-left user).
                            const matchingGroupForRevive = createdGroupsRef.current.find((g) =>
                                g.groupId === groupId && g.relayUrl === relayUrl
                            ) ?? toGroupConversationFromMembershipLedgerEntry(terminalEntry, {
                                fallbackMemberPubkeys: activeMemberPubkeys,
                            });
                            logAppEvent({
                                name: "groups.membership_snapshot_relay_rejoin_recovery",
                                level: "info",
                                scope: { feature: "groups", action: "membership_snapshot" },
                                context: {
                                    publicKeySuffix: pk.slice(-8),
                                    groupId,
                                    relayUrl: relayUrl ?? null,
                                    previousStatus: terminalEntry.status,
                                    confidence: recoveryConfidence,
                                    fromLedgerFallback: !createdGroupsRef.current.find((g) =>
                                        g.groupId === groupId && g.relayUrl === relayUrl
                                    ),
                                },
                            });
                            addGroup(matchingGroupForRevive, { allowRevive: true });
                        }
                    }
                }
            }

            // Update relay evidence tracking
            const nowMs = Date.now();
            const existingEvidence = relayEvidenceByGroupIdRef.current[groupId];
            relayEvidenceByGroupIdRef.current = {
                ...relayEvidenceByGroupIdRef.current,
                [groupId]: {
                    subscriptionEstablishedAt: existingEvidence?.subscriptionEstablishedAt ?? nowMs,
                    lastEventReceivedAt: nowMs,
                    eoseReceivedAt: existingEvidence?.eoseReceivedAt ?? null,
                    eventCount: (existingEvidence?.eventCount ?? 0) + 1,
                },
            };

            setCommunityRosterByConversationId((prev) => {
                const matchingGroup = createdGroupsRef.current.find((group) => {
                    const matchesGroup = group.groupId === groupId;
                    const matchesRelay = group.relayUrl === relayUrl;
                    const matchesCommunity = detail.communityId ? group.communityId === detail.communityId : true;
                    return matchesGroup && matchesRelay && matchesCommunity;
                });
                if (!matchingGroup) {
                    return prev;
                }
                const currentProjection = prev[matchingGroup.id] ?? buildCommunityRosterProjection(matchingGroup);
                // Get relay evidence for this group
                const relayEvidence = relayEvidenceByGroupIdRef.current[groupId] ?? {
                    subscriptionEstablishedAt: null,
                    lastEventReceivedAt: null,
                    eoseReceivedAt: null,
                    eventCount: 0,
                };
                const nowMs = Date.now();
                const confidence = resolveRelayEvidenceConfidence({ ...relayEvidence, nowMs });

                // Protect the same OR-set as UI seeds: directory ∪ persisted `group.memberPubkeys`
                // (`mergeKnownParticipantSeedPubkeys` — single contract with group-home / management UIs).
                const knownDirectory = communityKnownParticipantDirectoryByConversationIdRef.current[matchingGroup.id];
                const protectRemovalPubkeys = mergeKnownParticipantSeedPubkeys({
                    directory: knownDirectory ?? null,
                    persistedGroupMemberPubkeys: matchingGroup.memberPubkeys,
                });
                const enhancedResult = resolveEnhancedSnapshotApplication({
                    currentMemberPubkeys: currentProjection.activeMemberPubkeys,
                    incomingActiveMemberPubkeys: activeMemberPubkeys,
                    leftMemberPubkeys,
                    expelledMemberPubkeys,
                    protectRemovalPubkeys,
                    relayEvidenceParams: { ...relayEvidence, nowMs },
                    sourceHint: "relay_snapshot",
                });
                const snapshotApplication = enhancedResult.application;
                if (snapshotApplication.reasonCode !== "equivalent" || enhancedResult.guardRelaxed) {
                    logAppEvent({
                        name: "groups.membership_snapshot_projection_result",
                        level: snapshotApplication.reasonCode === "missing_removal_evidence" ? "warn" : "info",
                        scope: { feature: "groups", action: "membership_snapshot" },
                        context: {
                            publicKeySuffix: (getPublicKeyHex() ?? "").slice(-8) || null,
                            groupId,
                            relayUrl,
                            communityId: detail.communityId ?? null,
                            conversationId: matchingGroup.id,
                            reasonCode: snapshotApplication.reasonCode,
                            confidence,
                            guardRelaxed: enhancedResult.guardRelaxed,
                            policyReasonCode: enhancedResult.reasonCode,
                            currentMemberCount: currentProjection.activeMemberPubkeys.length,
                            incomingMemberCount: activeMemberPubkeys.length,
                            nextMemberCount: snapshotApplication.nextMemberPubkeys.length,
                            leftMemberCount: leftMemberPubkeys.length,
                            expelledMemberCount: expelledMemberPubkeys.length,
                            removedWithoutEvidenceCount: snapshotApplication.removedWithoutEvidence.length,
                        },
                    });
                }
                if (!snapshotApplication.shouldApply) {
                    return prev;
                }

                // Three-tier architecture: relay snapshots are NEVER authoritative for the
                // local user's own membership status. Only explicit signed actions (user
                // leave, admin expel via NIP events) can write terminal entries to the
                // ledger. Relay evidence is kept in memory only (roster projections) and
                // never persisted as membership truth for the local user.
                const pk = getPublicKeyHex();
                if (pk) {
                    const profileId = getResolvedProfileId();
                    // Only apply terminal evidence for NON-local members. For the local
                    // user, we rely entirely on explicit signed events, not relay snapshots.
                    const localUserInLeft = leftMemberPubkeys.map((p) => p.trim()).includes(pk);
                    const localUserInExpelled = expelledMemberPubkeys.map((p) => p.trim()).includes(pk);
                    const localUserInTerminal = localUserInLeft || localUserInExpelled;

                    if (!localUserInTerminal) {
                        // Safe to apply for other members — relay evidence is acceptable
                        applyCoordinatorRosterSnapshotTerminalEvidence({
                            pk,
                            group: matchingGroup,
                            leftMemberPubkeys,
                            expelledMemberPubkeys,
                            updatedAtUnixMs: nowMs,
                            profileId,
                        });
                    } else {
                        // Local user appears in terminal lists per relay, but we do NOT
                        // write this to the ledger. The ledger only contains signed intent.
                        // If the user is truly expelled, an admin-signed event will arrive
                        // via the normal event flow and write the terminal entry then.
                        logAppEvent({
                            name: "groups.membership_snapshot_local_terminal_ignored",
                            level: "info",
                            scope: { feature: "groups", action: "membership_snapshot" },
                            context: {
                                publicKeySuffix: pk.slice(-8),
                                groupId,
                                relayUrl,
                                localInLeft: localUserInLeft,
                                localInExpelled: localUserInExpelled,
                                reason: "relay_not_authoritative_for_local_user",
                            },
                        });
                    }
                }

                const nextMembers = getResolvedClientGateway().communityRoster.resolveSnapshotNextMembers({
                    currentMemberPubkeys: currentProjection.activeMemberPubkeys,
                    snapshotNextMemberPubkeys: snapshotApplication.nextMemberPubkeys as ReadonlyArray<PublicKeyHex>,
                    leftMemberPubkeys: leftMemberPubkeys as ReadonlyArray<PublicKeyHex>,
                    expelledMemberPubkeys: expelledMemberPubkeys as ReadonlyArray<PublicKeyHex>,
                    protectRemovalPubkeys,
                    guardRelaxed: enhancedResult.guardRelaxed,
                });

                // Prevent infinite loop: skip update if projection is unchanged.
                const currentKey = currentProjection.activeMemberPubkeys.join(",");
                const nextKey = nextMembers.join(",");
                if (currentKey === nextKey) {
                    return prev;
                }

                return {
                    ...prev,
                    [matchingGroup.id]: {
                        ...currentProjection,
                        conversationId: matchingGroup.id,
                        groupId: matchingGroup.groupId,
                        relayUrl: matchingGroup.relayUrl,
                        communityId: matchingGroup.communityId,
                        activeMemberPubkeys: nextMembers,
                        memberCount: Math.max(nextMembers.length, 1),
                    },
                };
            });
        };
        const applyKnownParticipantsObservedDetail = (detail: CommunityKnownParticipantsObservedDispatchDetail) => {
            const groupId = detail.groupId?.trim();
            const relayUrl = detail.relayUrl?.trim();
            const conversationId = detail.conversationId?.trim();
            if (!groupId || !relayUrl || !conversationId) {
                return;
            }
            const participantPubkeys = dedupePubkeys(detail.participantPubkeys);
            if (participantPubkeys.length === 0) {
                return;
            }
            const matchingGroup = createdGroupsRef.current.find((group) => {
                const matchesConversation = group.id === conversationId;
                const matchesGroup = group.groupId === groupId;
                const matchesRelay = group.relayUrl === relayUrl;
                const matchesCommunity = detail.communityId ? group.communityId === detail.communityId : true;
                return matchesConversation && matchesGroup && matchesRelay && matchesCommunity;
            });
            if (!matchingGroup) {
                return;
            }
            const pk = getPublicKeyHex();
            if (pk) {
                const profileId = getResolvedProfileId();
                getResolvedClientGateway().communityRoster.persistObservedKnownParticipants({
                    publicKeyHex: pk as PublicKeyHex,
                    profileId,
                    entry: {
                        conversationId: matchingGroup.id,
                        groupId: matchingGroup.groupId,
                        relayUrl: matchingGroup.relayUrl,
                        communityId: matchingGroup.communityId,
                        participantPubkeys: participantPubkeys as ReadonlyArray<PublicKeyHex>,
                        updatedAtUnixMs: Date.now(),
                    },
                });
            }
            setCommunityKnownParticipantDirectoryByConversationId((previous) => {
                const current = previous[matchingGroup.id];
                const nextParticipantPubkeys = dedupePubkeys([
                    ...(current?.participantPubkeys ?? []),
                    ...participantPubkeys,
                ]) as ReadonlyArray<PublicKeyHex>;
                if (
                    current
                    && current.participantPubkeys.join(",") === nextParticipantPubkeys.join(",")
                ) {
                    return previous;
                }
                return {
                    ...previous,
                    [matchingGroup.id]: {
                        conversationId: matchingGroup.id,
                        groupId: matchingGroup.groupId,
                        relayUrl: matchingGroup.relayUrl,
                        communityId: matchingGroup.communityId,
                        participantPubkeys: nextParticipantPubkeys,
                        participantCount: Math.max(nextParticipantPubkeys.length, 1),
                    },
                };
            });
        };

        const handleMembershipIngressDetail = (detail: CommunityMembershipIngressDetail) => {
            const profileId = getResolvedProfileId();
            if (detail.profileId !== profileId) {
                return;
            }
            const pk = getPublicKeyHex();
            applyCommunityMembershipIngress({
                detail,
                localPublicKeyHex: pk,
                resolveGroup: (communityId) => createdGroupsRef.current.find((group) => (
                    group.communityId === communityId
                )),
                widenRoster: ({ group, memberPubkeys }) => {
                    const mergedMemberPubkeys = dedupePubkeys([
                        ...group.memberPubkeys,
                        ...memberPubkeys,
                        ...(pk ? [pk] : []),
                    ]);
                    setCreatedGroups((prev) => {
                        const next = prev.map((entry) => (
                            entry.id === group.id
                                ? {
                                    ...entry,
                                    memberPubkeys: mergedMemberPubkeys,
                                    memberCount: Math.max(entry.memberCount ?? 0, mergedMemberPubkeys.length),
                                }
                                : entry
                        ));
                        if (pk) {
                            chatStateStoreService.updateGroups(pk, next.map((entry) => toPersistedGroupConversation(entry)));
                        }
                        const updated = next.find((entry) => entry.id === group.id) ?? group;
                        upsertCommunityRosterProjection({
                            group: updated,
                            activeMemberPubkeys: mergedMemberPubkeys,
                        });
                        return next;
                    });
                },
                applyLocalJoinFromRelay: (group) => {
                    if (!pk) {
                        return;
                    }
                    applyCoordinatorRuntimeMembershipEvidence(pk, {
                        kind: "relay_gossip_ingress",
                        group,
                        updatedAtUnixMs: detail.receivedAtUnixMs,
                        lastEvidenceEventId: detail.eventId,
                    }, { profileId });
                },
                applyLocalLeaveFromRelay: (group) => {
                    if (!pk) {
                        return;
                    }
                    applyCoordinatorExplicitLeave(pk, group, { profileId });
                },
            });
        };

        const unsubInviteReceivedDual = subscribeGroupInviteReceivedDual((invite) => {
            addGroup(invite as GroupConversation, { provisionalJoin: true });
        }, optionalProfileBus);
        const unsubMembershipIngress = subscribeCommunityMembershipIngress(
            handleMembershipIngressDetail,
            optionalProfileBus,
        );
        const unsubInviteDual = subscribeGroupInviteAcceptedDual(handleInviteAcceptedDetail, optionalProfileBus);
        const unsubMembershipConfirmedDual = subscribeGroupMembershipConfirmedDual(applyMembershipConfirmedDetail, optionalProfileBus);
        const unsubDescriptorUpdatedDual = subscribeGroupDescriptorUpdatedDual(applyDescriptorUpdatedDetail, optionalProfileBus);
        const unsubRemoveDual = subscribeGroupRemoveDual(handleGroupRemoveConversationId, optionalProfileBus);

        const unsubMembershipSnapshotDual = subscribeGroupMembershipSnapshotDual(
            applyMembershipSnapshotDetail,
            optionalProfileBus,
        );
        const unsubKnownParticipantsDual = subscribeCommunityKnownParticipantsObservedDual(
            applyKnownParticipantsObservedDetail,
            optionalProfileBus,
        );

        return () => {
            unsubInviteReceivedDual();
            unsubInviteDual();
            unsubMembershipConfirmedDual();
            unsubDescriptorUpdatedDual();
            unsubRemoveDual();
            unsubMembershipSnapshotDual();
            unsubKnownParticipantsDual();
            unsubMembershipIngress();
        };
    }, [addGroup, applyCoordinatorDisbandEvidence, applyCoordinatorExplicitLeave, applyCoordinatorRosterSnapshotTerminalEvidence, applyCoordinatorRuntimeMembershipEvidence, getPublicKeyHex, optionalProfileBus, removeGroupConversation, upsertCommunityRosterProjection]);

    const value = useMemo(() => ({
        createdGroups,
        communityRosterByConversationId,
        communityKnownParticipantDirectoryByConversationId,
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
    }), [createdGroups, communityKnownParticipantDirectoryByConversationId, communityRosterByConversationId, isNewGroupOpen, isCreatingGroup, isGroupInfoOpen, newGroupName, newGroupMemberPubkeys, addGroup, updateGroup, leaveGroup, removeGroupConversation, forcePurgeCommunity, recordMembershipLedgerAfterInviteDecline]);

    return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
};

export const useGroups = () => {
    const context = useContext(GroupContext);
    if (!context) {
        throw new Error("useGroups must be used within a GroupProvider");
    }
    return context;
};

export const useGroupsSafe = (): GroupContextType | null => useContext(GroupContext);
