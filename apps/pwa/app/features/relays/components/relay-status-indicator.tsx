"use client";

import React from "react";
import { useRelayPool } from "../hooks/use-relay-pool";
import { cn } from "@/app/lib/utils";
import { Activity, Radio } from "lucide-react";
import { useTranslation } from "react-i18next";

export function RelayStatusIndicator() {
    const { t } = useTranslation();
    // Default relays if none provided? Normally the app has a standard set.
    const pool = useRelayPool([]);

    const openStates = pool.connections.filter(c => c.status === "open").length;
    const totalCount = pool.connections.length;
    const isConnected = openStates > 0;

    return (
        <div className="flex items-center gap-2 px-4 py-2">
            <div className="relative">
                <Radio className={cn(
                    "h-3.5 w-3.5",
                    isConnected ? "text-emerald-500" : "text-zinc-400"
                )} />
                {isConnected && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    </span>
                )}
            </div>
            <div className="flex flex-col">
                <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 leading-none">
                    {isConnected ? t("relays.connected") : t("relays.connecting")}
                </span>
                <span className="text-[9px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                    {openStates}/{totalCount} {t("relays.active_relays")}
                </span>
            </div>
        </div>
    );
}
