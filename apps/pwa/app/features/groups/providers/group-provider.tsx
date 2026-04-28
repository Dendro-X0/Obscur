"use client";

import React, { createContext, useContext, useState, useMemo, useEffect, useRef, useCallback } from "react";
import type { GroupConversation } from "@/app/features/messaging/types";
import { CHAT_STATE_REPLACED_EVENT, chatStateStoreService } from "@/app/features/messaging/services/chat-state-store";
import { fromPersistedGroupConversation, toPersistedGroupConversation } from "@/app/features/messaging/utils/persistence";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { toGroupConversationId } from "@/app/features/groups/utils/group-conversation-id";
import { deriveCommunityId, pickPreferredCommunityId } from "@/app/features/groups/utils/community-identity";
import { getActiveProfileIdSafe } from "@/app/features/profiles/services/profile-scope";
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
import { logRuntimeEvent } from "@/app/shared/runtime-log-classification";
import {
    COMMUNITY_MEMBERSHIP_LEDGER_UPDATED_EVENT,
    loadCommunityMembershipLedger,
    setCommunityMembershipStatus,
    toCommunityMembershipLedgerEntryFromGroup,
    upsertCommunityMembershipLedgerEntry
} from "@/app/features/groups/services/community-membership-ledger";
import { resolveCommunityMembershipRecovery } from "@/app/features/groups/services/community-membership-recovery";
import {
    COMMUNITY_KNOWN_PARTICIPANTS_OBSERVED_EVENT,
    GROUP_MEMBERSHIP_SNAPSHOT_EVENT,
} from "@/app/features/groups/hooks/use-sealed-community";
import { logAppEvent } from "@/app/shared/log-app-event";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import {
    buildCommunityRosterProjection,
    type CommunityRosterProjection,
} from "@/app/features/groups/services/community-member-roster-projection";
import {
    resolveEnhancedSnapshotApplication,
    type EnhancedSnapshotApplicationResult,
} from "@/app/features/groups/services/community-member-snapshot-policy";
import {
    resolveRelayEvidenceConfidence,
    type RelayEvidenceConfidence,
} from "@/app/features/groups/services/community-relay-evidence-policy";
import {
    buildCommunityKnownParticipantDirectoryByConversationId,
    type CommunityKnownParticipantDirectory,
} from "@/app/features/groups/services/community-known-participant-directory";
import {
    loadCommunityKnownParticipantsEntries,
    upsertCommunityKnownParticipantsEntry,
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
    addGroup: (group: GroupConversation, options?: Readonly<{ allowRevive?: boolean }>) => void;
    updateGroup: (params: Readonly<{ groupId: string; relayUrl?: string; conversationId?: string; updates: Partial<GroupConversation> }>) => void;
    leaveGroup: (params: Readonly<{ groupId: string; relayUrl?: string; conversationId?: string }>) => void;
    removeGroupConversation: (conversationId: string) => void;
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
    const groupedPeers = new Map<string, Set<string>>();
    const createdConnections = params.chatState?.createdConnections ?? [];
    const peerByConversationId = new Map<string, string>();
    createdConnections.forEach((connection) => {
        const normalizedPeer = normalizePublicKeyHex(connection.pubkey);
        if (normalizedPeer) {
            peerByConversationId.set(connection.id, normalizedPeer);
        }
    });

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
            if (parsed.type === "community-invite-response" && parsed.status !== "accepted") {
                return;
            }
            const groupId = typeof parsed.groupId === "string" ? parsed.groupId.trim() : "";
            const relayUrl = typeof parsed.relayUrl === "string" ? parsed.relayUrl.trim() : "";
            if (!groupId || !relayUrl) {
                return;
            }
            const groupKey = toGroupTombstoneKey({ groupId, relayUrl });
            const current = groupedPeers.get(groupKey) ?? new Set<string>();
            current.add(peerPublicKeyHex);
            groupedPeers.set(groupKey, current);
        });
    });

    return Object.fromEntries(
        Array.from(groupedPeers.entries()).map(([groupKey, peerSet]) => ([groupKey, Array.from(peerSet)])),
    );
};

export const GroupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const identity = useIdentity();
    const [createdGroups, setCreatedGroups] = useState<ReadonlyArray<GroupConversation>>([]);
    const [communityRosterByConversationId, setCommunityRosterByConversationId] = useState<Readonly<Record<string, CommunityRosterProjection>>>({});
    const relayEvidenceByGroupIdRef = useRef<Readonly<Record<string, {
        subscriptionEstablishedAt: number | null;
        lastEventReceivedAt: number | null;
        eoseReceivedAt: number | null;
        eventCount: number;
    }>>>({});
    const [communityKnownParticipantDirectoryByConversationId, setCommunityKnownParticipantDirectoryByConversationId] = useState<Readonly<Record<string, CommunityKnownParticipantDirectory>>>({});
    const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [newGroupMemberPubkeys, setNewGroupMemberPubkeys] = useState("");
    const lastHydratedPublicKeyRef = useRef<string | null>(null);
    const createdGroupsRef = useRef<ReadonlyArray<GroupConversation>>([]);
    const dedupePubkeys = (values: ReadonlyArray<string>): ReadonlyArray<string> => (
        Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)))
    );
    const PLACEHOLDER_GROUP_DISPLAY_NAME = "Private Group";
    const hasMeaningfulDisplayName = (value: string | undefined): boolean => {
        const trimmed = value?.trim() ?? "";
        return trimmed.length > 0 && trimmed !== PLACEHOLDER_GROUP_DISPLAY_NAME;
    };
    const pickPreferredDisplayName = (
        current: string | undefined,
        incoming: string | undefined,
    ): string => {
        if (hasMeaningfulDisplayName(current)) {
            return current!.trim();
        }
        if (hasMeaningfulDisplayName(incoming)) {
            return incoming!.trim();
        }
        const currentTrimmed = current?.trim() ?? "";
        const incomingTrimmed = incoming?.trim() ?? "";
        return currentTrimmed || incomingTrimmed || PLACEHOLDER_GROUP_DISPLAY_NAME;
    };
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
            displayName: pickPreferredDisplayName(primary.displayName, secondary.displayName),
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
            const next = buildCommunityKnownParticipantDirectoryByConversationId({
                groups: createdGroups,
                rosterProjectionByConversationId: communityRosterByConversationId,
                storedEntries: loadCommunityKnownParticipantsEntries(pk as PublicKeyHex),
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
        Object.values(communityKnownParticipantDirectoryByConversationId).forEach((directory) => {
            upsertCommunityKnownParticipantsEntry({
                publicKeyHex: pk as PublicKeyHex,
                entry: {
                    conversationId: directory.conversationId,
                    groupId: directory.groupId,
                    relayUrl: directory.relayUrl,
                    communityId: directory.communityId,
                    participantPubkeys: directory.participantPubkeys,
                    updatedAtUnixMs: Date.now(),
                },
            });
        });
    }, [communityKnownParticipantDirectoryByConversationId, getPublicKeyHex]);

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

            // Log for debugging when merge changes the count
            if (groupMembers.length !== mergedMembers.length) {
                console.log("[MemberFix] Roster merged (upsert):", {
                    conversationId: params.group.id.slice(0, 8),
                    groupMembers: groupMembers.length,
                    knownParticipants: knownParticipants.length,
                    currentMembers: currentMembers.length,
                    merged: mergedMembers.length,
                });
            }

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

    const hydrateGroupsForPublicKey = useCallback((pk: string) => {
        const profileId = getActiveProfileIdSafe();
        const persisted = chatStateStoreService.load(pk);
        const tombstones = loadGroupTombstones(pk);
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
        const recovery = resolveCommunityMembershipRecovery({
            publicKeyHex: pk,
            persistedGroups,
            membershipLedger: loadCommunityMembershipLedger(pk),
            tombstones,
            inviteMemberPubkeysByGroupKey,
            groupMessageAuthorsByConversationId: Object.fromEntries(
                Object.entries(persisted?.groupMessages ?? {}).map(([conversationId, messages]) => ([
                    conversationId,
                    Array.from(new Set(
                        messages
                            .map((message) => message.pubkey?.trim() ?? "")
                            .filter((pubkey) => pubkey.length > 0)
                    )),
                ]))
            ),
        });
        const groups = dedupeGroups(recovery.groups.map((group) => {
            const messageAuthorPubkeys = Array.from(new Set(
                (persisted?.groupMessages?.[group.id] ?? [])
                    .map((message) => message.pubkey?.trim() ?? "")
                    .filter((pubkey) => pubkey.length > 0)
            ));
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
                persistedGroupCount: recovery.diagnostics.persistedGroupCount,
                persistedDuplicateMergeCount: recovery.diagnostics.persistedDuplicateMergeCount,
                ledgerEntryCount: recovery.diagnostics.ledgerEntryCount,
                visibleGroupCount: recovery.diagnostics.visibleGroupCount,
                hydratedFromPersistedWithLedgerCount: recovery.diagnostics.hydratedFromPersistedWithLedgerCount,
                hydratedFromPersistedFallbackCount: recovery.diagnostics.hydratedFromPersistedFallbackCount,
                hydratedFromLedgerOnlyCount: recovery.diagnostics.hydratedFromLedgerOnlyCount,
                descriptorProjectionCount: recovery.descriptorProjections.length,
                membershipProjectionCount: recovery.membershipProjections.length,
                projectionVisibleCount: recovery.descriptorProjections.filter((entry) => entry.visibilityState === "visible").length,
                projectionJoinedCount: recovery.membershipProjections.filter((entry) => entry.status === "joined").length,
                projectionPersistedFallbackCount: recovery.membershipProjections.filter((entry) => entry.sourceOfTruth === "persisted_fallback").length,
                projectionLedgerCount: recovery.membershipProjections.filter((entry) => entry.sourceOfTruth === "ledger").length,
                placeholderDisplayNameRecoveredCount: recovery.diagnostics.placeholderDisplayNameRecoveredCount,
                localMemberBackfillCount: recovery.diagnostics.localMemberBackfillCount,
                hiddenByTombstoneCount: recovery.diagnostics.hiddenByTombstoneCount,
                hiddenByLedgerStatusCount: recovery.diagnostics.hiddenByLedgerStatusCount,
                missingLedgerCoverageCount: recovery.diagnostics.missingLedgerCoverageCount,
                missingLedgerCoverageBackfillCount: recovery.missingLedgerCoverageEntries.length,
                tombstoneCount: tombstones.size,
            },
        });
        // Self-heal legacy/non-canonical persisted group entries.
        chatStateStoreService.updateGroups(pk, groups.map(g => toPersistedGroupConversation(g)));
        groups.forEach((group) => {
            upsertCommunityKnownParticipantsEntry({
                publicKeyHex: pk as PublicKeyHex,
                entry: {
                    conversationId: group.id,
                    groupId: group.groupId,
                    relayUrl: group.relayUrl,
                    communityId: group.communityId,
                    participantPubkeys: dedupePubkeys([
                        ...(group.memberPubkeys ?? []),
                        ...(inviteMemberPubkeysByGroupKey[toGroupTombstoneKey({ groupId: group.groupId, relayUrl: group.relayUrl })] ?? []),
                        pk,
                    ]) as ReadonlyArray<PublicKeyHex>,
                    updatedAtUnixMs: Date.now(),
                },
            });
        });
        recovery.missingLedgerCoverageEntries.forEach((entry) => {
            upsertCommunityMembershipLedgerEntry(pk, entry);
        });
    }, [getPublicKeyHex]);

    useEffect(() => {
        const pk = getPublicKeyHex();
        if (!pk) {
            lastHydratedPublicKeyRef.current = null;
            setCreatedGroups([]);
            setCommunityRosterByConversationId({});
            return;
        }
        if (lastHydratedPublicKeyRef.current === pk) {
            return;
        }
        logAppEvent({
            name: "groups.membership_recovery_primary_hydrate_triggered",
            level: "info",
            scope: { feature: "groups", action: "membership_recovery" },
            context: {
                publicKeySuffix: toPublicKeySuffix(pk),
                profileId: getActiveProfileIdSafe(),
                trigger: "identity_public_key_changed",
            },
        });
        hydrateGroupsForPublicKey(pk);
        lastHydratedPublicKeyRef.current = pk;
    }, [getPublicKeyHex, hydrateGroupsForPublicKey]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const onScopedRefresh = (event: Event): void => {
            const pk = getPublicKeyHex();
            if (!pk) return;
            const detail = (event as CustomEvent<{ publicKeyHex?: string; profileId?: string }>).detail;
        if (detail?.publicKeyHex && detail.publicKeyHex !== pk) {
            return;
        }
        if (detail?.profileId && detail.profileId !== getActiveProfileIdSafe()) {
            return;
        }
        logAppEvent({
            name: "groups.membership_recovery_refresh_triggered",
            level: "info",
                scope: { feature: "groups", action: "membership_recovery" },
                context: {
                    publicKeySuffix: toPublicKeySuffix(pk),
                    profileId: getActiveProfileIdSafe(),
                    triggerEvent: event.type,
                    scopedPublicKeyMatch: detail?.publicKeyHex ? 1 : 0,
                },
            });
            hydrateGroupsForPublicKey(pk);
            lastHydratedPublicKeyRef.current = pk;
        };
        window.addEventListener(CHAT_STATE_REPLACED_EVENT, onScopedRefresh);
        window.addEventListener(COMMUNITY_MEMBERSHIP_LEDGER_UPDATED_EVENT, onScopedRefresh);
        return () => {
            window.removeEventListener(CHAT_STATE_REPLACED_EVENT, onScopedRefresh);
            window.removeEventListener(COMMUNITY_MEMBERSHIP_LEDGER_UPDATED_EVENT, onScopedRefresh);
        };
    }, [getPublicKeyHex, hydrateGroupsForPublicKey]);

    const addGroup = useCallback((group: GroupConversation, options?: Readonly<{ allowRevive?: boolean }>) => {
        setCreatedGroups(prev => {
            const normalized = sanitizeGroup(group);
            const pk = getPublicKeyHex();
            if (pk) {
                const tombstoned = isGroupTombstoned(pk, { groupId: normalized.groupId, relayUrl: normalized.relayUrl });
                if (tombstoned && !options?.allowRevive) {
                    return prev;
                }
                if (options?.allowRevive) {
                    removeGroupTombstone(pk, { groupId: normalized.groupId, relayUrl: normalized.relayUrl });
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
                if (pk) {
                    chatStateStoreService.updateGroups(pk, next.map(g => toPersistedGroupConversation(g)));
                    upsertCommunityMembershipLedgerEntry(pk, toCommunityMembershipLedgerEntryFromGroup(merged, {
                        status: "joined",
                    }));
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
            if (pk) {
                chatStateStoreService.updateGroups(pk, next.map(g => toPersistedGroupConversation(g)));
                upsertCommunityMembershipLedgerEntry(pk, toCommunityMembershipLedgerEntryFromGroup(normalized, {
                    status: "joined",
                }));
            }
            setCommunityRosterByConversationId((previous) => ({
                ...previous,
                [normalized.id]: buildCommunityRosterProjection(normalized),
            }));
            return next;
        });
    }, [getPublicKeyHex]);

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
                upsertCommunityMembershipLedgerEntry(pk, toCommunityMembershipLedgerEntryFromGroup(next[index], {
                    status: "joined",
                }));
            }
            return next;
        });
    }, [getPublicKeyHex]);

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
                removedGroups.forEach((group) => {
                    setCommunityMembershipStatus(pk, {
                        groupId: group.groupId,
                        relayUrl: group.relayUrl,
                        communityId: group.communityId,
                        status: "left",
                        displayName: group.displayName,
                        avatar: group.avatar,
                    });
                });
                if (params.conversationId && matched) {
                    addGroupTombstone(pk, { groupId: matched.groupId, relayUrl: matched.relayUrl });
                } else if (params.relayUrl) {
                    addGroupTombstone(pk, { groupId: params.groupId, relayUrl: params.relayUrl });
                } else if (params.conversationId) {
                    addGroupTombstoneFromConversationId(pk, params.conversationId); // legacy fallback
                }
                chatStateStoreService.updateGroups(pk, next.map(g => toPersistedGroupConversation(g)));
            }
            return next;
        });
    }, [getPublicKeyHex]);

    const removeGroupConversation = useCallback((conversationId: string) => {
        setCreatedGroups(prev => {
            const matched = prev.find((g) => g.id === conversationId);
            const next = prev.filter(g => g.id !== conversationId);
            const pk = getPublicKeyHex();
            if (pk) {
                if (matched) {
                    addGroupTombstone(pk, { groupId: matched.groupId, relayUrl: matched.relayUrl });
                    setCommunityMembershipStatus(pk, {
                        groupId: matched.groupId,
                        relayUrl: matched.relayUrl,
                        communityId: matched.communityId,
                        status: "left",
                        displayName: matched.displayName,
                        avatar: matched.avatar,
                    });
                } else {
                    addGroupTombstoneFromConversationId(pk, conversationId); // legacy fallback
                }
                chatStateStoreService.updateGroups(pk, next.map(g => toPersistedGroupConversation(g)));
            }
            return next;
        });
    }, [getPublicKeyHex]);

    useEffect(() => {
        const handleGroupInvite = (e: Event) => {
            const customEvent = e as CustomEvent<GroupConversation>;
            if (customEvent.detail) {
                addGroup(customEvent.detail);
            }
        };
        const handleGroupRemove = (e: Event) => {
            const customEvent = e as CustomEvent<string>;
            const conversationId = customEvent.detail;
            if (typeof conversationId === "string" && conversationId.length > 0) {
                removeGroupConversation(conversationId);
            }
        };
        const handleInviteAccepted = (e: Event) => {
            const detail = (e as CustomEvent<{
                groupId?: string;
                relayUrl?: string;
                communityId?: string;
                memberPubkey?: string;
            }>).detail;
            const groupId = detail?.groupId?.trim();
            const memberPubkey = detail?.memberPubkey?.trim();
            if (!groupId || !memberPubkey) {
                return;
            }
            const relayHint = detail?.relayUrl?.trim();
            const communityHint = detail?.communityId?.trim();
            const localPublicKey = getPublicKeyHex();
            setCreatedGroups((prev) => {
                let changed = false;
                const next = prev.map((group) => {
                    const matchesGroup = group.groupId === groupId;
                    const matchesRelay = relayHint ? group.relayUrl === relayHint : true;
                    const matchesCommunity = communityHint ? group.communityId === communityHint : true;
                    if (!matchesGroup || !matchesRelay || !matchesCommunity) {
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
                if (!changed) {
                    return prev;
                }
                const pk = getPublicKeyHex();
                if (pk) {
                    chatStateStoreService.updateGroups(pk, next.map((group) => toPersistedGroupConversation(group)));
                    const matchedGroup = next.find((group) => {
                        const matchesGroup = group.groupId === groupId;
                        const matchesRelay = relayHint ? group.relayUrl === relayHint : true;
                        const matchesCommunity = communityHint ? group.communityId === communityHint : true;
                        return matchesGroup && matchesRelay && matchesCommunity;
                    });
                    if (matchedGroup) {
                        upsertCommunityMembershipLedgerEntry(pk, toCommunityMembershipLedgerEntryFromGroup(matchedGroup, {
                            status: "joined",
                        }));
                    }
                }
                const matchedGroup = next.find((group) => {
                    const matchesGroup = group.groupId === groupId;
                    const matchesRelay = relayHint ? group.relayUrl === relayHint : true;
                    const matchesCommunity = communityHint ? group.communityId === communityHint : true;
                    return matchesGroup && matchesRelay && matchesCommunity;
                });
                if (matchedGroup) {
                    upsertCommunityRosterProjection({
                        group: matchedGroup,
                        activeMemberPubkeys: matchedGroup.memberPubkeys,
                    });
                }
                return next;
            });
        };
        const handleMembershipConfirmed = (e: Event) => {
            const detail = (e as CustomEvent<{
                groupId?: string;
                relayUrl?: string;
                communityId?: string;
                displayName?: string;
                avatar?: string;
                access?: GroupConversation["access"];
                memberCount?: number;
                memberPubkeys?: ReadonlyArray<string>;
                adminPubkeys?: ReadonlyArray<string>;
                lastMessage?: string;
                lastMessageTimeUnixMs?: number;
            }>).detail;
            const groupId = detail?.groupId?.trim();
            const relayUrl = detail?.relayUrl?.trim();
            if (!groupId || !relayUrl) {
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
            const pk = getPublicKeyHex();
            const memberPubkeysWithIdentity = pk
                ? dedupePubkeys([...memberPubkeys, pk])
                : memberPubkeys;

            setCreatedGroups((prev) => {
                const existingIndex = prev.findIndex((group) => group.groupId === groupId && group.relayUrl === relayUrl);
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
                        upsertCommunityMembershipLedgerEntry(pk, toCommunityMembershipLedgerEntryFromGroup(persistedMatch, {
                            status: "joined",
                            updatedAtUnixMs: lastMessageTimeUnixMs,
                        }));
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
        const handleMembershipSnapshot = (e: Event) => {
            const detail = (e as CustomEvent<{
                groupId?: string;
                relayUrl?: string;
                communityId?: string;
                activeMemberPubkeys?: ReadonlyArray<string>;
                leftMembers?: ReadonlyArray<string>;
                expelledMembers?: ReadonlyArray<string>;
                disbandedAt?: number | null;
            }>).detail;
            const groupId = detail?.groupId?.trim();
            const relayUrl = detail?.relayUrl?.trim();
            if (!groupId || !relayUrl) {
                return;
            }
            if (typeof detail?.disbandedAt === "number" && detail.disbandedAt > 0) {
                const existing = createdGroupsRef.current.find((group) => group.groupId === groupId && group.relayUrl === relayUrl);
                if (existing) {
                    removeGroupConversation(existing.id);
                }
                return;
            }
            const activeMemberPubkeys = dedupePubkeys((detail?.activeMemberPubkeys ?? []) as ReadonlyArray<string>);
            const leftMemberPubkeys = dedupePubkeys((detail?.leftMembers ?? []) as ReadonlyArray<string>);
            const expelledMemberPubkeys = dedupePubkeys((detail?.expelledMembers ?? []) as ReadonlyArray<string>);

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
                    const matchesCommunity = detail?.communityId ? group.communityId === detail.communityId : true;
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

                // Use enhanced snapshot application with relay evidence confidence
                const enhancedResult = resolveEnhancedSnapshotApplication({
                    currentMemberPubkeys: currentProjection.activeMemberPubkeys,
                    incomingActiveMemberPubkeys: activeMemberPubkeys,
                    leftMemberPubkeys,
                    expelledMemberPubkeys,
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
                            communityId: detail?.communityId ?? null,
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

                const nextMembers = snapshotApplication.nextMemberPubkeys as ReadonlyArray<PublicKeyHex>;

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
        const handleKnownParticipantsObserved = (e: Event) => {
            const detail = (e as CustomEvent<{
                groupId?: string;
                relayUrl?: string;
                communityId?: string;
                conversationId?: string;
                participantPubkeys?: ReadonlyArray<string>;
            }>).detail;
            const groupId = detail?.groupId?.trim();
            const relayUrl = detail?.relayUrl?.trim();
            const conversationId = detail?.conversationId?.trim();
            if (!groupId || !relayUrl || !conversationId) {
                return;
            }
            const participantPubkeys = dedupePubkeys((detail?.participantPubkeys ?? []) as ReadonlyArray<string>);
            if (participantPubkeys.length === 0) {
                return;
            }
            const matchingGroup = createdGroupsRef.current.find((group) => {
                const matchesConversation = group.id === conversationId;
                const matchesGroup = group.groupId === groupId;
                const matchesRelay = group.relayUrl === relayUrl;
                const matchesCommunity = detail?.communityId ? group.communityId === detail.communityId : true;
                return matchesConversation && matchesGroup && matchesRelay && matchesCommunity;
            });
            if (!matchingGroup) {
                return;
            }
            const pk = getPublicKeyHex();
            if (pk) {
                upsertCommunityKnownParticipantsEntry({
                    publicKeyHex: pk as PublicKeyHex,
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

        window.addEventListener("obscur:group-invite", handleGroupInvite);
        window.addEventListener("obscur:group-remove", handleGroupRemove);
        window.addEventListener("obscur:group-invite-response-accepted", handleInviteAccepted);
        window.addEventListener("obscur:group-membership-confirmed", handleMembershipConfirmed);
        window.addEventListener(GROUP_MEMBERSHIP_SNAPSHOT_EVENT, handleMembershipSnapshot);
        window.addEventListener(COMMUNITY_KNOWN_PARTICIPANTS_OBSERVED_EVENT, handleKnownParticipantsObserved);
        return () => {
            window.removeEventListener("obscur:group-invite", handleGroupInvite);
            window.removeEventListener("obscur:group-remove", handleGroupRemove);
            window.removeEventListener("obscur:group-invite-response-accepted", handleInviteAccepted);
            window.removeEventListener("obscur:group-membership-confirmed", handleMembershipConfirmed);
            window.removeEventListener(GROUP_MEMBERSHIP_SNAPSHOT_EVENT, handleMembershipSnapshot);
            window.removeEventListener(COMMUNITY_KNOWN_PARTICIPANTS_OBSERVED_EVENT, handleKnownParticipantsObserved);
        };
    }, [addGroup, getPublicKeyHex, removeGroupConversation, upsertCommunityRosterProjection]);

    // FIX: Persist group members to known participant directory whenever groups are updated
    // This ensures member list survives page refresh
    useEffect(() => {
        const pk = getPublicKeyHex();
        if (!pk || createdGroups.length === 0) return;

        createdGroups.forEach((group) => {
            const memberCount = group.memberPubkeys?.length ?? 0;
            if (memberCount > 1) {
                // Only save if we have multiple members (don't overwrite with thinned data)
                const currentStored = loadCommunityKnownParticipantsEntries(pk);
                const currentEntry = currentStored.find(e => e.conversationId === group.id);
                const storedCount = currentEntry?.participantPubkeys?.length ?? 0;

                // Only update if this group has MORE members than what's stored
                if (memberCount > storedCount) {
                    console.log("[MemberFix] Saving members to store:", {
                        conversationId: group.id.slice(0, 8),
                        memberCount,
                        storedCount,
                    });

                    upsertCommunityKnownParticipantsEntry({
                        publicKeyHex: pk as PublicKeyHex,
                        entry: {
                            conversationId: group.id,
                            groupId: group.groupId,
                            relayUrl: group.relayUrl,
                            communityId: group.communityId,
                            participantPubkeys: dedupePubkeys([
                                ...(group.memberPubkeys ?? []),
                                pk,
                            ]) as ReadonlyArray<PublicKeyHex>,
                            updatedAtUnixMs: Date.now(),
                        },
                    });
                }
            }
        });
    }, [createdGroups, getPublicKeyHex]);

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
        removeGroupConversation
    }), [createdGroups, communityKnownParticipantDirectoryByConversationId, communityRosterByConversationId, isNewGroupOpen, isCreatingGroup, isGroupInfoOpen, newGroupName, newGroupMemberPubkeys, addGroup, updateGroup, leaveGroup, removeGroupConversation]);

    return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
};

export const useGroups = () => {
    const context = useContext(GroupContext);
    if (!context) {
        throw new Error("useGroups must be used within a GroupProvider");
    }
    return context;
};
