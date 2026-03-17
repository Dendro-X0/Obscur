"use client";

import React from "react";
import { AuthGateway } from "@/app/features/auth/components/auth-gateway";
import { DesktopProfileBootstrap } from "@/app/features/profiles/components/desktop-profile-bootstrap";
import { UnlockedAppRuntimeShell } from "@/app/features/runtime/components/unlocked-app-runtime-shell";
import { DevRuntimeIssueCapture } from "@/app/shared/dev-runtime-issue-capture";


export const AppProviders = ({ children }: { children: React.ReactNode }) => {
    return (
        <DesktopProfileBootstrap>
            <DevRuntimeIssueCapture />
            <AuthGateway>
                <UnlockedAppRuntimeShell>
                    {children}
                </UnlockedAppRuntimeShell>
            </AuthGateway>
        </DesktopProfileBootstrap>
    );
};
