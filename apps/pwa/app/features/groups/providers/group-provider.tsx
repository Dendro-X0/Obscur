"use client";

import React, { createContext, useContext, useState, useMemo, useEffect, useRef } from "react";
import type { GroupConversation, PersistedGroupConversation } from "@/app/features/messaging/types";
import { loadPersistedChatState, fromPersistedGroupConversation } from "@/app/features/messaging/utils/persistence";

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

    // Persistence: Hydration
    useEffect(() => {
        if (didHydrateRef.current) return;
        const persisted = loadPersistedChatState();
        if (persisted) {
            const nextCreatedGroups: ReadonlyArray<GroupConversation> = persisted.createdGroups.map((g: PersistedGroupConversation): GroupConversation =>
                fromPersistedGroupConversation(g)
            );
            setCreatedGroups(nextCreatedGroups);
        }
        didHydrateRef.current = true;
    }, []);

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
        setNewGroupMemberPubkeys
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
