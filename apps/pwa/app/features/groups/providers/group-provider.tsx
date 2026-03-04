"use client";

import React, { createContext, useContext, useState, useMemo, useEffect, useRef, useCallback } from "react";
import type { GroupConversation } from "@/app/features/messaging/types";
import { chatStateStoreService } from "@/app/features/messaging/services/chat-state-store";
import { fromPersistedGroupConversation, toPersistedGroupConversation } from "@/app/features/messaging/utils/persistence";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { toGroupConversationId } from "@/app/features/groups/utils/group-conversation-id";
import { deriveCommunityId } from "@/app/features/groups/utils/community-identity";
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

    const didHydrateRef = useRef(false);

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

    useEffect(() => {
        if (didHydrateRef.current) return;
        const pk = getPublicKeyHex();
        if (!pk) return;

        const persisted = chatStateStoreService.load(pk);
        if (persisted && persisted.createdGroups) {
            const tombstones = loadGroupTombstones(pk);
            const audit = auditCommunityMigrationState({ state: persisted, tombstones });
            if (!audit.ok) {
                logRuntimeEvent(
                    "community_migration.audit_findings",
                    "expected",
                    ["[CommunityMigrationAudit] findings", audit],
                );
            }
            const groups = dedupeGroups(persisted.createdGroups.map(fromPersistedGroupConversation))
                .filter((group) => !tombstones.has(toGroupTombstoneKey({ groupId: group.groupId, relayUrl: group.relayUrl })));
            queueMicrotask(() => {
                setCreatedGroups(groups);
            });
            // Self-heal legacy/non-canonical persisted group entries.
            chatStateStoreService.updateGroups(pk, groups.map(g => toPersistedGroupConversation(g)));
        }
        didHydrateRef.current = true;
    }, [getPublicKeyHex]);

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
            if (prev.find(g => g.groupId === normalized.groupId && g.relayUrl === normalized.relayUrl)) return prev;
            const next = dedupeGroups([...prev, normalized]);
            if (pk) {
                chatStateStoreService.updateGroups(pk, next.map(g => toPersistedGroupConversation(g)));
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
            }
            return next;
        });
    }, [getPublicKeyHex]);

    const leaveGroup = useCallback((params: Readonly<{ groupId: string; relayUrl?: string; conversationId?: string }>) => {
        setCreatedGroups(prev => {
            const matched = params.conversationId
                ? prev.find((g) => g.id === params.conversationId)
                : undefined;
            const next = prev.filter((g) => {
                if (params.conversationId) return g.id !== params.conversationId;
                if (params.relayUrl) return !(g.groupId === params.groupId && g.relayUrl === params.relayUrl);
                return g.groupId !== params.groupId;
            });
            const pk = getPublicKeyHex();
            if (pk) {
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

        window.addEventListener("obscur:group-invite", handleGroupInvite);
        window.addEventListener("obscur:group-remove", handleGroupRemove);
        return () => {
            window.removeEventListener("obscur:group-invite", handleGroupInvite);
            window.removeEventListener("obscur:group-remove", handleGroupRemove);
        };
    }, [addGroup, removeGroupConversation]);

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
