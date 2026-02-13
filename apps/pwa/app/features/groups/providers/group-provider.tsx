"use client";

import React, { createContext, useContext, useState, useMemo, useEffect, useRef } from "react";
import type { GroupConversation, PersistedGroupConversation } from "@/app/features/messaging/types";
import { loadPersistedChatState, fromPersistedGroupConversation, savePersistedChatState, toPersistedGroupConversation } from "@/app/features/messaging/utils/persistence";

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
    leaveGroup: (groupId: string) => void;
}

const GroupContext = createContext<GroupContextType | null>(null);

export const GroupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [createdGroups, setCreatedGroups] = useState<ReadonlyArray<GroupConversation>>([]);
    const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [newGroupMemberPubkeys, setNewGroupMemberPubkeys] = useState("");

    const didHydrateRef = useRef(false);

    const addGroup = (group: GroupConversation) => {
        setCreatedGroups(prev => {
            if (prev.find(g => g.groupId === group.groupId)) return prev;
            const next = [...prev, group];
            const persisted = loadPersistedChatState() || {
                version: 2,
                createdGroups: [],
                createdContacts: [],
                unreadByConversationId: {},
                contactOverridesByContactId: {},
                messagesByConversationId: {},
            };
            savePersistedChatState({
                ...persisted,
                createdGroups: next.map(g => toPersistedGroupConversation(g))
            });
            return next;
        });
    };

    const leaveGroup = (groupId: string) => {
        setCreatedGroups(prev => {
            const next = prev.filter(g => g.groupId !== groupId);
            const persisted = loadPersistedChatState() || {
                version: 2,
                createdGroups: [],
                createdContacts: [],
                unreadByConversationId: {},
                contactOverridesByContactId: {},
                messagesByConversationId: {},
            };
            savePersistedChatState({
                ...persisted,
                createdGroups: next.map(g => toPersistedGroupConversation(g))
            });
            return next;
        });
    }

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
        leaveGroup
    }), [createdGroups, isNewGroupOpen, isCreatingGroup, isGroupInfoOpen, newGroupName, newGroupMemberPubkeys]);

    return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
};

export const useGroups = () => {
    const context = useContext(GroupContext);
    if (!context) {
        throw new Error("useGroups must be used within a GroupProvider");
    }
    return context;
};
