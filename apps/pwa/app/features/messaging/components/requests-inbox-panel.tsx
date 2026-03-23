"use client";

import React from "react";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { MessageSquare, Check, X, ShieldAlert, BadgeInfo, UserPlus, Trash2 } from "lucide-react";
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
    requests: ReadonlyArray<RequestItem>;
    nowMs: number;
    onAccept: (pubkey: PublicKeyHex) => void;
    onIgnore: (pubkey: PublicKeyHex) => void;
    onBlock: (pubkey: PublicKeyHex) => void;
    onSelect: (pubkey: PublicKeyHex) => void;
    onFindSomeone?: () => void;
    onClearHistory?: () => void;
}

export function RequestsInboxPanel({ requests, nowMs, onAccept, onIgnore, onBlock, onSelect, onFindSomeone, onClearHistory }: RequestsInboxPanelProps) {
    const { t } = useTranslation();
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
                <h3 className="text-sm font-black uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-300">No open invitations</h3>
                <p className="mt-3 max-w-[240px] text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                    When someone reaches out, their invitation will show up here with their note and clear actions.
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
                        Invitations ({requests.length})
                    </h2>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        Obscur only lists invitations here after incoming relay evidence is received.
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
                            </div>
                            {quarantineSummary.recent.length > 0 && (
                                <div className="mt-2 space-y-1">
                                    {quarantineSummary.recent.slice(0, 3).map((entry, index) => (
                                        <p key={`${entry.atUnixMs}-${index}`} className="text-[10px] leading-relaxed opacity-90">
                                            {(entry.peerPrefix ?? "unknown sender").slice(0, 8)}... {quarantineReasonLabel(entry.reasonCode)} · {formatTime(new Date(entry.atUnixMs), nowMs)}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
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
                            Invitations appear here after the app has real incoming evidence, not just a sender-side claim.
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
                        onAccept={onAccept}
                        onIgnore={onIgnore}
                        onBlock={onBlock}
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
            | "incoming_connection_request_global_rate_limited";
        lastAtUnixMs: number;
    }> | null;
    nowMs: number;
    onAccept: (pubkey: PublicKeyHex) => void;
    onIgnore: (pubkey: PublicKeyHex) => void;
    onBlock: (pubkey: PublicKeyHex) => void;
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
): string => {
    if (reasonCode === "incoming_connection_request_peer_rate_limited") {
        return "sender rate-limited";
    }
    if (reasonCode === "incoming_connection_request_peer_cooldown_active") {
        return "sender cooldown active";
    }
    return "global anti-spam limit";
};

function RequestItemRow({ request, quarantinePeerSignal, nowMs, onAccept, onIgnore, onBlock, onSelect }: RequestItemRowProps) {
    const { t } = useTranslation();
    const metadata = useProfileMetadata(request.peerPublicKeyHex, { live: false });
    const isOutgoing = !!request.isOutgoing;
    const displayName = metadata?.displayName || (request.isRequest ? t("messaging.newConnection") : t("messaging.unknownPeer"));
    const invitationStatus = getInvitationInboxStatusCopy(request.status, isOutgoing);
    const preview = request.lastMessagePreview.trim();

    return (
        <Card className="border-black/5 bg-white p-4 dark:border-white/5 dark:bg-zinc-900">
            <div className="flex items-start gap-3">
                <UserAvatar
                    pubkey={request.peerPublicKeyHex}
                    metadataLive={false}
                    size="md"
                    className="shrink-0 rounded-xl"
                    showProfileOnClick={false}
                />

                <div className="flex-1 min-w-0" onClick={() => onSelect(request.peerPublicKeyHex)}>
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 overflow-hidden">
                            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                {displayName}
                            </span>
                            {request.isRequest && (
                                <span className="shrink-0 flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-tight text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                                    <UserPlus className="h-3.5 w-3.5" />
                                    Invitation
                                </span>
                            )}
                        </div>
                        <span className="text-[10px] text-zinc-400 whitespace-nowrap">
                            {formatTime(new Date(request.lastReceivedAtUnixSeconds * 1000), nowMs)}
                        </span>
                    </div>
                    <div className={cn("mt-2 rounded-2xl border px-3 py-2", invitationToneClassName(invitationStatus.tone))}>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em]">{invitationStatus.badge}</p>
                        <p className="mt-1 text-xs leading-relaxed">{invitationStatus.detail}</p>
                    </div>
                    {quarantinePeerSignal && (
                        <div className="mt-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[10px] text-amber-700 dark:text-amber-300">
                            <p className="font-black uppercase tracking-[0.14em]">Anti-spam signal</p>
                            <p className="mt-1 leading-relaxed">
                                Additional request attempts from this sender were blocked ({quarantineReasonLabel(quarantinePeerSignal.latestReasonCode)} x{quarantinePeerSignal.count}).
                            </p>
                        </div>
                    )}
                    <p className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                        {isOutgoing ? "Your note" : "Their note"}
                    </p>
                    <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                        {preview || "No note was included with this invitation."}
                    </p>
                    <p className="text-[10px] text-zinc-400 mt-1 font-mono opacity-50">
                        {request.peerPublicKeyHex.slice(0, 8)}...
                    </p>
                </div>

                {request.unreadCount > 0 ? (
                    <div className="h-5 min-w-5 rounded-full bg-red-500 px-1.5 flex items-center justify-center">
                        <span className="text-[10px] font-black text-white">{request.unreadCount}</span>
                    </div>
                ) : (
                    <div className="h-5 min-w-5 flex items-center justify-center">
                        <div className="h-2 w-2 rounded-full bg-zinc-400 shadow-sm" />
                    </div>
                )}
            </div>

            {request.status && request.status !== 'pending' ? (
                <div className={cn(
                    "mt-4 rounded-2xl border p-3 text-left",
                    invitationToneClassName(invitationStatus.tone)
                )}>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em]">{invitationStatus.badge}</p>
                    <p className="mt-1 text-sm font-semibold">{invitationStatus.title}</p>
                    <p className="mt-1 text-xs leading-relaxed opacity-90">{invitationStatus.detail}</p>
                </div>
            ) : isOutgoing ? (
                <div className={cn(
                    "mt-4 rounded-2xl border p-3 text-left",
                    invitationToneClassName(invitationStatus.tone)
                )}>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em]">{invitationStatus.badge}</p>
                    <p className="mt-1 text-sm font-semibold">Waiting for their response</p>
                    <p className="mt-1 text-xs leading-relaxed opacity-90">
                        Obscur has already sent this invitation. You do not need to accept your own request.
                    </p>
                </div>
            ) : (
                <div className="mt-4 flex gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1 h-11 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white border-none text-[11px] font-bold rounded-xl"
                        onClick={() => onAccept(request.peerPublicKeyHex)}
                    >
                        <Check className="mr-1.5 h-7 w-7" /> {t("common.accept")}
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        className="h-11 w-11 p-0 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-xl"
                        onClick={() => onIgnore(request.peerPublicKeyHex)}
                        title={t("common.ignore")}
                    >
                        <X className="h-7 w-7" />
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        className="h-11 w-11 p-0 text-zinc-400 hover:text-red-500 rounded-xl"
                        onClick={() => onBlock(request.peerPublicKeyHex)}
                        title={t("common.blockAndReport")}
                    >
                        <ShieldAlert className="h-7 w-7" />
                    </Button>
                </div>
            )}
        </Card>
    );
}
