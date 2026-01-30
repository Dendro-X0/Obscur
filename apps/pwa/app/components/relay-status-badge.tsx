"use client";

import React, { useMemo } from "react";
import { useRelayList } from "@/app/features/relays/hooks/use-relay-list";
import { useRelayPool } from "@/app/features/relays/hooks/use-relay-pool";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { cn } from "@/app/lib/utils";
import { Wifi, WifiOff } from "lucide-react";

/**
 * RelayStatusBadge component
 * Shows real-time connection health to Nostr relays.
 */
export function RelayStatusBadge() {
    const identity = useIdentity();
    const publicKeyHex = identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? null;
    const relayList = useRelayList({ publicKeyHex });

    const enabledRelayUrls = useMemo(() => {
        return relayList.state.relays
            .filter((r) => r.enabled)
            .map((r) => r.url);
    }, [relayList.state.relays]);

    const pool = useRelayPool(enabledRelayUrls);

    const openCount = pool.connections.filter((c) => c.status === "open").length;
    const totalCount = enabledRelayUrls.length;

    const status = totalCount === 0 ? "none" :
        openCount === totalCount ? "all" :
            openCount > 0 ? "some" : "error";

    return (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 transition-colors">
            <div className={cn(
                "h-1.5 w-1.5 rounded-full",
                status === "all" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" :
                    status === "some" ? "bg-amber-500 animate-pulse" :
                        status === "none" ? "bg-zinc-400" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
            )} />
            <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 tabular-nums">
                {openCount}/{totalCount}
            </span>
            {status === "error" ? (
                <WifiOff className="h-2.5 w-2.5 text-red-500" />
            ) : (
                <Wifi className={cn("h-2.5 w-2.5", status === "all" ? "text-emerald-500" : "text-zinc-400")} />
            )}
        </div>
    );
}
