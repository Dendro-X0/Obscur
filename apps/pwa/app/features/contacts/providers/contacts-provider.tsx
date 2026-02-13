"use client";

import React, { createContext, useContext, useMemo } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { usePeerTrust } from "../hooks/use-peer-trust";
import { useRequestsInbox } from "@/app/features/messaging/hooks/use-requests-inbox";
import { useBlocklist } from "../hooks/use-blocklist";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";

interface ContactsContextType {
    identity: ReturnType<typeof useIdentity>;
    peerTrust: ReturnType<typeof usePeerTrust>;
    requestsInbox: ReturnType<typeof useRequestsInbox>;
    blocklist: ReturnType<typeof useBlocklist>;
}

const ContactsContext = createContext<ContactsContextType | null>(null);

export const ContactsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const identity = useIdentity();
    const { state } = identity;
    const publicKeyHex = state.publicKeyHex || null;

    const peerTrust = usePeerTrust({ publicKeyHex });
    const requestsInbox = useRequestsInbox({ publicKeyHex });
    const blocklist = useBlocklist({ publicKeyHex });

    const value = useMemo(() => ({
        identity,
        peerTrust,
        requestsInbox,
        blocklist
    }), [identity, peerTrust, requestsInbox, blocklist]);

    return (
        <ContactsContext.Provider value={value}>
            {children}
        </ContactsContext.Provider>
    );
};

export const useContacts = () => {
    const context = useContext(ContactsContext);
    if (!context) {
        throw new Error("useContacts must be used within a ContactsProvider");
    }
    return context;
};
