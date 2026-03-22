"use client";

import React, { createContext, useContext, useState, useMemo, useEffect, useRef, useCallback } from "react";
import type { GroupConversation } from "@/app/features/messaging/types";
import { CHAT_STATE_REPLACED_EVENT, chatStateStoreService } from "@/app/features/messaging/services/chat-state-store";
import { fromPersistedGroupConversation, toPersistedGroupConversation } from "@/app/features/messaging/utils/persistence";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { toGroupConversationId } from "@/app/features/groups/utils/group-conversation-id";
import { deriveCommunityId } from "@/app/features/groups/utils/community-identity";
import { getActiveProfileIdSafe } from "@/app/features/profiles/services/profile-scope";
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
import { logAppEvent } from "@/app/shared/log-app-event";

interface GroupContextType {
    createdGroups: ReadonlyArray<GroupConversation>;
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

export const GroupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const identity = useIdentity();
    const [createdGroups, setCreatedGroups] = useState<ReadonlyArray<GroupConversation>>([]);
    const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [newGroupMemberPubkeys, setNewGroupMemberPubkeys] = useState("");

    const lastHydratedPublicKeyRef = useRef<string | null>(null);
    const dedupePubkeys = (values: ReadonlyArray<string>): ReadonlyArray<string> => (
        Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)))
    );
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

    const getPublicKeyHex = useCallback(() => {
        return identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? null;
    }, [identity.state.publicKeyHex, identity.state.stored?.publicKeyHex]);

    const dedupeGroups = (groups: ReadonlyArray<GroupConversation>): ReadonlyArray<GroupConversation> => {
        const map = new Map<string, GroupConversation>();
        groups.forEach((group) => {
            const normalized = sanitizeGroup(group);
            const key = toGroupTombstoneKey({ groupId: normalized.groupId, relayUrl: normalized.relayUrl });
            if (!map.has(key)) {
                map.set(key, normalized);
            }
        });
        return Array.from(map.values());
    };

    const hydrateGroupsForPublicKey = useCallback((pk: string) => {
        const profileId = getActiveProfileIdSafe();
        const persisted = chatStateStoreService.load(pk);
        const tombstones = loadGroupTombstones(pk);
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
        });
        const groups = dedupeGroups(recovery.groups)
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
                ledgerEntryCount: recovery.diagnostics.ledgerEntryCount,
                visibleGroupCount: recovery.diagnostics.visibleGroupCount,
                hiddenByTombstoneCount: recovery.diagnostics.hiddenByTombstoneCount,
                hiddenByLedgerStatusCount: recovery.diagnostics.hiddenByLedgerStatusCount,
                missingLedgerCoverageCount: recovery.diagnostics.missingLedgerCoverageCount,
                missingLedgerCoverageBackfillCount: recovery.missingLedgerCoverageEntries.length,
                tombstoneCount: tombstones.size,
            },
        });
        // Self-heal legacy/non-canonical persisted group entries.
        chatStateStoreService.updateGroups(pk, groups.map(g => toPersistedGroupConversation(g)));
        recovery.missingLedgerCoverageEntries.forEach((entry) => {
            upsertCommunityMembershipLedgerEntry(pk, entry);
        });
    }, [getPublicKeyHex]);

    useEffect(() => {
        const pk = getPublicKeyHex();
        if (!pk) {
            lastHydratedPublicKeyRef.current = null;
            setCreatedGroups([]);
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
            const detail = (event as CustomEvent<{ publicKeyHex?: string }>).detail;
            if (detail?.publicKeyHex && detail.publicKeyHex !== pk) {
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
                if (pk) {
                    chatStateStoreService.updateGroups(pk, prev.map(g => toPersistedGroupConversation(g)));
                    upsertCommunityMembershipLedgerEntry(pk, toCommunityMembershipLedgerEntryFromGroup(normalized, {
                        status: "joined",
                    }));
                }
                return prev;
            }
            const next = dedupeGroups([...prev, normalized]);
            if (pk) {
                chatStateStoreService.updateGroups(pk, next.map(g => toPersistedGroupConversation(g)));
                upsertCommunityMembershipLedgerEntry(pk, toCommunityMembershipLedgerEntryFromGroup(normalized, {
                    status: "joined",
                }));
            }
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
                        communityId: existing.communityId || candidateGroup.communityId,
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
                return next;
            });
        };

        window.addEventListener("obscur:group-invite", handleGroupInvite);
        window.addEventListener("obscur:group-remove", handleGroupRemove);
        window.addEventListener("obscur:group-invite-response-accepted", handleInviteAccepted);
        window.addEventListener("obscur:group-membership-confirmed", handleMembershipConfirmed);
        return () => {
            window.removeEventListener("obscur:group-invite", handleGroupInvite);
            window.removeEventListener("obscur:group-remove", handleGroupRemove);
            window.removeEventListener("obscur:group-invite-response-accepted", handleInviteAccepted);
            window.removeEventListener("obscur:group-membership-confirmed", handleMembershipConfirmed);
        };
    }, [addGroup, getPublicKeyHex, removeGroupConversation]);

    const value = useMemo(() => ({
        createdGroups,
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
    }), [createdGroups, isNewGroupOpen, isCreatingGroup, isGroupInfoOpen, newGroupName, newGroupMemberPubkeys, addGroup, updateGroup, leaveGroup, removeGroupConversation]);

    return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
};

export const useGroups = () => {
    const context = useContext(GroupContext);
    if (!context) {
        throw new Error("useGroups must be used within a GroupProvider");
    }
    return context;
};
