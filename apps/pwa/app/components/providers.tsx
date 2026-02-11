"use client";

import React from "react";
import { AuthGateway } from "@/app/features/auth/components/auth-gateway";
import { MessagingProvider } from "@/app/features/messaging/providers/messaging-provider";
import { RelayProvider } from "@/app/features/relays/providers/relay-provider";
import { GroupProvider } from "@/app/features/groups/providers/group-provider";

export const AppProviders = ({ children }: { children: React.ReactNode }) => {
    return (
        <AuthGateway>
            <RelayProvider>
                <GroupProvider>
                    <MessagingProvider>
                        {children}
                    </MessagingProvider>
                </GroupProvider>
            </RelayProvider>
        </AuthGateway>
    );
};
