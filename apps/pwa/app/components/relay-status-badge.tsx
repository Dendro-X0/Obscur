"use client";

import React, { useMemo } from "react";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { cn } from "@/app/lib/utils";
import { Wifi, WifiOff } from "lucide-react";
import { deriveRelayRuntimeStatus } from "@/app/features/relays/lib/relay-runtime-status";

/**
 * RelayStatusBadge component
 * Shows real-time connection health to Nostr relays.
 */
export function RelayStatusBadge() {
    const { relayPool: pool, enabledRelayUrls } = useRelay();
    const openCount = pool.connections.filter((c) => c.status === "open").length;
    const totalCount = enabledRelayUrls.length;
    const runtimeStatus = useMemo(
        () => deriveRelayRuntimeStatus({ openCount, totalCount }),
        [openCount, totalCount]
    );

    return (
        <div
            title={`${runtimeStatus.label} ${openCount}/${totalCount}. ${runtimeStatus.actionText}`}
            className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 transition-colors"
        >
            <div className={cn(
                "h-1.5 w-1.5 rounded-full",
                runtimeStatus.status === "healthy"
                    ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                    : runtimeStatus.status === "degraded"
                        ? "bg-amber-500 animate-pulse"
                        : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
            )} />
            <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 tabular-nums">
                {openCount}/{totalCount}
            </span>
            {runtimeStatus.status === "unavailable" ? (
                <WifiOff className="h-2.5 w-2.5 text-red-500" />
            ) : (
                <Wifi className={cn("h-2.5 w-2.5", runtimeStatus.status === "healthy" ? "text-emerald-500" : "text-amber-500")} />
            )}
        </div>
    );
}
