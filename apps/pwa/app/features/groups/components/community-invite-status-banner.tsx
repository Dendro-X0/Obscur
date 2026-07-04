"use client";
import React from "react";
import { MailCheck, X, Ban, History, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@dweb/ui-kit";
import type { CommunityInviteCardStatus } from "../utils/community-invite-lifecycle";
import { isCommunityInviteHistoricalStatus } from "../utils/community-invite-lifecycle";
export type CommunityInviteResolutionStatus = "accepted" | "declined" | "canceled";
interface CommunityInviteStatusBannerProps {
    status: CommunityInviteCardStatus;
    isOutgoing: boolean;
    className?: string;
    /** When true, omits long explanatory subtitles (compact historical row). */
    compact?: boolean;
}
/**
 * Relay honesty: `accepted` reflects a DM payload only—it does not prove relay-visible membership.
 * Declined/canceled are intentional terminal outcomes from the peer (still DM-delivered).
 */
export const CommunityInviteStatusBanner: React.FC<CommunityInviteStatusBannerProps> = ({ status, isOutgoing, className, compact = false, }) => {
    const { t } = useTranslation();
    const isAccepted = status === "accepted";
    const isDeclined = status === "declined";
    const isExpired = status === "expired";
    const isSuperseded = status === "superseded";
    const isHistorical = isCommunityInviteHistoricalStatus(status);
    const title = (() => {
        if (isAccepted) {
            return t("groups.inviteStatus.acceptedTitle");
        }
        if (isDeclined) {
            return t("groups.inviteStatus.declinedTitle");
        }
        if (isExpired) {
            return t("groups.inviteStatus.expiredTitle");
        }
        if (isSuperseded) {
            return t("groups.inviteStatus.supersededTitle");
        }
        return t("groups.inviteStatus.canceledTitle");
    })();
    const subtitle = (() => {
        if (compact && isHistorical) {
            return t("groups.inviteStatus.historicalCompact");
        }
        if (isAccepted) {
            return isOutgoing
                ? t("groups.inviteStatus.acceptedOutgoing")
                : t("groups.inviteStatus.acceptedIncoming");
        }
        if (isDeclined) {
            return isOutgoing
                ? t("groups.inviteStatus.declinedOutgoing")
                : t("groups.inviteStatus.declinedIncoming");
        }
        if (isExpired) {
            return t("groups.inviteStatus.expiredHint");
        }
        if (isSuperseded) {
            return isOutgoing
                ? t("groups.inviteStatus.supersededOutgoing")
                : t("groups.inviteStatus.supersededIncoming");
        }
        return isOutgoing
            ? t("groups.inviteStatus.canceledOutgoing")
            : t("groups.inviteStatus.canceledIncoming");
    })();
    const StatusIcon = isAccepted
        ? MailCheck
        : isDeclined
            ? Ban
            : isExpired
                ? Clock
                : isSuperseded
                    ? History
                    : X;
    const shellClass = isOutgoing
        ? cn("flex w-full flex-col items-center justify-center gap-1 rounded-2xl border px-4 py-3 text-center shadow-sm", isAccepted
            && "border-amber-400/60 bg-gradient-to-r from-amber-50 via-white to-amber-50/85 text-amber-950 shadow-[0_6px_20px_rgba(245,158,11,0.12)] dark:border-amber-400/35 dark:from-amber-950/70 dark:via-zinc-950 dark:to-zinc-950 dark:text-amber-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]", isDeclined
            && "border-rose-400/60 bg-gradient-to-r from-rose-50 via-white to-rose-50/50 text-rose-900 shadow-[0_6px_20px_rgba(244,63,94,0.12)] dark:border-rose-400/30 dark:from-rose-950/80 dark:via-zinc-950 dark:to-zinc-950 dark:text-rose-300", (isExpired || isSuperseded)
            && "border-zinc-300/70 bg-gradient-to-r from-zinc-100 via-white to-zinc-50/90 text-zinc-700 dark:border-zinc-400/35 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-950 dark:text-zinc-300", !isAccepted && !isDeclined && !isExpired && !isSuperseded
            && "border-zinc-300/70 bg-gradient-to-r from-zinc-100 via-white to-zinc-50 text-zinc-800 dark:border-white/15 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-950 dark:text-zinc-200")
        : cn("flex w-full flex-col items-center justify-center gap-1 rounded-[22px] border px-4 py-3 text-center shadow-sm", isAccepted
            && "border-amber-400/65 bg-gradient-to-r from-amber-50 via-white to-amber-50/85 text-amber-950 shadow-[0_6px_20px_rgba(245,158,11,0.12)] dark:border-amber-500/35 dark:from-amber-950/85 dark:via-zinc-950 dark:to-zinc-950 dark:text-amber-100 dark:shadow-none", isDeclined
            && "border-rose-400/70 bg-gradient-to-r from-rose-50 via-white to-rose-50/50 text-rose-900 shadow-[0_6px_20px_rgba(244,63,94,0.12)] dark:border-rose-500/40 dark:from-rose-950/80 dark:via-zinc-950 dark:to-zinc-950 dark:text-rose-300 dark:shadow-none", (isExpired || isSuperseded)
            && "border-zinc-300/70 bg-gradient-to-r from-zinc-100 via-white to-zinc-50/90 text-zinc-700 dark:border-zinc-500/40 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-950 dark:text-zinc-300", !isAccepted && !isDeclined && !isExpired && !isSuperseded
            && "border-zinc-400/60 bg-gradient-to-r from-zinc-100 via-white to-zinc-50 text-zinc-800 dark:border-zinc-500/40 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-950 dark:text-zinc-200");
    const subtitleClass = isOutgoing
        ? cn("max-w-[28rem] text-[11px] font-medium leading-snug", isAccepted && "text-amber-900/85 dark:text-amber-50/95", isDeclined && "text-rose-800/80 dark:text-rose-100/90", (isExpired || isSuperseded) && "text-zinc-600 dark:text-zinc-300/90", !isAccepted && !isDeclined && !isExpired && !isSuperseded && "text-zinc-600 dark:text-zinc-300/90")
        : cn("max-w-[28rem] text-[11px] font-medium leading-snug", isAccepted && "text-amber-900/85 dark:text-amber-100/90", isDeclined && "text-rose-800/80 dark:text-rose-200/90", (isExpired || isSuperseded) && "text-zinc-600 dark:text-zinc-400", !isAccepted && !isDeclined && !isExpired && !isSuperseded && "text-zinc-600 dark:text-zinc-400");
    return (<div role="status" data-testid="community-invite-status-banner" data-invite-status={status} data-invite-direction={isOutgoing ? "outgoing" : "incoming"} className={cn(shellClass, className)}>
            <div className="flex items-center justify-center gap-2.5">
                <StatusIcon className="h-4 w-4 shrink-0" aria-hidden/>
                <span className="text-[10px] font-black uppercase tracking-[0.15em] whitespace-nowrap">
                    {title}
                </span>
            </div>
            <p className={subtitleClass}>{subtitle}</p>
        </div>);
};
