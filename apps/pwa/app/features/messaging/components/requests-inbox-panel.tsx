"use client";

import React from "react";
import { Button } from "../../../components/ui/button";
import { MessageSquare, BadgeInfo, Trash2 } from "lucide-react";
// Removed unused Avatar imports
import { cn } from "@/app/lib/utils";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { formatTime } from "../utils/formatting";
import { useTranslation } from "react-i18next";
import { useProfileMetadata } from "../../profile/hooks/use-profile-metadata";
import { UserAvatar } from "../../profile/components/user-avatar";
import { getInvitationInboxStatusCopy, type InvitationTone } from "../services/invitation-presentation";
import {
    getIncomingRequestQuarantineSummary,
    type IncomingRequestQuarantineSummary,
} from "../services/incoming-request-quarantine-summary";

import type { ConnectionRequestStatusValue } from "../../messaging/types";

type RequestItem = Readonly<{
    peerPublicKeyHex: PublicKeyHex;
    lastMessagePreview: string;
    lastReceivedAtUnixSeconds: number;
    unreadCount: number;
    status?: ConnectionRequestStatusValue;
    isRequest?: boolean;
    isOutgoing?: boolean;
}>;

interface RequestsInboxPanelProps {
    variant?: "inbox" | "junk";
    requests: ReadonlyArray<RequestItem>;
    nowMs: number | null;
    onSelect: (pubkey: PublicKeyHex) => void;
    onFindSomeone?: () => void;
    onClearHistory?: () => void;
    onDismissPendingCount?: () => void;
    pendingCountDismissed?: boolean;
}

export function RequestsInboxPanel({ variant = "inbox", requests, nowMs, onSelect, onFindSomeone, onClearHistory, onDismissPendingCount, pendingCountDismissed = false }: RequestsInboxPanelProps) {
    const { t } = useTranslation();
    const isJunk = variant === "junk";
    const [quarantineSummary, setQuarantineSummary] = React.useState<IncomingRequestQuarantineSummary>(() => (
        getIncomingRequestQuarantineSummary()
    ));

    React.useEffect(() => {
        const refresh = () => setQuarantineSummary(getIncomingRequestQuarantineSummary());
        refresh();
        const timer = window.setInterval(refresh, 5000);
        return () => window.clearInterval(timer);
    }, [requests.length]);

    if (requests.length === 0) {
        return (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                <div className="mb-4 rounded-full bg-zinc-100 p-4 ring-1 ring-black/5 dark:bg-zinc-800 dark:ring-white/5">
                    <MessageSquare className="h-8 w-8 text-zinc-400" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-300">
                    {isJunk ? t("messaging.junkInboxEmptyTitle") : "No open requests"}
                </h3>
                <p className="mt-3 max-w-[240px] text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {isJunk
                        ? t("messaging.junkInboxEmptyDesc")
                        : "Incoming invitations and outgoing requests waiting for a response appear here. If someone declined, you can send a new request from their profile or the request thread."}
                </p>
                {onFindSomeone && (
                    <Button
                        variant="secondary"
                        size="sm"
                        className="mt-6 dark:bg-zinc-800"
                        onClick={onFindSomeone}
                    >
                        Find people
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-black/5 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
                <div>
                    <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400">
                        {isJunk
                            ? t("messaging.junkInboxTitle", { count: requests.length })
                            : `Requests (${requests.length})`}
                    </h2>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {isJunk
                            ? t("messaging.junkInboxDesc")
                            : "Obscur only lists invitations here after incoming relay evidence is received."}
                    </p>
                    {quarantineSummary.totalSuppressed > 0 && (
                        <div className="mt-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
                            <p className="font-black uppercase tracking-[0.14em]">
                                Anti-spam protection active
                            </p>
                            <p className="mt-1 leading-relaxed">
                                Blocked {quarantineSummary.totalSuppressed} suspicious request attempt{quarantineSummary.totalSuppressed === 1 ? "" : "s"} in the recent window.
                            </p>
                            <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-semibold">
                                {quarantineSummary.byReason.incoming_connection_request_peer_rate_limited > 0 && (
                                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5">
                                        sender rate limit: {quarantineSummary.byReason.incoming_connection_request_peer_rate_limited}
                                    </span>
                                )}
                                {quarantineSummary.byReason.incoming_connection_request_peer_cooldown_active > 0 && (
                                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5">
                                        sender cooldown: {quarantineSummary.byReason.incoming_connection_request_peer_cooldown_active}
                                    </span>
                                )}
                                {quarantineSummary.byReason.incoming_connection_request_global_rate_limited > 0 && (
                                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5">
                                        global rate limit: {quarantineSummary.byReason.incoming_connection_request_global_rate_limited}
                                    </span>
                                )}
                                {quarantineSummary.byReason.incoming_connection_request_attack_mode_strict_relay_high_risk > 0 && (
                                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5">
                                        strict relay risk: {quarantineSummary.byReason.incoming_connection_request_attack_mode_strict_relay_high_risk}
                                    </span>
                                )}
                                {quarantineSummary.byReason.incoming_connection_request_attack_mode_peer_shared_intel_blocked > 0 && (
                                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5">
                                        shared-intel peer block: {quarantineSummary.byReason.incoming_connection_request_attack_mode_peer_shared_intel_blocked}
                                    </span>
                                )}
                                {quarantineSummary.byReason.incoming_connection_request_attack_mode_contract_violation > 0 && (
                                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5">
                                        contract boundary: {quarantineSummary.byReason.incoming_connection_request_attack_mode_contract_violation}
                                    </span>
                                )}
                            </div>
                            {quarantineSummary.recent.length > 0 && (
                                <div className="mt-2 space-y-1">
                                    {quarantineSummary.recent.slice(0, 3).map((entry, index) => (
                                        <p key={`${entry.atUnixMs}-${index}`} className="text-[10px] leading-relaxed opacity-90">
                                            Identity hidden - {quarantineReasonLabel(entry.reasonCode)} - {formatTime(new Date(entry.atUnixMs), nowMs)}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {onDismissPendingCount && requests.length > 0 && !pendingCountDismissed ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[10px] font-bold text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                            onClick={onDismissPendingCount}
                        >
                            Hide tab count
                        </Button>
                    ) : null}
                    {onClearHistory && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[10px] font-bold text-zinc-400 hover:text-red-500 hover:bg-red-500/5 transition-colors"
                            onClick={onClearHistory}
                        >
                            <Trash2 className="h-3 w-3 mr-1" />
                            {t("common.clear")}
                        </Button>
                    )}
                    <div className="group relative">
                        <BadgeInfo className="h-4 w-4 text-zinc-400 cursor-help" />
                        <div className="absolute top-6 right-0 w-48 p-2 rounded-lg bg-white dark:bg-zinc-800 shadow-xl border border-black/5 dark:border-white/5 text-[10px] text-zinc-500 dark:text-zinc-400 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                            {isJunk
                                ? t("messaging.junkInboxHelp")
                                : "Invitations appear here after the app has real incoming evidence, not just a sender-side claim."}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-2">
                {requests.map((request) => (
                    <RequestItemRow
                        key={request.peerPublicKeyHex}
                        request={request}
                        quarantinePeerSignal={quarantineSummary.byPeerPrefix[request.peerPublicKeyHex.slice(0, 16).toLowerCase()] ?? null}
                        nowMs={nowMs}
                        onSelect={onSelect}
                    />
                ))}
            </div>
        </div>
    );
}

interface RequestItemRowProps {
    request: RequestItem;
    quarantinePeerSignal: Readonly<{
        count: number;
        latestReasonCode:
            | "incoming_connection_request_peer_rate_limited"
            | "incoming_connection_request_peer_cooldown_active"
            | "incoming_connection_request_global_rate_limited"
            | "incoming_connection_request_attack_mode_strict_relay_high_risk"
            | "incoming_connection_request_attack_mode_peer_shared_intel_blocked"
            | "incoming_connection_request_attack_mode_contract_violation";
        lastAtUnixMs: number;
    }> | null;
    nowMs: number | null;
    onSelect: (pubkey: PublicKeyHex) => void;
}

const invitationToneClassName = (tone: InvitationTone): string => {
    if (tone === "success") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    if (tone === "warning") return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    if (tone === "danger") return "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300";
    if (tone === "info") return "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300";
    return "border-black/5 bg-zinc-50 text-zinc-600 dark:border-white/5 dark:bg-zinc-800/70 dark:text-zinc-300";
};

const quarantineReasonLabel = (
    reasonCode:
        | "incoming_connection_request_peer_rate_limited"
        | "incoming_connection_request_peer_cooldown_active"
        | "incoming_connection_request_global_rate_limited"
        | "incoming_connection_request_attack_mode_strict_relay_high_risk"
        | "incoming_connection_request_attack_mode_peer_shared_intel_blocked"
        | "incoming_connection_request_attack_mode_contract_violation"
): string => {
    if (reasonCode === "incoming_connection_request_peer_rate_limited") {
        return "sender rate-limited";
    }
    if (reasonCode === "incoming_connection_request_peer_cooldown_active") {
        return "sender cooldown active";
    }
    if (reasonCode === "incoming_connection_request_attack_mode_strict_relay_high_risk") {
        return "strict mode relay risk";
    }
    if (reasonCode === "incoming_connection_request_attack_mode_peer_shared_intel_blocked") {
        return "strict mode shared-intel block";
    }
    if (reasonCode === "incoming_connection_request_attack_mode_contract_violation") {
        return "contract boundary blocked";
    }
    return "global anti-spam limit";
};

function RequestItemRow({ request, quarantinePeerSignal, nowMs, onSelect }: RequestItemRowProps) {
    const { t } = useTranslation();
    const metadata = useProfileMetadata(request.peerPublicKeyHex, { live: false });
    const isOutgoing = !!request.isOutgoing;
    const displayName = metadata?.displayName || (request.isRequest ? t("messaging.newConnection") : t("messaging.unknownPeer"));
    const invitationStatus = getInvitationInboxStatusCopy(request.status, isOutgoing);
    const preview = request.lastMessagePreview.trim();
    const isPending = !request.status || request.status === "pending";

    return (
        <button
            type="button"
            className={cn(
                "w-full rounded-2xl border border-black/5 bg-white px-3 py-3 text-left transition-colors hover:bg-zinc-50 dark:border-white/5 dark:bg-zinc-900 dark:hover:bg-zinc-800/80",
            )}
            onClick={() => onSelect(request.peerPublicKeyHex)}
        >
            <div className="flex items-center gap-3">
                <UserAvatar
                    pubkey={request.peerPublicKeyHex}
                    metadataLive={false}
                    size="md"
                    className="shrink-0 rounded-xl"
                    showProfileOnClick={false}
                />

                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                {displayName}
                            </span>
                            {isPending && isOutgoing ? (
                                <span className="shrink-0 rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-purple-700 dark:text-purple-300">
                                    Sent
                                </span>
                            ) : isPending ? (
                                <span className="shrink-0 rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                                    New
                                </span>
                            ) : (
                                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", invitationToneClassName(invitationStatus.tone))}>
                                    {invitationStatus.badge}
                                </span>
                            )}
                        </div>
                        <span className="shrink-0 text-[10px] text-zinc-400 whitespace-nowrap">
                            {formatTime(new Date(request.lastReceivedAtUnixSeconds * 1000), nowMs)}
                        </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                        {preview
                            || (isOutgoing && (request.status === "declined" || request.status === "canceled")
                                ? "Open to send a new request."
                                : isOutgoing
                                    ? "Waiting for their response."
                                    : "Open to review their note and decide.")}
                    </p>
                    {quarantinePeerSignal ? (
                        <p className="mt-1 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                            Anti-spam blocked {quarantinePeerSignal.count} extra attempt{quarantinePeerSignal.count === 1 ? "" : "s"}
                        </p>
                    ) : null}
                </div>

                {request.unreadCount > 0 ? (
                    <div className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5">
                        <span className="text-[10px] font-black text-white">{request.unreadCount}</span>
                    </div>
                ) : null}
            </div>
        </button>
    );
}

