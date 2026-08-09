"use client";

import React, { useMemo } from 'react';
import type { RelayHealthMetrics } from '@/app/features/relays/hooks/relay-health-monitor';
import { Activity, Zap, ShieldAlert, WifiOff } from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useRelay } from '@/app/features/relays/providers/relay-provider';
import type { EnhancedRelayPoolResult } from '@/app/features/relays/hooks/enhanced-relay-pool-types';
import { deriveRelayNodeStatus, isRelayUrlPublishReady } from '@/app/features/relays/lib/relay-runtime-status';
import { shouldRenderRelayNodeRoleChip } from '@/app/features/relays/lib/relay-node-detail-copy';
import {
  formatRelayLatencyHistoryCaption,
  formatRelayLatencyLabel,
} from '@/app/features/relays/lib/format-relay-latency-label';
import type { RelayRuntimeSnapshot } from '@/app/features/relays/services/relay-runtime-contracts';
import type { RelaySettingsCategory } from '@/app/features/relays/services/relay-settings-node-filter';
import {
  isRelayNodeCurrentlyAvailable,
  relayMatchesSettingsCategory,
} from '@/app/features/relays/services/relay-settings-node-filter';
import { workspaceRelayIdentityKey, workspaceRelayUrlsMatch } from '@/app/features/groups/services/workspace-relay-url';
import { isPrivateOrIntranetRelayUrl } from '@/app/features/relays/services/relay-transport-scope';

const relayUrlsMatch = (left: string | null | undefined, right: string): boolean => (
    typeof left === "string"
    && left.length > 0
    && (left === right || workspaceRelayUrlsMatch(left, right))
);

const findPoolConnectionForUrl = <T extends { url: string }>(
    connections: ReadonlyArray<T>,
    url: string,
): T | undefined => (
    connections.find((entry) => entry.url === url || workspaceRelayUrlsMatch(entry.url, url))
);

const findMetricsForUrl = (
    metrics: ReadonlyMap<string, RelayHealthMetrics>,
    url: string,
): RelayHealthMetrics | undefined => {
    const exact = metrics.get(url);
    if (exact) {
        return exact;
    }
    for (const [key, value] of metrics.entries()) {
        if (workspaceRelayUrlsMatch(key, url)) {
            return value;
        }
    }
    return undefined;
};

const urlInRelaySet = (urls: ReadonlySet<string>, url: string): boolean => (
    urls.has(url) || Array.from(urls).some((entry) => workspaceRelayUrlsMatch(entry, url))
);

const dedupeRelayUrlsByIdentity = (urls: ReadonlyArray<string>): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const url of urls) {
        const key = workspaceRelayIdentityKey(url);
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        out.push(url);
    }
    return out;
};

/** Primary first, then enabled list order, then remaining URLs (sorted) for predictable triage. */
export const buildOrderedRelayDashboardUrls = (params: Readonly<{
    metricsKeys: ReadonlyArray<string>;
    enabledRelayUrls: ReadonlyArray<string>;
    connectionUrls: ReadonlyArray<string>;
    fallbackRelayUrls: ReadonlyArray<string>;
    primaryUrl: string | null | undefined;
}>): string[] => {
    const unique = dedupeRelayUrlsByIdentity([
        ...(typeof params.primaryUrl === "string" && params.primaryUrl.length > 0
            ? [params.primaryUrl]
            : []),
        ...params.enabledRelayUrls,
        ...params.metricsKeys,
        ...params.connectionUrls,
        ...params.fallbackRelayUrls,
    ]);
    const primary = typeof params.primaryUrl === "string" && params.primaryUrl.length > 0
        ? (unique.find((url) => relayUrlsMatch(params.primaryUrl, url)) ?? null)
        : null;
    const out: string[] = [];
    const remaining = new Set(unique);
    if (primary) {
        out.push(primary);
        remaining.delete(primary);
    }
    for (const url of params.enabledRelayUrls) {
        if (remaining.has(url)) {
            out.push(url);
            remaining.delete(url);
            continue;
        }
        const alias = Array.from(remaining).find((entry) => workspaceRelayUrlsMatch(entry, url));
        if (alias) {
            out.push(alias);
            remaining.delete(alias);
        }
    }
    const tail = Array.from(remaining).sort((a, b) => a.localeCompare(b));
    return [...out, ...tail];
};

/**
 * Relay Dashboard component
 * Provides an interactive visualization of relay health and performance.
 */
export type RelayDashboardFilterProps = Readonly<{
  category?: RelaySettingsCategory;
  availableOnly?: boolean;
}>;

export function RelayDashboard(params?: RelayDashboardFilterProps): React.JSX.Element {
    const category = params?.category ?? "all";
    const availableOnly = params?.availableOnly ?? false;
    const {
        enabledRelayUrls,
        communityCandidateRelayUrls,
        relayPool,
        relayRuntime,
        relaySelection,
        activePoolRelayUrls,
        relayList,
    } = useRelay();
    const activePoolSet = useMemo(
        () => new Set(activePoolRelayUrls),
        [activePoolRelayUrls],
    );
    const workspaceRelaySet = useMemo(
        () => new Set(communityCandidateRelayUrls ?? []),
        [communityCandidateRelayUrls],
    );
    const configuredRelays = relayList?.state?.relays ?? [];
    const configuredRelayUrls = useMemo(
        () => {
            const fromList = configuredRelays.map((relay) => relay.url);
            return fromList.length > 0 ? fromList : [...enabledRelayUrls, ...(communityCandidateRelayUrls ?? [])];
        },
        [configuredRelays, enabledRelayUrls, communityCandidateRelayUrls],
    );
    const configuredEnabledByUrl = useMemo(() => {
        const map = new Map<string, boolean>();
        for (const relay of configuredRelays) {
            map.set(relay.url, relay.enabled);
        }
        return map;
    }, [configuredRelays]);
    const metrics = useMemo(
        () => new Map<string, RelayHealthMetrics>(relayPool.healthMetrics.map((entry) => [entry.url, entry])),
        [relayPool.healthMetrics],
    );

    const relayUrls = useMemo(() => buildOrderedRelayDashboardUrls({
        metricsKeys: Array.from(metrics.keys()),
        // Full Settings list first so public standbys stay visible even when undialed.
        enabledRelayUrls: [
            ...configuredRelayUrls,
            ...enabledRelayUrls,
            ...(communityCandidateRelayUrls ?? []),
            ...(relayRuntime.engineConfiguredRelayUrls ?? []),
        ],
        connectionUrls: relayPool.connections.map((connection) => connection.url),
        fallbackRelayUrls: relayRuntime.fallbackRelayUrls,
        primaryUrl: relaySelection.primaryUrl,
    }), [
        metrics,
        configuredRelayUrls,
        enabledRelayUrls,
        communityCandidateRelayUrls,
        relayPool.connections,
        relayRuntime.fallbackRelayUrls,
        relayRuntime.engineConfiguredRelayUrls,
        relaySelection.primaryUrl,
    ]);

    const buildNodeStatusParams = (
        relayUrl: string,
        poolConnection: ReturnType<EnhancedRelayPoolResult["connections"]["find"]>,
    ) => {
        const isNostrTransport = enabledRelayUrls.some((url) => (
            url === relayUrl || workspaceRelayUrlsMatch(url, relayUrl)
        )) || (
            !isPrivateOrIntranetRelayUrl(relayUrl)
            && configuredRelayUrls.some((url) => url === relayUrl || workspaceRelayUrlsMatch(url, relayUrl))
        );
        const isWorkspaceNode = workspaceRelaySet.has(relayUrl)
            || Array.from(workspaceRelaySet).some((entry) => workspaceRelayUrlsMatch(entry, relayUrl));
        const listEnabled = configuredEnabledByUrl.get(relayUrl)
            ?? Array.from(configuredEnabledByUrl.entries()).find(([url]) => (
                workspaceRelayUrlsMatch(url, relayUrl)
            ))?.[1];
        const inActivePool = urlInRelaySet(activePoolSet, relayUrl);
        const isEnabled = listEnabled !== false && (
            listEnabled === true
            || isNostrTransport
            || isWorkspaceNode
            || relayRuntime.fallbackRelayUrls.includes(relayUrl)
        );
        const isPrimary = relayUrlsMatch(relaySelection.primaryUrl, relayUrl);
        const publishReadyUrls = relayPool.getTransportActivitySnapshot()?.publishReadyRelayUrls ?? [];
        return {
            url: relayUrl,
            enabled: isEnabled,
            connection: poolConnection,
            role: isPrimary
                ? "primary" as const
                : isNostrTransport
                    ? "standby" as const
                    : undefined,
            metrics: findMetricsForUrl(metrics, relayUrl),
            isConfigured: isNostrTransport || isWorkspaceNode || configuredRelayUrls.some((url) => (
                url === relayUrl || workspaceRelayUrlsMatch(url, relayUrl)
            )),
            isActivePoolMember: inActivePool && !isPrimary,
            isFallback: relayRuntime.fallbackRelayUrls.includes(relayUrl),
            isPublishReady: isRelayUrlPublishReady(relayUrl, publishReadyUrls),
            runtimePhase: relayRuntime.phase,
            lastInboundEventAtUnixMs: relayRuntime.lastInboundEventAtUnixMs,
        };
    };

    const filteredRelayUrls = useMemo(() => relayUrls.filter((relayUrl) => {
        if (!relayMatchesSettingsCategory(relayUrl, category)) {
            return false;
        }
        if (!availableOnly) {
            return true;
        }
        const poolConnection = findPoolConnectionForUrl(relayPool.connections, relayUrl);
        const derivedStatus = deriveRelayNodeStatus(buildNodeStatusParams(relayUrl, poolConnection));
        return isRelayNodeCurrentlyAvailable({ nodeStatus: derivedStatus, connection: poolConnection });
    }), [
        availableOnly,
        category,
        enabledRelayUrls,
        metrics,
        relayPool.connections,
        relayRuntime.fallbackRelayUrls,
        relayRuntime.lastInboundEventAtUnixMs,
        relayRuntime.phase,
        relaySelection.primaryUrl,
        relayUrls,
        workspaceRelaySet,
        activePoolSet,
    ]);

    if (relayUrls.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500 animate-in fade-in duration-500">
                <WifiOff className="h-10 w-10 mb-4 opacity-20" />
                <p className="text-sm">No relay metrics available yet.</p>
                <p className="text-xs opacity-60">Connections must be active to track health.</p>
            </div>
        );
    }

    if (filteredRelayUrls.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500 animate-in fade-in duration-500">
                <WifiOff className="h-10 w-10 mb-4 opacity-20" />
                <p className="text-sm">No relays match the current filters.</p>
                <p className="text-xs opacity-60">Try another category or turn off “Available only”.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredRelayUrls.map((relayUrl) => (
                    <RelayMetricCard
                        key={relayUrl}
                        url={relayUrl}
                        metrics={findMetricsForUrl(metrics, relayUrl)}
                        enabledRelayUrls={enabledRelayUrls}
                        workspaceRelayUrls={communityCandidateRelayUrls ?? []}
                        activePoolSet={activePoolSet}
                        relayPool={relayPool}
                        relayRuntime={relayRuntime}
                        relaySelection={relaySelection}
                    />
                ))}
            </div>
        </div>
    );
}

function RelayMetricCard({ url, metrics, enabledRelayUrls, workspaceRelayUrls, activePoolSet, relayPool, relayRuntime, relaySelection }: {
    url: string;
    metrics?: RelayHealthMetrics;
    enabledRelayUrls: ReadonlyArray<string>;
    workspaceRelayUrls: ReadonlyArray<string>;
    activePoolSet: ReadonlySet<string>;
    relayPool: EnhancedRelayPoolResult;
    relayRuntime: RelayRuntimeSnapshot;
    relaySelection: { primaryUrl: string | null };
}) {
    const poolConnection = findPoolConnectionForUrl(relayPool.connections, url);
    const isNostrTransport = enabledRelayUrls.includes(url);
    const isWorkspaceNode = workspaceRelayUrls.includes(url)
        || workspaceRelayUrls.some((entry) => workspaceRelayUrlsMatch(entry, url));
    const isEnabled = isNostrTransport
        || isWorkspaceNode
        || relayRuntime.fallbackRelayUrls.some((entry) => entry === url || workspaceRelayUrlsMatch(entry, url));
    const inActivePool = urlInRelaySet(activePoolSet, url);
    const isPrimary = relayUrlsMatch(relaySelection.primaryUrl, url);
    const publishReadyUrls = relayPool.getTransportActivitySnapshot()?.publishReadyRelayUrls ?? [];
    const isPublishReady = isRelayUrlPublishReady(url, publishReadyUrls);
    const derivedStatus = deriveRelayNodeStatus({
        url,
        enabled: isEnabled,
        connection: poolConnection,
        role: isPrimary
            ? "primary"
            : isNostrTransport
                ? "standby"
                : undefined,
        metrics,
        isConfigured: isNostrTransport || isWorkspaceNode,
        isActivePoolMember: inActivePool && !isPrimary,
        isFallback: relayRuntime.fallbackRelayUrls.some((entry) => entry === url || workspaceRelayUrlsMatch(entry, url)),
        isPublishReady,
        runtimePhase: relayRuntime.phase,
        lastInboundEventAtUnixMs: relayRuntime.lastInboundEventAtUnixMs,
    });
    // Real WS/HTTP open only — mesh publishReady must not paint Ready on dead dials.
    const socketOpen = poolConnection?.status === "open";
    const latencyLabelOptions = { socketOpen, publishReady: isPublishReady };
    const latencyLabel = formatRelayLatencyLabel(metrics, latencyLabelOptions);
    const sampleCount = metrics ? metrics.successfulConnections + metrics.failedConnections : 0;
    const latencyHistory = metrics?.latencyHistory ?? [];
    const hasLatencySamples = latencyHistory.length > 0;
    const latencyHistoryCaption = hasLatencySamples
        ? formatRelayLatencyHistoryCaption(metrics, latencyLabelOptions)
        : `No samples (${sampleCount})`;
    const isCompactOffline = derivedStatus.status === "unavailable";
    const isSlimOpenCard = socketOpen && (
        derivedStatus.badge === "Quiet"
        || derivedStatus.successLabel === "n/a"
    );

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                "relative overflow-hidden rounded-2xl border bg-white p-4 shadow-sm transition-all hover:shadow-md dark:bg-zinc-900/40",
                isCompactOffline
                    ? "border-dashed border-black/10 opacity-90 dark:border-white/10"
                    : "border-black/5 dark:border-white/5",
            )}
        >
            {/* Background Pulse for active connections */}
            {poolConnection?.status === 'open' && derivedStatus.status === 'healthy' && (
                <div className="absolute top-0 right-0 h-1 w-full bg-emerald-500/20">
                    <motion.div
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="h-full w-1/3 bg-emerald-500/40 blur-sm"
                    />
                </div>
            )}

            <div className={cn("flex items-start justify-between", isCompactOffline ? "mb-2" : "mb-3")}>
                <div className="min-w-0">
                    <h4 className="truncate font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        {url.replace('wss://', '')}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            isCompactOffline ? "" : "animate-pulse",
                            derivedStatus.status === 'healthy' ? "bg-emerald-500" :
                                derivedStatus.status === 'recovering' ? "bg-sky-500" :
                                    derivedStatus.status === 'degraded' ? "bg-amber-500" : "bg-red-500"
                        )} />
                        <span className="text-[10px] uppercase tracking-wider font-bold opacity-60">
                            {derivedStatus.badge}
                        </span>
                        {shouldRenderRelayNodeRoleChip(derivedStatus.roleLabel) ? (
                            <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                                {derivedStatus.roleLabel}
                            </span>
                        ) : null}
                    </div>
                </div>

                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                    <Zap className={cn(
                        "h-3 w-3",
                        !socketOpen || !(metrics && metrics.latency > 0)
                            ? "text-zinc-400"
                            : (metrics?.latency ?? 0) > 0 && metrics!.latency < 200
                                ? "text-emerald-500"
                                : isPublishReady && !(metrics && metrics.latency > 0)
                                    ? "text-emerald-500"
                                    : "text-amber-500",
                    )} />
                    <span className="text-[10px] font-mono font-bold">
                        {latencyLabel}
                    </span>
                </div>
            </div>

            {isCompactOffline ? (
                <div className="space-y-2">
                    <p className="text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">
                        {derivedStatus.detail}
                    </p>
                    <AnimatePresence>
                        {metrics?.lastError && metrics.status === 'error' && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="rounded-lg bg-red-50 p-2 dark:bg-red-900/10 overflow-hidden"
                            >
                                <p className="text-[9px] text-red-600 dark:text-red-400 font-medium leading-tight line-clamp-2">
                                    {metrics.lastError}
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            ) : (
            <div className={cn(isSlimOpenCard ? "space-y-2" : "space-y-4")}>
                {/* Latency History Sparkline */}
                <div className="space-y-1">
                    <div className="flex justify-between items-center text-[9px] uppercase tracking-tighter font-bold opacity-40">
                        <span>Latency History</span>
                        <span>{latencyHistoryCaption}</span>
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

                {!isSlimOpenCard && (
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
                )}

                {isSlimOpenCard ? (
                    <p className="text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">
                        {derivedStatus.detail}
                    </p>
                ) : (
                <div className="rounded-xl border border-black/5 bg-zinc-50/50 p-2 text-[10px] leading-relaxed text-zinc-500 dark:border-white/5 dark:bg-zinc-950/30 dark:text-zinc-400">
                    {derivedStatus.detail}
                </div>
                )}

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
            )}
        </motion.div>
    );
}
