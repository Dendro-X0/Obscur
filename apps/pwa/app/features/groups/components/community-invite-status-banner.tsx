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

    const title = isAccepted
        ? t("groups.inviteStatus.acceptedTitle", "Invitation accepted")
        : isDeclined
            ? t("groups.inviteStatus.declinedTitle", "Invitation declined")
            : t("groups.inviteStatus.canceledTitle", "Invitation canceled");

    const subtitle = (() => {
        if (isAccepted) {
            return isOutgoing
                ? t("groups.inviteStatus.acceptedOutgoing", "They can join once relay membership syncs.")
                : t("groups.inviteStatus.acceptedIncoming", "You joined this community.");
        }
        if (isDeclined) {
            return isOutgoing
                ? t("groups.inviteStatus.declinedOutgoing", "They declined your invitation.")
                : t("groups.inviteStatus.declinedIncoming", "You declined this invitation.");
        }
        return isOutgoing
            ? t("groups.inviteStatus.canceledOutgoing", "You canceled this invitation.")
            : t("groups.inviteStatus.canceledIncoming", "The sender canceled this invitation.");
    })();

    const StatusIcon = isAccepted ? PartyPopper : isDeclined ? Ban : X;

    const shellClass = isOutgoing
        ? cn(
            "flex w-full flex-col items-center justify-center gap-1 rounded-2xl border px-4 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm",
            "border-white/25 bg-black/40 dark:border-white/15 dark:bg-black/60",
            isAccepted && "text-emerald-300",
            isDeclined && "border-rose-400/30 text-rose-300",
            !isAccepted && !isDeclined && "text-zinc-200",
        )
        : cn(
            "flex w-full flex-col items-center justify-center gap-1 rounded-[22px] border px-4 py-3 text-center shadow-sm",
            isAccepted
                && "border-emerald-400/70 bg-gradient-to-r from-emerald-50 via-white to-teal-50/90 text-emerald-900 shadow-[0_6px_20px_rgba(16,185,129,0.14)] dark:border-emerald-500/40 dark:from-emerald-950/80 dark:via-zinc-950 dark:to-zinc-950 dark:text-emerald-300 dark:shadow-none",
            isDeclined
                && "border-rose-400/70 bg-gradient-to-r from-rose-50 via-white to-rose-50/50 text-rose-900 shadow-[0_6px_20px_rgba(244,63,94,0.12)] dark:border-rose-500/40 dark:from-rose-950/80 dark:via-zinc-950 dark:to-zinc-950 dark:text-rose-300 dark:shadow-none",
            !isAccepted && !isDeclined
                && "border-zinc-400/60 bg-gradient-to-r from-zinc-100 via-white to-zinc-50 text-zinc-800 dark:border-zinc-500/40 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-950 dark:text-zinc-200",
        );

    const subtitleClass = isOutgoing
        ? cn(
            "max-w-[28rem] text-[11px] font-medium leading-snug",
            isAccepted && "text-emerald-100/90",
            isDeclined && "text-rose-100/90",
            !isAccepted && !isDeclined && "text-zinc-300/90",
        )
        : cn(
            "max-w-[28rem] text-[11px] font-medium leading-snug",
            isAccepted && "text-emerald-800/80 dark:text-emerald-200/90",
            isDeclined && "text-rose-800/80 dark:text-rose-200/90",
            !isAccepted && !isDeclined && "text-zinc-600 dark:text-zinc-400",
        );

    return (
        <div
            role="status"
            data-testid="community-invite-status-banner"
            data-invite-status={status}
            data-invite-direction={isOutgoing ? "outgoing" : "incoming"}
            className={cn(shellClass, className)}
        >
            <div className="flex items-center justify-center gap-2.5">
                <StatusIcon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="text-[10px] font-black uppercase tracking-[0.15em] whitespace-nowrap">
                    {title}
                </span>
            </div>
            <p className={subtitleClass}>{subtitle}</p>
        </div>
    );
};
