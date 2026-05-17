"use client";

import React from "react";
import { cn } from "@dweb/ui-kit";
import { CommunityInviteStatusBanner } from "./community-invite-status-banner";
import type { CommunityInviteResolutionStatus } from "./community-invite-status-banner";

export interface CommunityInviteResponseContent {
    type: "community-invite-response";
    status: CommunityInviteResolutionStatus;
    groupId: string;
}

interface CommunityInviteResponseCardProps {
    response: CommunityInviteResponseContent;
    isOutgoing: boolean;
}

export const CommunityInviteResponseCard: React.FC<CommunityInviteResponseCardProps> = ({
    response,
    isOutgoing,
}) => {
    return (
        <div
            data-testid="community-invite-response-card"
            data-invite-direction={isOutgoing ? "outgoing" : "incoming"}
            className={cn(
                "py-0.5",
                isOutgoing ? "flex justify-end" : "flex justify-start",
            )}
        >
            <div
                className={cn(
                    "min-w-[220px] max-w-[300px]",
                    isOutgoing
                        ? "rounded-[28px] bg-gradient-to-tr from-purple-600 to-indigo-500 p-3 shadow-md shadow-purple-500/20 dark:bg-gradient-to-tr dark:from-purple-950 dark:via-indigo-950 dark:to-indigo-900 dark:shadow-md dark:shadow-black/35"
                        : "rounded-[28px] border border-purple-200/55 bg-gradient-to-br from-purple-50 via-white to-indigo-50/90 p-3 shadow-[0_10px_32px_rgba(88,28,135,0.12)] dark:border-white/[0.07] dark:bg-gradient-to-br dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-900/95 dark:shadow-sm dark:shadow-black/25",
                )}
            >
                <CommunityInviteStatusBanner
                    status={response.status}
                    isOutgoing={isOutgoing}
                />
            </div>
        </div>
    );
};
