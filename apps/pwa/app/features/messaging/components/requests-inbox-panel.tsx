"use client";

import React from "react";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { User, MessageSquare, Check, X, ShieldAlert, BadgeInfo, UserPlus } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/app/components/ui/avatar";
import { cn } from "@/app/lib/utils";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { formatTime } from "../utils/formatting";
import { useTranslation } from "react-i18next";

import type { ConnectionRequestStatusValue } from "../../messaging/types";

type RequestItem = Readonly<{
    peerPublicKeyHex: PublicKeyHex;
    lastMessagePreview: string;
    lastReceivedAtUnixSeconds: number;
    unreadCount: number;
    status?: ConnectionRequestStatusValue;
    isRequest?: boolean;
}>;

interface RequestsInboxPanelProps {
    requests: ReadonlyArray<RequestItem>;
    nowMs: number;
    onAccept: (pubkey: PublicKeyHex) => void;
    onIgnore: (pubkey: PublicKeyHex) => void;
    onBlock: (pubkey: PublicKeyHex) => void;
    onSelect: (pubkey: PublicKeyHex) => void;
    onFindSomeone?: () => void;
}

export function RequestsInboxPanel({ requests, nowMs, onAccept, onIgnore, onBlock, onSelect, onFindSomeone }: RequestsInboxPanelProps) {
    const { t } = useTranslation();

    if (requests.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center opacity-60">
                <div className="mb-4 rounded-full bg-zinc-100 dark:bg-zinc-800 p-4 ring-1 ring-black/5 dark:ring-white/5">
                    <MessageSquare className="h-8 w-8 text-zinc-400" />
                </div>
                <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider">{t("messaging.noPendingRequests")}</h3>
                <p className="mt-2 text-xs text-zinc-400 max-w-[200px] leading-relaxed">
                    {t("messaging.noPendingRequestsDesc")}
                </p>
                {onFindSomeone && (
                    <Button
                        variant="secondary"
                        size="sm"
                        className="mt-6 dark:bg-zinc-800"
                        onClick={onFindSomeone}
                    >
                        {t("invites.findPeople")}
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-black/5 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
                <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400">
                    {t("messaging.pendingRequests")} ({requests.length})
                </h2>
                <div className="group relative">
                    <BadgeInfo className="h-4 w-4 text-zinc-400 cursor-help" />
                    <div className="absolute top-6 right-0 w-48 p-2 rounded-lg bg-white dark:bg-zinc-800 shadow-xl border border-black/5 dark:border-white/5 text-[10px] text-zinc-500 dark:text-zinc-400 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                        {t("messaging.pendingRequestsHelp")}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-2">
                {requests.map((request) => (
                    <Card key={request.peerPublicKeyHex} className="p-3 bg-white dark:bg-zinc-900 border-black/5 dark:border-white/5 hover:border-purple-500/30 transition-colors">
                        <div className="flex items-start gap-3">
                            <Avatar className="h-10 w-10 shrink-0 rounded-xl">
                                <AvatarFallback className="rounded-xl">
                                    <User className="h-5 w-5 text-zinc-400" />
                                </AvatarFallback>
                            </Avatar>

                            <div className="flex-1 min-w-0" onClick={() => onSelect(request.peerPublicKeyHex)}>
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                            {request.isRequest ? t("messaging.newConnection") : t("messaging.unknownPeer")}
                                        </span>
                                        {request.isRequest && (
                                            <span className="shrink-0 flex items-center gap-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tight">
                                                <UserPlus className="h-2.5 w-2.5" />
                                                {t("messaging.requestBadge")}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-zinc-400 whitespace-nowrap">
                                        {formatTime(new Date(request.lastReceivedAtUnixSeconds * 1000), nowMs)}
                                    </span>
                                </div>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-0.5 leading-relaxed italic">
                                    {request.lastMessagePreview}
                                </p>
                                <p className="text-[10px] text-zinc-400 mt-1 font-mono opacity-50">
                                    {request.peerPublicKeyHex.slice(0, 8)}...
                                </p>
                            </div>

                            {request.unreadCount > 0 && (
                                <div className="h-5 min-w-5 rounded-full bg-purple-600 px-1.5 flex items-center justify-center">
                                    <span className="text-[10px] font-black text-white">{request.unreadCount}</span>
                                </div>
                            )}
                        </div>

                        {request.status && request.status !== 'pending' ? (
                            <div className={cn(
                                "mt-4 p-2 rounded-lg text-center text-[10px] font-bold uppercase tracking-widest",
                                request.status === 'accepted' ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30" : "bg-rose-50 text-rose-600 dark:bg-rose-950/30"
                            )}>
                                {t(`messaging.status.${request.status}`)}
                            </div>
                        ) : (
                            <div className="mt-4 flex gap-2">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    className="flex-1 h-8 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white border-none text-[10px] font-bold"
                                    onClick={() => onAccept(request.peerPublicKeyHex)}
                                >
                                    <Check className="mr-1 h-3 w-3" /> {t("common.accept")}
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                                    onClick={() => onIgnore(request.peerPublicKeyHex)}
                                    title={t("common.ignore")}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-zinc-400 hover:text-red-500"
                                    onClick={() => onBlock(request.peerPublicKeyHex)}
                                    title={t("common.blockAndReport")}
                                >
                                    <ShieldAlert className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </Card>
                ))}
            </div>
        </div>
    );
}
