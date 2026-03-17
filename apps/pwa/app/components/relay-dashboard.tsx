"use client";

import React, { useMemo } from 'react';
import type { RelayHealthMetrics } from '@/app/features/relays/hooks/relay-health-monitor';
import { Activity, Zap, ShieldAlert, WifiOff } from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useRelay } from '@/app/features/relays/providers/relay-provider';
import { deriveRelayNodeStatus } from '@/app/features/relays/lib/relay-runtime-status';

/**
 * Relay Dashboard component
 * Provides an interactive visualization of relay health and performance.
 */
export function RelayDashboard(): React.JSX.Element {
    const { enabledRelayUrls, relayPool, relayRuntime } = useRelay();
    const metrics = useMemo(
        () => new Map<string, RelayHealthMetrics>(relayPool.healthMetrics.map((entry) => [entry.url, entry])),
        [relayPool.healthMetrics],
    );

    const relayUrls = Array.from(new Set([
        ...Array.from(metrics.keys()),
        ...enabledRelayUrls,
        ...relayPool.connections.map((connection) => connection.url),
        ...relayRuntime.fallbackRelayUrls,
    ]));

    if (relayUrls.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500 animate-in fade-in duration-500">
                <WifiOff className="h-10 w-10 mb-4 opacity-20" />
                <p className="text-sm">No relay metrics available yet.</p>
                <p className="text-xs opacity-60">Connections must be active to track health.</p>
            </div>
        );
    }

    return (
            <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {relayUrls.map((relayUrl) => (
                    <RelayMetricCard
                        key={relayUrl}
                        url={relayUrl}
                        metrics={metrics.get(relayUrl)}
                    />
                ))}
            </div>
        </div>
    );
}

function RelayMetricCard({ url, metrics }: { url: string; metrics?: RelayHealthMetrics }) {
    const { enabledRelayUrls, relayPool, relayRuntime } = useRelay();
    const connection = relayPool.connections.find((entry) => entry.url === url);
    const derivedStatus = deriveRelayNodeStatus({
        url,
        enabled: enabledRelayUrls.includes(url) || relayRuntime.fallbackRelayUrls.includes(url),
        connection,
        metrics,
        isConfigured: enabledRelayUrls.includes(url),
        isFallback: relayRuntime.fallbackRelayUrls.includes(url),
        runtimePhase: relayRuntime.phase,
        lastInboundEventAtUnixMs: relayRuntime.lastInboundEventAtUnixMs,
    });
    const latencyLabel = metrics && Number.isFinite(metrics.latency) && metrics.latency > 0
        ? `${Math.round(metrics.latency)}ms`
        : "n/a";
    const sampleCount = metrics ? metrics.successfulConnections + metrics.failedConnections : 0;
    const latencyHistory = metrics?.latencyHistory ?? [];
    const hasLatencySamples = latencyHistory.length > 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl border border-black/5 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-white/5 dark:bg-zinc-900/40"
        >
            {/* Background Pulse for active connections */}
            {connection?.status === 'open' && derivedStatus.status === 'healthy' && (
                <div className="absolute top-0 right-0 h-1 w-full bg-emerald-500/20">
                    <motion.div
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="h-full w-1/3 bg-emerald-500/40 blur-sm"
                    />
                </div>
            )}

            <div className="flex items-start justify-between mb-4">
                <div className="min-w-0">
                    <h4 className="truncate font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        {url.replace('wss://', '')}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={cn(
                            "h-1.5 w-1.5 rounded-full animate-pulse",
                            derivedStatus.status === 'healthy' ? "bg-emerald-500" :
                                derivedStatus.status === 'recovering' ? "bg-sky-500" :
                                    derivedStatus.status === 'degraded' ? "bg-amber-500" : "bg-red-500"
                        )} />
                        <span className="text-[10px] uppercase tracking-wider font-bold opacity-60">
                            {derivedStatus.badge}
                        </span>
                        <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                            {derivedStatus.roleLabel}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                    <Zap className={cn("h-3 w-3", metrics && metrics.latency < 200 ? "text-emerald-500" : "text-amber-500")} />
                    <span className="text-[10px] font-mono font-bold">
                        {latencyLabel}
                    </span>
                </div>
            </div>

            <div className="space-y-4">
                {/* Latency History Sparkline */}
                <div className="space-y-1">
                    <div className="flex justify-between items-center text-[9px] uppercase tracking-tighter font-bold opacity-40">
                        <span>Latency History</span>
                        <span>{hasLatencySamples ? "Last samples" : `No samples (${sampleCount})`}</span>
                    </div>
                    <div className="flex items-end gap-0.5 h-8 w-full group">
                        {hasLatencySamples ? (
                            latencyHistory.map((l, i) => {
                                const height = Math.min(100, (l / 1000) * 100);
                                return (
                                    <motion.div
                                        key={i}
                                        initial={{ scaleY: 0 }}
                                        animate={{ scaleY: 1 }}
                                        style={{ height: `${Math.max(10, height)}%` }}
                                        className={cn(
                                            "flex-1 rounded-t-[1px] transition-colors",
                                            l < 200 ? "bg-emerald-500/40 group-hover:bg-emerald-500" :
                                                l < 500 ? "bg-amber-500/40 group-hover:bg-amber-500" : "bg-red-500/40 group-hover:bg-red-500"
                                        )}
                                    />
                                );
                            })
                        ) : (
                            <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-zinc-200 text-[9px] font-medium text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
                                No latency samples yet
                            </div>
                        )}
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-black/5 bg-zinc-50/50 p-2 dark:border-white/5 dark:bg-zinc-950/30">
                        <div className="text-[9px] uppercase opacity-40 font-bold mb-1">Success Rate</div>
                        <div className="flex items-baseline gap-1">
                            <span className={cn(
                                "text-sm font-bold font-mono",
                                derivedStatus.status === "healthy" ? "text-emerald-600" : derivedStatus.status === "degraded" ? "text-amber-600" : "text-zinc-500"
                            )}>
                                {derivedStatus.successLabel}
                            </span>
                        </div>
                        <div className="mt-1 text-[9px] opacity-50 font-bold">{derivedStatus.confidenceLabel}</div>
                    </div>
                    <div className="rounded-xl border border-black/5 bg-zinc-50/50 p-2 dark:border-white/5 dark:bg-zinc-950/30">
                        <div className="text-[9px] uppercase opacity-40 font-bold mb-1">Stability</div>
                        <div className="flex items-center gap-1">
                            {metrics?.circuitBreakerState === 'closed' || !metrics ? (
                                <>
                                    <Activity className={cn("h-3 w-3", derivedStatus.status === "healthy" ? "text-emerald-500" : derivedStatus.status === "recovering" ? "text-sky-500" : "text-amber-500")} />
                                    <span className="text-[10px] font-bold">{derivedStatus.badge}</span>
                                </>
                            ) : (
                                <>
                                    <ShieldAlert className="h-3 w-3 text-amber-500" />
                                    <span className="text-[10px] font-bold uppercase">{metrics.circuitBreakerState}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-black/5 bg-zinc-50/50 p-2 text-[10px] leading-relaxed text-zinc-500 dark:border-white/5 dark:bg-zinc-950/30 dark:text-zinc-400">
                    {derivedStatus.detail}
                </div>

                {/* Error Message if any */}
                <AnimatePresence>
                    {metrics?.lastError && metrics.status === 'error' && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="mt-2 rounded-lg bg-red-50 p-2 dark:bg-red-900/10 overflow-hidden"
                        >
                            <p className="text-[9px] text-red-600 dark:text-red-400 font-medium leading-tight line-clamp-2">
                                {metrics.lastError}
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}
