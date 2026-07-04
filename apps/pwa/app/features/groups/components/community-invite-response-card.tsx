"use client";

import React from "react";
import { cn } from "@dweb/ui-kit";
import { CommunityInviteStatusBanner } from "./community-invite-status-banner";
import type { CommunityInviteResolutionStatus } from "./community-invite-status-banner";
import {
    resolveCommunityInviteStatusBannerIsOutgoing,
    type CommunityInviteViewerRole,
} from "../services/community-invite-role-authority";

export interface CommunityInviteResponseContent {
    type: "community-invite-response";
    status: CommunityInviteResolutionStatus;
    groupId: string;
}

interface CommunityInviteResponseCardProps {
    response: CommunityInviteResponseContent;
    viewerRole: CommunityInviteViewerRole;
    compact?: boolean;
}

export const CommunityInviteResponseCard: React.FC<CommunityInviteResponseCardProps> = ({
    response,
    viewerRole,
    compact = false,
}) => {
    const statusBannerIsOutgoing = resolveCommunityInviteStatusBannerIsOutgoing(
        viewerRole,
        "response",
        response.status,
    );

    return (
        <div
            data-testid="community-invite-response-card"
            data-invite-direction={statusBannerIsOutgoing ? "outgoing" : "incoming"}
            data-invite-viewer-role={viewerRole}
            className={cn(
                "py-0.5",
                statusBannerIsOutgoing ? "flex justify-end" : "flex justify-start",
            )}
        >
            <div
                className={cn(
                    "w-full",
                    compact ? "max-w-full" : "min-w-[220px] max-w-[min(100%,320px)]",
                    cn(
                        "rounded-2xl border border-purple-200/55 bg-gradient-to-br from-purple-50 via-white to-indigo-50/90 shadow-[0_10px_32px_rgba(88,28,135,0.12)] dark:border-white/[0.07] dark:bg-gradient-to-br dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-900/95 dark:shadow-sm dark:shadow-black/25",
                        compact ? "p-2" : "rounded-[28px] p-3",
                    ),
                )}
            >
                <CommunityInviteStatusBanner
                    status={response.status}
                    isOutgoing={statusBannerIsOutgoing}
                    compact
                />
            </div>
        </div>
    );
};
