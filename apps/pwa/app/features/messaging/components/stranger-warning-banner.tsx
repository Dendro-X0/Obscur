"use client";

import React from "react";
import { ShieldAlert, Check, X, ShieldOff } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { useTranslation } from "react-i18next";

interface StrangerWarningBannerProps {
    displayName: string;
    onAccept: () => void;
    onIgnore: () => void;
    onBlock: () => void;
}

export function StrangerWarningBanner({
    displayName,
    onAccept,
    onIgnore,
    onBlock,
}: StrangerWarningBannerProps) {
    const { t } = useTranslation();

    return (
        <div className="bg-amber-50 dark:bg-amber-950/20 border-y border-amber-200/50 dark:border-amber-900/30 px-4 py-3 sm:px-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                        <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="space-y-1">
                        <h4 className="text-sm font-bold text-amber-900 dark:text-amber-100 leading-tight">
                            {t("messaging.strangerWarningTitle", { name: displayName })}
                        </h4>
                        <p className="text-[11px] text-amber-800/70 dark:text-amber-300/60 leading-normal max-w-lg">
                            {t("messaging.strangerWarningDesc")}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button
                        size="sm"
                        className="flex-1 sm:flex-initial h-8 bg-amber-600 hover:bg-amber-700 text-white border-none text-[11px] font-bold px-4"
                        onClick={onAccept}
                    >
                        <Check className="mr-1.5 h-3.5 w-3.5" />
                        {t("common.accept")}
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1 sm:flex-initial h-8 text-[11px] font-bold px-4 bg-white dark:bg-zinc-900"
                        onClick={onIgnore}
                    >
                        <X className="mr-1.5 h-3.5 w-3.5" />
                        {t("common.ignore")}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-amber-800/50 hover:text-red-600 hover:bg-red-50 dark:text-amber-300/40 dark:hover:text-red-400 dark:hover:bg-red-900/20"
                        onClick={onBlock}
                        title={t("common.block")}
                    >
                        <ShieldOff className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
