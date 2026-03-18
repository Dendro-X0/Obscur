import React from "react";
import Image from "next/image";
import { Button } from "../../../components/ui/button";
import { useTranslation } from "react-i18next";
import type { Conversation } from "../types";
import { useResolvedProfileMetadata } from "../../profile/hooks/use-resolved-profile-metadata";
import { formatTime } from "../utils/formatting";

export interface ChatHeaderProps {
    conversation: Conversation;
    isOnline?: boolean;
    interactionStatus?: Readonly<{ lastActiveAtMs?: number; lastViewedAtMs?: number }>;
    nowMs?: number | null;
    onCopyPubkey: (pubkey: string) => void;
    onOpenMedia: () => void;
    onOpenInfo?: () => void;
}

export function ChatHeader({ conversation, isOnline = false, interactionStatus, nowMs, onCopyPubkey, onOpenMedia, onOpenInfo }: ChatHeaderProps) {
    const { t } = useTranslation();
    const metadata = useResolvedProfileMetadata(conversation.kind === "dm" ? conversation.pubkey : null);
    const resolvedName = metadata?.displayName || conversation.displayName;
    const resolvedNowMs = nowMs ?? Date.now();
    const lastActiveLabel = (
        interactionStatus?.lastActiveAtMs
            ? formatTime(new Date(interactionStatus.lastActiveAtMs), resolvedNowMs)
            : ""
    );
    const lastViewedLabel = (
        interactionStatus?.lastViewedAtMs
            ? formatTime(new Date(interactionStatus.lastViewedAtMs), resolvedNowMs)
            : ""
    );

    return (
        <div className="flex items-center justify-between border-b border-black/10 bg-white/60 px-4 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-black/60">
            <div className="flex items-center gap-3">
                <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-zinc-900 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
                    {metadata?.avatarUrl ? (
                        <Image src={metadata.avatarUrl} alt={resolvedName || "User"} width={36} height={36} className="h-full w-full object-cover" unoptimized />
                    ) : (
                        (resolvedName?.[0] || "?").toUpperCase()
                    )}
                    {conversation.kind === "dm" ? (
                        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-black ${isOnline ? "bg-emerald-500" : "bg-zinc-400 dark:bg-zinc-600"}`} />
                    ) : null}
                </div>
                <div>
                    <h2 className="font-bold tracking-tight">{resolvedName}</h2>
                    {conversation.kind === "dm" ? (
                        <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                            <span className="mr-2 inline-flex items-center gap-1.5">
                                <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? "bg-emerald-500" : "bg-zinc-400 dark:bg-zinc-600"}`} />
                                <span className={`font-bold uppercase tracking-wider ${isOnline ? "text-emerald-500" : "text-zinc-500"}`}>
                                    {isOnline ? "Online" : "Offline"}
                                </span>
                            </span>
                            {lastActiveLabel ? `Last active ${lastActiveLabel}` : "No recent activity"}
                            {lastViewedLabel ? ` | Last viewed ${lastViewedLabel}` : ""}
                        </p>
                    ) : null}
                    <div className="flex items-center gap-2">
                        {conversation.kind === "dm" ? (
                            <>
                                <p className="text-xs font-mono text-zinc-600 dark:text-zinc-400">{conversation.pubkey.slice(0, 16)}...</p>
                                <Button type="button" variant="secondary" className="px-2 py-1" onClick={() => onCopyPubkey(conversation.pubkey)}>
                                    {t("common.copy")}
                                </Button>
                            </>
                        ) : (
                            <p className="text-xs text-zinc-600 dark:text-zinc-400">
                                {t("messaging.membersCount", { count: conversation.memberPubkeys.length })}
                            </p>
                        )}
                        <Button type="button" variant="secondary" className="px-2 py-1" onClick={onOpenMedia}>
                            {t("messaging.media")}
                        </Button>
                        {conversation.kind === "group" && (
                            <Button type="button" variant="secondary" className="px-2 py-1" onClick={onOpenInfo}>
                                {t("common.info")}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

