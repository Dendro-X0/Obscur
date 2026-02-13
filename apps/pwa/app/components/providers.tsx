"use client";

import React from "react";
import { AuthGateway } from "@/app/features/auth/components/auth-gateway";
import { MessagingProvider } from "@/app/features/messaging/providers/messaging-provider";
import { RelayProvider } from "@/app/features/relays/providers/relay-provider";
import { GroupProvider } from "@/app/features/groups/providers/group-provider";
import { ContactsProvider } from "@/app/features/contacts/providers/contacts-provider";
import { GlobalDialogManager } from "@/app/features/messaging/components/global-dialog-manager";

export const AppProviders = ({ children }: { children: React.ReactNode }) => {
    return (
        <RelayProvider>
            <GroupProvider>
                <ContactsProvider>
                    <MessagingProvider>
                        <AuthGateway>
                            <GlobalDialogManager />
                            {children}
                        </AuthGateway>
                    </MessagingProvider>
                </ContactsProvider>
            </GroupProvider>
        </RelayProvider>
    );
};
