import React from "react";
import Image from "next/image";
import { Button } from "../../../components/ui/button";
import { useTranslation } from "react-i18next";
import type { Conversation } from "../types";
import { useProfileMetadata } from "../../profile/hooks/use-profile-metadata";

export interface ChatHeaderProps {
    conversation: Conversation;
    onCopyPubkey: (pubkey: string) => void;
    onOpenMedia: () => void;
    onOpenInfo?: () => void;
}

export function ChatHeader({ conversation, onCopyPubkey, onOpenMedia, onOpenInfo }: ChatHeaderProps) {
    const { t } = useTranslation();
    const metadata = useProfileMetadata(conversation.kind === "dm" ? conversation.pubkey : null);
    const resolvedName = metadata?.displayName || conversation.displayName;

    return (
        <div className="flex items-center justify-between border-b border-black/10 bg-white px-4 py-3 dark:border-white/10 dark:bg-black">
            <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900 overflow-hidden">
                    {metadata?.avatarUrl ? (
                        <Image src={metadata.avatarUrl} alt={resolvedName} width={36} height={36} className="h-full w-full object-cover" unoptimized />
                    ) : (
                        resolvedName[0]?.toUpperCase()
                    )}
                </div>
                <div>
                    <h2 className="font-bold tracking-tight">{resolvedName}</h2>
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
