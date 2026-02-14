"use client";

import React from "react";
import { ShieldAlert, Check, X, ShieldOff, UserPlus } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { useTranslation } from "react-i18next";

interface StrangerWarningBannerProps {
    displayName: string;
    isInitiator?: boolean;
    onAccept: () => void;
    onIgnore: () => void;
    onBlock: () => void;
}

export function StrangerWarningBanner({ displayName, isInitiator, onAccept, onIgnore, onBlock }: StrangerWarningBannerProps) {
    const { t } = useTranslation();

    if (isInitiator) {
        return (
            <div className="z-10 px-4 py-3 bg-gradient-to-r from-purple-500/10 via-purple-600/15 to-purple-500/10 backdrop-blur-md border-b border-purple-500/20 shadow-lg shadow-purple-500/5 transition-all duration-300">
                <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center text-purple-600 dark:text-purple-400">
                            <ShieldAlert className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold text-purple-900 dark:text-purple-100 leading-tight">
                                {t("messaging.waitingForAcceptanceTitle")}
                            </span>
                            <span className="text-xs text-purple-700/70 dark:text-purple-400/70">
                                {t("messaging.waitingForAcceptanceDesc", { name: displayName })}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="z-10 px-4 py-3 bg-gradient-to-r from-zinc-900/95 via-zinc-800/95 to-zinc-900/95 backdrop-blur-md border-b border-white/5 shadow-2xl transition-all duration-300">
            <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-zinc-800 dark:bg-zinc-700 flex items-center justify-center text-zinc-400">
                        <UserPlus className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-zinc-100 leading-tight">
                            {t("messaging.strangerWarningTitle", { name: displayName })}
                        </p>
                        <p className="text-xs text-zinc-400 mt-0.5">
                            {t("messaging.strangerWarningDesc")}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                        onClick={onIgnore}
                        className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold text-zinc-400 hover:text-zinc-100 hover:bg-white/5 rounded-xl transition-all active:scale-95"
                    >
                        {t("common.ignore")}
                    </button>
                    <button
                        onClick={onAccept}
                        className="flex-1 sm:flex-none px-6 py-2 text-xs font-black bg-purple-600 hover:bg-purple-500 text-white rounded-xl shadow-lg shadow-purple-600/20 transition-all active:scale-95"
                    >
                        {t("common.accept")}
                    </button>
                </div>
            </div>
        </div>
    );
}
