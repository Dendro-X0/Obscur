"use client";

import type React from "react";
import { useTranslation } from "react-i18next";
import { Share2, Copy, Link as LinkIcon, Sparkles, Loader2, Info } from "lucide-react";
import { Card } from "@dweb/ui-kit";
import { Button } from "@dweb/ui-kit";
import { cn } from "@/app/lib/utils";

interface EmptyConversationViewProps {
    showWelcome: boolean;
    myPublicKeyHex: string | null;
    relayStatus: { openCount: number; total: number };
    onCopyMyPubkey: () => void;
    onCopyChatLink: () => void;
    onNewChat?: () => void;
    showHistorySyncNotice?: boolean;
}

export const EmptyConversationView: React.FC<EmptyConversationViewProps> = ({
    showWelcome,
    myPublicKeyHex,
    relayStatus,
    onCopyMyPubkey,
    onCopyChatLink,
    onNewChat,
    showHistorySyncNotice = false,
}) => {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col flex-1 h-full w-full items-center justify-center p-8 bg-transparent">
            <div className="w-full max-w-lg flex flex-col items-center justify-center text-center relative gap-8">
                {showWelcome && (
                    <div className="relative group animate-in fade-in zoom-in-95 duration-1000 ease-out w-full">
                        <div className="absolute -inset-1 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-[42px] blur opacity-40 group-hover:opacity-75 transition duration-1000 group-hover:duration-200 pointer-events-none"></div>
                        <div className="relative p-10 rounded-[40px] bg-white/40 dark:bg-black/40 border border-black/5 dark:border-white/5 backdrop-blur-3xl shadow-2xl overflow-hidden w-full">
                            <div className="absolute top-0 right-0 p-4 opacity-20">
                                <Sparkles className="h-12 w-12 text-purple-500" />
                            </div>
                            <h1 className="text-5xl font-black bg-gradient-to-br from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-500 bg-clip-text text-transparent mb-4 tracking-tighter">
                                Welcome home.
                            </h1>
                            <p className="text-zinc-500 dark:text-zinc-400 text-xl font-medium tracking-tight leading-relaxed max-w-xs mx-auto">
                                Your sanctuary is secure and ready for you.
                            </p>
                        </div>
                    </div>
                )}

                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300 w-full flex flex-col items-center">
                    <div className={cn(
                        "w-full rounded-2xl border p-4 text-left",
                        showHistorySyncNotice
                            ? "border-indigo-500/20 bg-indigo-500/10"
                            : "border-zinc-500/20 bg-zinc-500/10"
                    )}>
                        <div className={cn(
                            "flex items-center gap-2",
                            showHistorySyncNotice
                                ? "text-indigo-800 dark:text-indigo-200"
                                : "text-zinc-700 dark:text-zinc-200"
                        )}>
                            {showHistorySyncNotice ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Info className="h-4 w-4" />
                            )}
                            <span className="text-xs font-black uppercase tracking-widest">
                                {showHistorySyncNotice ? "Syncing account history" : "Missing contacts or chat history?"}
                            </span>
                        </div>
                        <p className={cn(
                            "mt-2 text-xs font-medium leading-relaxed",
                            showHistorySyncNotice
                                ? "text-indigo-900/90 dark:text-indigo-100/90"
                                : "text-zinc-800/90 dark:text-zinc-100/90"
                        )}>
                            {t(
                                "messaging.historySyncWaitHint",
                                "If you do not see contacts or chat history yet, please wait a few minutes while loading and account data synchronization completes."
                            )}
                        </p>
                    </div>
                    <div className="flex justify-center">
                        <div className="group relative">
                            <div className="absolute -inset-2 bg-purple-500/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" aria-hidden="true"></div>
                            <button
                                type="button"
                                className="relative z-10 flex h-20 w-20 items-center justify-center rounded-3xl border border-black/5 bg-white text-3xl dark:border-white/5 dark:bg-zinc-900/60 shadow-xl shadow-black/5 transition-transform hover:scale-105 active:scale-95 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                                onClick={onNewChat}
                                aria-label="Start a new conversation"
                            >
                                <span className="bg-gradient-to-br from-purple-500 to-blue-500 bg-clip-text text-transparent">+</span>
                            </button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">
                            {t("messaging.selectConversation")}
                        </h2>
                        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
                            {t("messaging.selectConversationDesc")}
                        </p>
                    </div>
                </div>

                {myPublicKeyHex ? (
                    <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500">
                        <Card
                            className="w-full border-purple-500/10 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl"
                        >
                            <div className="space-y-5 text-left">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                                        <Share2 className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold tracking-tight">{t("messaging.share")}</h3>
                                        <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{t("messaging.shareDesc")}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={onCopyMyPubkey}
                                        className="h-11 rounded-2xl group"
                                    >
                                        <Copy className="h-4 w-4 mr-2 opacity-50 group-hover:opacity-100 transition-opacity" />
                                        <span className="text-xs font-bold">{t("messaging.copyPubkey")}</span>
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={onCopyChatLink}
                                        className="h-11 rounded-2xl group"
                                    >
                                        <LinkIcon className="h-4 w-4 mr-2 opacity-50 group-hover:opacity-100 transition-opacity" />
                                        <span className="text-xs font-bold">{t("messaging.copyChatLink")}</span>
                                    </Button>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5">
                                    <div className="flex items-center gap-2">
                                        <div className={cn("h-1.5 w-1.5 rounded-full animate-pulse", relayStatus.openCount > 0 ? "bg-emerald-500 shadow-[0_0_8px_oklch(0.6_0.2_150_/_0.5)]" : "bg-red-500")} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                                            Relays: {relayStatus.openCount}/{relayStatus.total} Online
                                        </span>
                                    </div>
                                    <div className="text-[10px] font-medium text-zinc-400 italic">
                                        {t("messaging.pubkeySafeShare")}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                ) : null}
            </div>
        </div>
    );
};
