"use client";

import React from "react";
import { PartyPopper, X, Ban } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@dweb/ui-kit";

export type CommunityInviteResolutionStatus = "accepted" | "declined" | "canceled";

interface CommunityInviteStatusBannerProps {
    status: CommunityInviteResolutionStatus;
    isOutgoing: boolean;
    className?: string;
}

export const CommunityInviteStatusBanner: React.FC<CommunityInviteStatusBannerProps> = ({
    status,
    isOutgoing,
    className,
}) => {
    const { t } = useTranslation();
    const isAccepted = status === "accepted";
    const isDeclined = status === "declined";

    const label = isAccepted
        ? t("groups.acceptedTitle", "Invitation Accepted")
        : isDeclined
            ? t("groups.declinedTitle", "Invitation Declined")
            : t("groups.canceledTitle", "Invitation Canceled");

    const StatusIcon = isAccepted ? PartyPopper : isDeclined ? Ban : X;

    const shellClass = isOutgoing
        ? cn(
            "flex w-full items-center justify-center gap-2.5 rounded-2xl border px-4 py-3",
            "border-white/25 bg-black/35 text-emerald-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm",
            "dark:border-white/15 dark:bg-black/55 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
            isAccepted && "text-emerald-400",
            isDeclined && "border-white/20 text-rose-400",
            !isAccepted && !isDeclined && "text-zinc-300",
        )
        : cn(
            "flex w-full items-center justify-center gap-2.5 rounded-[22px] border px-4 py-3 shadow-sm",
            isAccepted
                && "border-emerald-300/80 bg-gradient-to-r from-emerald-50 via-white to-teal-50/90 text-emerald-800 shadow-[0_6px_20px_rgba(16,185,129,0.12)] dark:border-emerald-500/30 dark:bg-zinc-950 dark:text-emerald-400 dark:shadow-none",
            isDeclined
                && "border-rose-300/80 bg-gradient-to-r from-rose-50 via-white to-rose-50/40 text-rose-800 shadow-[0_6px_20px_rgba(244,63,94,0.1)] dark:border-rose-500/30 dark:bg-zinc-950 dark:text-rose-400 dark:shadow-none",
            !isAccepted && !isDeclined
                && "border-zinc-300/80 bg-gradient-to-r from-zinc-100 via-white to-zinc-50 text-zinc-700 dark:border-zinc-500/30 dark:bg-zinc-950 dark:text-zinc-400",
        );

    return (
        <div
            data-testid="community-invite-status-banner"
            data-invite-status={status}
            data-invite-direction={isOutgoing ? "outgoing" : "incoming"}
            className={cn(shellClass, className)}
        >
            <StatusIcon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="text-[10px] font-black uppercase tracking-[0.15em] whitespace-nowrap">
                {label}
            </span>
        </div>
    );
};
