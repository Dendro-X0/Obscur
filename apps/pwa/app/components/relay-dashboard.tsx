"use client";

import React, { useEffect, useState } from 'react';
import { relayHealthMonitor, type RelayHealthMetrics } from '@/app/features/relays/hooks/relay-health-monitor';
import { Activity, Zap, ShieldAlert, BarChart3, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Relay Dashboard component
 * Provides an interactive visualization of relay health and performance.
 */
export function RelayDashboard(): React.JSX.Element {
    const [metrics, setMetrics] = useState<Map<string, RelayHealthMetrics>>(relayHealthMonitor.getAllMetrics());

    useEffect(() => {
        return relayHealthMonitor.subscribe((newMetrics) => {
            setMetrics(new Map(newMetrics));
        });
    }, []);

    const relayList = Array.from(metrics.values());

    if (relayList.length === 0) {
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
                {relayList.map((relay) => (
                    <RelayMetricCard key={relay.url} metrics={relay} />
                ))}
            </div>
        </div>
    );
}

function RelayMetricCard({ metrics }: { metrics: RelayHealthMetrics }) {
    const status = metrics.status;
    const isHealthy = metrics.successRate > 90 && metrics.latency < 500;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl border border-black/5 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-white/5 dark:bg-zinc-900/40"
        >
            {/* Background Pulse for active connections */}
            {status === 'connected' && (
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
                        {metrics.url.replace('wss://', '')}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={cn(
                            "h-1.5 w-1.5 rounded-full animate-pulse",
                            status === 'connected' ? "bg-emerald-500" :
                                status === 'connecting' ? "bg-amber-500" : "bg-red-500"
                        )} />
                        <span className="text-[10px] uppercase tracking-wider font-bold opacity-60">
                            {status}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                    <Zap className={cn("h-3 w-3", metrics.latency < 200 ? "text-emerald-500" : "text-amber-500")} />
                    <span className="text-[10px] font-mono font-bold">
                        {Math.round(metrics.latency)}ms
                    </span>
                </div>
            </div>

            <div className="space-y-4">
                {/* Latency History Sparkline */}
                <div className="space-y-1">
                    <div className="flex justify-between items-center text-[9px] uppercase tracking-tighter font-bold opacity-40">
                        <span>Latency History</span>
                        <span>Last 10 polls</span>
                    </div>
                    <div className="flex items-end gap-0.5 h-8 w-full group">
                        {metrics.latencyHistory.length > 0 ? (
                            metrics.latencyHistory.map((l, i) => {
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
                            <div className="w-full border-b border-dashed border-zinc-200 dark:border-zinc-800" />
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
                                metrics.successRate > 90 ? "text-emerald-600" : "text-amber-600"
                            )}>
                                {Math.round(metrics.successRate)}%
                            </span>
                        </div>
                    </div>
                    <div className="rounded-xl border border-black/5 bg-zinc-50/50 p-2 dark:border-white/5 dark:bg-zinc-950/30">
                        <div className="text-[9px] uppercase opacity-40 font-bold mb-1">Stability</div>
                        <div className="flex items-center gap-1">
                            {metrics.circuitBreakerState === 'closed' ? (
                                <>
                                    <Activity className="h-3 w-3 text-emerald-500" />
                                    <span className="text-[10px] font-bold">Stable</span>
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

                {/* Error Message if any */}
                <AnimatePresence>
                    {metrics.lastError && metrics.status === 'error' && (
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
