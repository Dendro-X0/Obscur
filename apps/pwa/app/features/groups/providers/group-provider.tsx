"use client";

import React, { createContext, useContext, useState, useMemo, useEffect, useRef, useCallback } from "react";
import type { GroupConversation } from "@/app/features/messaging/types";
import { chatStateStoreService } from "@/app/features/messaging/services/chat-state-store";
import { fromPersistedGroupConversation, toPersistedGroupConversation } from "@/app/features/messaging/utils/persistence";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";

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
    addGroup: (group: GroupConversation) => void;
    updateGroup: (params: Readonly<{ groupId: string; updates: Partial<GroupConversation> }>) => void;
    leaveGroup: (groupId: string) => void;
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

    useEffect(() => {
        if (didHydrateRef.current) return;
        const pk = identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? null;
        if (!pk) return;

        const persisted = chatStateStoreService.load(pk);
        if (persisted && persisted.createdGroups) {
            const groups = persisted.createdGroups.map(fromPersistedGroupConversation);
            queueMicrotask(() => {
                setCreatedGroups(groups);
            });
        }
        didHydrateRef.current = true;
    }, [identity.state.publicKeyHex, identity.state.stored?.publicKeyHex]);

    const addGroup = useCallback((group: GroupConversation) => {
        setCreatedGroups(prev => {
            if (prev.find(g => g.groupId === group.groupId)) return prev;
            const next = [...prev, group];
            const pk = identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? null;
            if (pk) {
                chatStateStoreService.updateGroups(pk, next.map(g => toPersistedGroupConversation(g)));
            }
            return next;
        });
    }, [identity.state.publicKeyHex, identity.state.stored?.publicKeyHex]);

    const updateGroup = useCallback((params: Readonly<{ groupId: string; updates: Partial<GroupConversation> }>) => {
        setCreatedGroups(prev => {
            const index = prev.findIndex(g => g.groupId === params.groupId);
            if (index === -1) return prev;
            const next = [...prev];
            next[index] = { ...next[index], ...params.updates };
            const pk = identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? null;
            if (pk) {
                chatStateStoreService.updateGroups(pk, next.map(g => toPersistedGroupConversation(g)));
            }
            return next;
        });
    }, [identity.state.publicKeyHex, identity.state.stored?.publicKeyHex]);

    const leaveGroup = useCallback((groupId: string) => {
        setCreatedGroups(prev => {
            const next = prev.filter(g => g.groupId !== groupId);
            const pk = identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? null;
            if (pk) {
                chatStateStoreService.updateGroups(pk, next.map(g => toPersistedGroupConversation(g)));
            }
            return next;
        });
    }, [identity.state.publicKeyHex, identity.state.stored?.publicKeyHex]);

    useEffect(() => {
        const handleGroupInvite = (e: Event) => {
            const customEvent = e as CustomEvent<GroupConversation>;
            if (customEvent.detail) {
                addGroup(customEvent.detail);
            }
        };

        window.addEventListener("obscur:group-invite", handleGroupInvite);
        return () => window.removeEventListener("obscur:group-invite", handleGroupInvite);
    }, [addGroup]);

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
        leaveGroup
    }), [createdGroups, isNewGroupOpen, isCreatingGroup, isGroupInfoOpen, newGroupName, newGroupMemberPubkeys, addGroup, updateGroup, leaveGroup]);

    return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
};

export const useGroups = () => {
    const context = useContext(GroupContext);
    if (!context) {
        throw new Error("useGroups must be used within a GroupProvider");
    }
    return context;
};
