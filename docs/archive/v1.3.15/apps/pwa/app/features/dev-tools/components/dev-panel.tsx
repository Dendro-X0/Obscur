"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Ghost, Bot, Zap, Settings, ChevronUp, ChevronDown, Trash2, Play, MessageSquare, UserPlus } from "lucide-react";
import { Button } from "@dweb/ui-kit";
import { Card } from "@dweb/ui-kit";
import { toast } from "@dweb/ui-kit";
import { useDevMode } from "../hooks/use-dev-mode";
import { SCENARIOS } from "../scenarios";
import { cn } from "@dweb/ui-kit";
import { useNetwork } from "@/app/features/network/providers/network-provider";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { chatStateStoreService } from "@/app/features/messaging/services/chat-state-store";
import { loadGroupTombstones } from "@/app/features/groups/services/group-tombstone-store";
import { getAbuseMetricsSnapshot } from "@/app/shared/abuse-observability";
import { getSybilRiskSnapshot } from "@/app/shared/sybil-risk-signals";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { getNip96StorageKey } from "@/app/features/messaging/lib/nip96-upload-service";
import { uploadServiceInternals } from "@/app/features/messaging/lib/upload-service";
import { summarizeRelayNipProbeResults } from "@/app/features/relays/lib/relay-nip-probe.mjs";
import {
    auditCommunityMigrationState,
    type CommunityMigrationAuditReport
} from "@/app/features/groups/services/community-migration-audit";
import { useAccountSyncSnapshot } from "@/app/features/account-sync/hooks/use-account-sync-snapshot";
import { useRelayDiagnosticsProbeState } from "@/app/features/relays/hooks/use-relay-diagnostics-probe-state";
import { useWindowRuntimeSnapshot } from "@/app/features/runtime/services/window-runtime-supervisor";
import type { SenderDeliveryIssueReport } from "@/app/features/messaging/services/delivery-troubleshooting-reporter";
import type { DevRuntimeIssue } from "@/app/shared/dev-runtime-issue-reporter";
import { uiResponsivenessMonitor, useUiResponsivenessSnapshot } from "@/app/shared/ui-responsiveness-monitor";

type RuntimeIssueDomainFilter = DevRuntimeIssue["domain"] | "all";
type RuntimeIssueSeverityFilter = DevRuntimeIssue["severity"] | "all";
type RuntimeIssueRetryabilityFilter = "all" | "retryable" | "terminal";

const formatBytes = (bytes: number | null): string => {
    if (typeof bytes !== "number" || Number.isNaN(bytes) || bytes <= 0) {
        return "n/a";
    }
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
};

const formatMillis = (ms: number): string => `${Math.round(ms)}ms`;

export const DevPanel = ({ dmController }: { dmController?: any }) => {
    const { isDevMode, toggleDevMode, botEngine, mockPool } = useDevMode();
    const { requestsInbox } = useNetwork();
    const { enabledRelayUrls, relayPool, relayRecovery, relayRuntime } = useRelay();
    const identity = useIdentity();
    const identityPublicKeyHex = identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? null;
    const [isOpen, setIsOpen] = useState(false);
    const [activeScenario, setActiveScenario] = useState<string | null>(null);
    const [stopScenario, setStopScenario] = useState<(() => void) | null>(null);
    const [migrationAuditReport, setMigrationAuditReport] = useState<CommunityMigrationAuditReport | null>(null);
    const [isCopyingAudit, setIsCopyingAudit] = useState(false);
    const [isCopyingAffectedKeys, setIsCopyingAffectedKeys] = useState(false);
    const [isRunAndCopyingAudit, setIsRunAndCopyingAudit] = useState(false);
    const [isCopyingRuntimeIssues, setIsCopyingRuntimeIssues] = useState(false);
    const [senderDeliveryIssues, setSenderDeliveryIssues] = useState<ReadonlyArray<SenderDeliveryIssueReport>>([]);
    const [runtimeIssues, setRuntimeIssues] = useState<ReadonlyArray<DevRuntimeIssue>>([]);
    const [runtimeIssueDomainFilter, setRuntimeIssueDomainFilter] = useState<RuntimeIssueDomainFilter>("all");
    const [runtimeIssueSeverityFilter, setRuntimeIssueSeverityFilter] = useState<RuntimeIssueSeverityFilter>("all");
    const [runtimeIssueRetryabilityFilter, setRuntimeIssueRetryabilityFilter] = useState<RuntimeIssueRetryabilityFilter>("all");
    const [affectedCommunities, setAffectedCommunities] = useState<ReadonlyArray<Readonly<{
        key: string;
        conversationId: string;
        displayName: string;
    }>>>([]);
    const accountSyncSnapshot = useAccountSyncSnapshot();
    const relayProbeState = useRelayDiagnosticsProbeState({ publicKeyHex: identityPublicKeyHex });
    const { probeResults, isRunningProbe, lastProbeAtUnixMs, probeSummary } = relayProbeState;
    const windowRuntimeSnapshot = useWindowRuntimeSnapshot();
    const uiResponsiveness = useUiResponsivenessSnapshot();
    const identityDiagnostics = identity.getIdentityDiagnostics?.() ?? { status: identity.state.status };
    const abuseMetrics = getAbuseMetricsSnapshot();
    const sybilRisk = getSybilRiskSnapshot();
    const filteredRuntimeIssues = useMemo(() => {
        return runtimeIssues.filter((issue) => {
            if (runtimeIssueDomainFilter !== "all" && issue.domain !== runtimeIssueDomainFilter) {
                return false;
            }
            if (runtimeIssueSeverityFilter !== "all" && issue.severity !== runtimeIssueSeverityFilter) {
                return false;
            }
            if (runtimeIssueRetryabilityFilter === "retryable" && issue.retryable !== true) {
                return false;
            }
            if (runtimeIssueRetryabilityFilter === "terminal" && issue.retryable === true) {
                return false;
            }
            return true;
        });
    }, [runtimeIssues, runtimeIssueDomainFilter, runtimeIssueSeverityFilter, runtimeIssueRetryabilityFilter]);

    const refreshSenderDeliveryIssues = () => {
        if (typeof window === "undefined") return;
        setSenderDeliveryIssues(
            window.obscurDeliveryTroubleshooting?.getRecentSenderDeliveryIssues() ?? []
        );
    };

    const refreshRuntimeIssues = () => {
        if (typeof window === "undefined") return;
        setRuntimeIssues(
            window.obscurDevRuntimeIssues?.getRecentIssues() ?? []
        );
    };

    useEffect(() => {
        if (!isOpen) return;
        refreshSenderDeliveryIssues();
        refreshRuntimeIssues();
        if (typeof window === "undefined") return;
        const refreshIntervalId = window.setInterval(() => {
            refreshSenderDeliveryIssues();
            refreshRuntimeIssues();
        }, 1500);
        return () => {
            window.clearInterval(refreshIntervalId);
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isDevMode && process.env.NODE_ENV !== "development") {
            return;
        }
        uiResponsivenessMonitor.start();
    }, [isDevMode]);

    if (!isDevMode && process.env.NODE_ENV !== "development") {
        return null;
    }

    const handleRunScenario = async (scenarioId: string) => {
        if (stopScenario) {
            stopScenario();
        }

        const scenario = SCENARIOS.find(s => s.id === scenarioId);
        if (scenario) {
            setActiveScenario(scenarioId);
            const stop = await scenario.execute(botEngine);
            setStopScenario(() => stop);
        }
    };

    const handleStopScenario = () => {
        if (stopScenario) {
            stopScenario();
            setStopScenario(null);
            setActiveScenario(null);
        }
    };

    const handleClearBots = () => {
        handleStopScenario();
        botEngine.clearBots();
    };

    const handleClearSenderDeliveryIssues = () => {
        if (typeof window === "undefined") return;
        window.obscurDeliveryTroubleshooting?.clearSenderDeliveryIssues();
        refreshSenderDeliveryIssues();
    };

    const handleClearRuntimeIssues = () => {
        if (typeof window === "undefined") return;
        window.obscurDevRuntimeIssues?.clearIssues();
        refreshRuntimeIssues();
    };

    const handleCopyRuntimeIssues = async () => {
        if (typeof navigator === "undefined" || !navigator.clipboard) {
            return;
        }
        try {
            setIsCopyingRuntimeIssues(true);
            await navigator.clipboard.writeText(JSON.stringify(filteredRuntimeIssues, null, 2));
            toast.success("Runtime issues copied");
        } catch {
            toast.error("Failed to copy runtime issues");
        } finally {
            setIsCopyingRuntimeIssues(false);
        }
    };

    const handleResetUiResponsiveness = () => {
        uiResponsivenessMonitor.reset();
        toast.success("UI responsiveness counters reset");
    };

    const simulateIncomingMessage = () => {
        if (!dmController) return;
        const randomPubkey = "f" + Math.random().toString(16).slice(2, 65).padEnd(63, '0');

        // Use emitEvent if it's the mock pool
        if (mockPool && typeof (mockPool as any).emitEvent === 'function') {
            (mockPool as any).emitEvent({
                kind: 4,
                content: "Real-time message! " + new Date().toLocaleTimeString(),
                pubkey: randomPubkey,
                created_at: Math.floor(Date.now() / 1000),
                tags: [['p', dmController.params?.myPublicKeyHex || '']],
                id: Math.random().toString(36).slice(2),
                sig: 'mock_sig'
            });
        }
    };

    const simulateIncomingRequest = () => {
        const randomPubkey = "e" + Math.random().toString(16).slice(2, 65).padEnd(63, '0') as PublicKeyHex;
        requestsInbox.upsertIncoming({
            peerPublicKeyHex: randomPubkey,
            plaintext: "I'd like to connect with you! " + new Date().toLocaleTimeString(),
            createdAtUnixSeconds: Math.floor(Date.now() / 1000),
            isRequest: true,
            status: 'pending'
        });
    };

    const runCommunityMigrationAudit = (): Readonly<{
        report: CommunityMigrationAuditReport;
        affected: ReadonlyArray<Readonly<{
            key: string;
            conversationId: string;
            displayName: string;
        }>>;
    }> | null => {
        const publicKeyHex = identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? null;
        if (!publicKeyHex) {
            setMigrationAuditReport(null);
            setAffectedCommunities([]);
            return null;
        }
        const state = chatStateStoreService.load(publicKeyHex as PublicKeyHex);
        if (!state) {
            setMigrationAuditReport(null);
            setAffectedCommunities([]);
            return null;
        }
        const tombstones = loadGroupTombstones(publicKeyHex);
        const report = auditCommunityMigrationState({ state, tombstones });
        setMigrationAuditReport(report);
        const affected = state.createdGroups
            .filter((group) => report.missingGenesisIdentityKeys.includes(`${group.groupId}@@${group.relayUrl}`))
            .map((group) => ({
                key: `${group.groupId}@@${group.relayUrl}`,
                conversationId: group.id,
                displayName: group.displayName || group.groupId
            }));
        setAffectedCommunities(affected);
        return { report, affected };
    };

    const copyCommunityMigrationAudit = async () => {
        if (!migrationAuditReport) return;
        if (typeof navigator === "undefined" || !navigator.clipboard) return;
        try {
            setIsCopyingAudit(true);
            await navigator.clipboard.writeText(JSON.stringify(migrationAuditReport, null, 2));
            toast.success("Audit JSON copied");
        } catch {
            toast.error("Failed to copy audit JSON");
        } finally {
            setIsCopyingAudit(false);
        }
    };

    const copyAffectedCommunityKeys = async () => {
        if (!migrationAuditReport) return;
        if (migrationAuditReport.missingGenesisIdentityKeys.length === 0) return;
        if (typeof navigator === "undefined" || !navigator.clipboard) return;
        try {
            setIsCopyingAffectedKeys(true);
            await navigator.clipboard.writeText(
                JSON.stringify(
                    {
                        missingGenesisIdentityKeys: migrationAuditReport.missingGenesisIdentityKeys
                    },
                    null,
                    2
                )
            );
            toast.success("Affected keys copied");
        } catch {
            toast.error("Failed to copy affected keys");
        } finally {
            setIsCopyingAffectedKeys(false);
        }
    };

    const runAndCopyCommunityMigrationAudit = async () => {
        if (typeof navigator === "undefined" || !navigator.clipboard) return;
        try {
            setIsRunAndCopyingAudit(true);
            const result = runCommunityMigrationAudit();
            if (!result) return;
            await navigator.clipboard.writeText(
                JSON.stringify(
                    {
                        report: result.report,
                        affectedCommunities: result.affected
                    },
                    null,
                    2
                )
            );
            toast.success("Audit report and affected communities copied");
        } catch {
            toast.error("Failed to run and copy audit");
        } finally {
            setIsRunAndCopyingAudit(false);
        }
    };

    const readNip96ProviderUrls = (): ReadonlyArray<string> => {
        if (typeof window === "undefined") {
            return uploadServiceInternals.DEFAULT_NIP96_PROVIDER_URLS;
        }
        try {
            const raw = localStorage.getItem(getNip96StorageKey());
            if (!raw) return uploadServiceInternals.DEFAULT_NIP96_PROVIDER_URLS;
            const parsed = JSON.parse(raw) as Readonly<{ apiUrls?: ReadonlyArray<string>; enabled?: boolean }>;
            const urls = Array.isArray(parsed?.apiUrls) ? parsed.apiUrls.filter((url): url is string => typeof url === "string") : [];
            if (parsed?.enabled === false) return [];
            if (urls.length === 0) return uploadServiceInternals.DEFAULT_NIP96_PROVIDER_URLS;
            return Array.from(new Set(urls.map((url) => url.trim()).filter((url) => url.length > 0)));
        } catch {
            return uploadServiceInternals.DEFAULT_NIP96_PROVIDER_URLS;
        }
    };

    const handleRunRelayProbe = async () => {
        try {
            const relayUrls = enabledRelayUrls.length > 0
                ? enabledRelayUrls
                : relayPool.connections.map((connection) => connection.url);
            const nip96Urls = readNip96ProviderUrls();
            const snapshot = await relayProbeState.runProbe({
                relayUrls,
                nip96Urls,
                timeoutMs: 4500,
            });
            const summary = summarizeRelayNipProbeResults(snapshot.results);
            toast.info(`Probe done: ok=${summary.ok}, degraded=${summary.degraded}, failed=${summary.failed}, unsupported=${summary.unsupported}`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Relay/NIP probe failed");
        }
    };

    const openCommunity = (conversationId: string) => {
        if (typeof window === "undefined") return;
        window.location.href = `/?convId=${encodeURIComponent(conversationId)}`;
    };

    return (
        <div className="fixed bottom-20 md:bottom-4 right-4 z-[9999] flex flex-col items-end gap-2 pb-[env(safe-area-inset-bottom)]">
            {!isOpen && (
                <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => setIsOpen(true)}
                    className="h-12 w-12 rounded-full border-2 border-purple-500/50 bg-white/80 shadow-lg backdrop-blur-md dark:bg-black/80"
                    title="Ghost Protocol (Dev Mode)"
                >
                    <Ghost className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </Button>
            )}

            {isOpen && (
                <Card className="w-80 overflow-hidden rounded-2xl border-2 border-purple-500/30 bg-white/90 p-0 shadow-2xl backdrop-blur-xl dark:bg-black/90">
                    <div className="flex items-center justify-between bg-gradient-primary px-4 py-2 text-white">
                        <div className="flex items-center gap-2 font-bold">
                            <Ghost className="h-4 w-4" />
                            <span>Ghost Protocol</span>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsOpen(false)}
                            className="h-8 w-8 p-0 text-white hover:bg-white/20"
                        >
                            <ChevronDown className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="flex flex-col gap-4 p-4">
                        {/* Simulation Status */}
                        <div>
                            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                                <span>Simulation Status</span>
                                <span className={cn(
                                    "rounded-full px-1.5 py-0.5",
                                    isDevMode ? "bg-emerald-500/20 text-emerald-600" : "bg-zinc-500/20 text-zinc-600"
                                )}>
                                    {isDevMode ? "Active (Mock Pool)" : "Inactive"}
                                </span>
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                                <div className="rounded-xl bg-zinc-100 p-2 dark:bg-zinc-800/50">
                                    <div className="text-[10px] text-zinc-500">Active Bots</div>
                                    <div className="text-lg font-bold">{botEngine.getBots().length}</div>
                                </div>
                                <div className="rounded-xl bg-zinc-100 p-2 dark:bg-zinc-800/50">
                                    <div className="text-[10px] text-zinc-500">Scenario</div>
                                    <div className="truncate text-sm font-bold">{activeScenario || "None"}</div>
                                </div>
                            </div>
                        </div>

                        {/* Scenarios */}
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Run Scenario</div>
                            <div className="mt-2 flex flex-col gap-2">
                                {SCENARIOS.map(scenario => (
                                    <Button
                                        key={scenario.id}
                                        variant={activeScenario === scenario.id ? "primary" : "secondary"}
                                        size="sm"
                                        className="justify-start gap-2"
                                        onClick={() => handleRunScenario(scenario.id)}
                                    >
                                        <Play className="h-3 w-3" />
                                        <div className="flex flex-col items-start leading-tight">
                                            <span className="text-xs">{scenario.name}</span>
                                        </div>
                                    </Button>
                                ))}
                                {activeScenario && (
                                    <Button variant="danger" size="sm" onClick={handleStopScenario}>
                                        Stop Simulation
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Simulations */}
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Identity Diagnostics</div>
                            <div className="mt-2 rounded-xl bg-zinc-100 p-2 text-[11px] dark:bg-zinc-800/50">
                                <div>status: <span className="font-mono">{identityDiagnostics.status}</span></div>
                                <div>stored: <span className="font-mono">{identityDiagnostics.storedPublicKeyHex?.slice(0, 12) || "n/a"}</span></div>
                                <div>native: <span className="font-mono">{identityDiagnostics.nativeSessionPublicKeyHex?.slice(0, 12) || "n/a"}</span></div>
                                <div>mismatch: <span className="font-mono">{identityDiagnostics.mismatchReason || "none"}</span></div>
                            </div>
                        </div>

                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Account Sync</div>
                            <div className="mt-2 rounded-xl bg-zinc-100 p-2 text-[11px] dark:bg-zinc-800/50">
                                <div>phase: <span className="font-mono">{accountSyncSnapshot.phase}</span></div>
                                <div>status: <span className="font-mono">{accountSyncSnapshot.status}</span></div>
                                <div>portable: <span className="font-mono">{accountSyncSnapshot.portabilityStatus}</span></div>
                                <div>backup: <span className="font-mono">{accountSyncSnapshot.hasEncryptedBackup ? "present" : "missing"}</span></div>
                                <div>restore source: <span className="font-mono">{accountSyncSnapshot.lastRestoreSource || "none"}</span></div>
                                <div>profile proof: <span className="font-mono">{accountSyncSnapshot.profileProof ? `${accountSyncSnapshot.profileProof.deliveryStatus} ${accountSyncSnapshot.profileProof.successCount ?? 0}/${accountSyncSnapshot.profileProof.totalRelays ?? 0}` : "none"}</span></div>
                                <div>backup proof: <span className="font-mono">{accountSyncSnapshot.backupProof ? `${accountSyncSnapshot.backupProof.deliveryStatus} ${accountSyncSnapshot.backupProof.successCount ?? 0}/${accountSyncSnapshot.backupProof.totalRelays ?? 0}` : "none"}</span></div>
                                <div>last profile fetch: <span className="font-mono">{accountSyncSnapshot.lastPublicProfileFetchAtUnixMs ? new Date(accountSyncSnapshot.lastPublicProfileFetchAtUnixMs).toISOString() : "n/a"}</span></div>
                                <div>last backup publish: <span className="font-mono">{accountSyncSnapshot.lastEncryptedBackupPublishAtUnixMs ? new Date(accountSyncSnapshot.lastEncryptedBackupPublishAtUnixMs).toISOString() : "n/a"}</span></div>
                                <div>relay failure: <span className="font-mono">{accountSyncSnapshot.lastRelayFailureReason || "none"}</span></div>
                                <div className="pt-2">runtime phase: <span className="font-mono">{windowRuntimeSnapshot.phase}</span></div>
                                <div>runtime profile: <span className="font-mono">{windowRuntimeSnapshot.session.profileId}</span></div>
                                <div>runtime window: <span className="font-mono">{windowRuntimeSnapshot.session.windowLabel}</span></div>
                                <div>runtime identity: <span className="font-mono">{windowRuntimeSnapshot.session.identityStatus}</span></div>
                                <div>runtime degraded: <span className="font-mono">{windowRuntimeSnapshot.degradedReason}</span></div>
                                <div>incoming owners: <span className="font-mono">{windowRuntimeSnapshot.messagingTransportRuntime.activeIncomingOwnerCount}</span></div>
                                <div>queue processors: <span className="font-mono">{windowRuntimeSnapshot.messagingTransportRuntime.activeQueueProcessorCount}</span></div>
                                <div>relay runtime: <span className="font-mono">{relayRuntime.phase}</span></div>
                                <div>relay instance: <span className="font-mono">{relayRuntime.instanceId.slice(0, 8)}</span></div>
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                                <span>UI Responsiveness</span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 text-[10px]"
                                    onClick={handleResetUiResponsiveness}
                                >
                                    Reset
                                </Button>
                            </div>
                            <div className="mt-2 rounded-xl bg-zinc-100 p-2 text-[11px] dark:bg-zinc-800/50">
                                <div>monitor started: <span className="font-mono">{new Date(uiResponsiveness.startedAtUnixMs).toISOString()}</span></div>
                                <div>dropped frames: <span className="font-mono">{uiResponsiveness.droppedFrameCount}</span></div>
                                <div>lag spikes (&gt;=120ms): <span className="font-mono">{uiResponsiveness.frameLagSpikeCount}</span></div>
                                <div>worst frame gap: <span className="font-mono">{formatMillis(uiResponsiveness.worstFrameGapMs)}</span></div>
                                <div>last frame lag: <span className="font-mono">{uiResponsiveness.lastFrameLagAtUnixMs ? new Date(uiResponsiveness.lastFrameLagAtUnixMs).toISOString() : "n/a"}</span></div>
                                <div className="pt-2">long task observer: <span className="font-mono">{uiResponsiveness.longTaskSupported ? "available" : "unavailable"}</span></div>
                                <div>long task count: <span className="font-mono">{uiResponsiveness.longTaskCount}</span></div>
                                <div>long task total: <span className="font-mono">{formatMillis(uiResponsiveness.longTaskTotalDurationMs)}</span></div>
                                <div>worst long task: <span className="font-mono">{formatMillis(uiResponsiveness.longTaskWorstDurationMs)}</span></div>
                                <div>last long task: <span className="font-mono">{uiResponsiveness.lastLongTaskAtUnixMs ? new Date(uiResponsiveness.lastLongTaskAtUnixMs).toISOString() : "n/a"}</span></div>
                                <div className="pt-2">memory api: <span className="font-mono">{uiResponsiveness.memorySupported ? "available" : "unavailable"}</span></div>
                                <div>heap used: <span className="font-mono">{formatBytes(uiResponsiveness.heapUsedBytes)}</span></div>
                                <div>heap total: <span className="font-mono">{formatBytes(uiResponsiveness.heapTotalBytes)}</span></div>
                                <div>heap limit: <span className="font-mono">{formatBytes(uiResponsiveness.heapLimitBytes)}</span></div>
                                <div>last memory sample: <span className="font-mono">{uiResponsiveness.lastMemorySampleAtUnixMs ? new Date(uiResponsiveness.lastMemorySampleAtUnixMs).toISOString() : "n/a"}</span></div>
                            </div>
                        </div>

                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Abuse Metrics</div>
                            <div className="mt-2 rounded-xl bg-zinc-100 p-2 text-[11px] dark:bg-zinc-800/50">
                                <div>request suppressed: <span className="font-mono">{abuseMetrics.request_send_suppressed}</span></div>
                                <div>join suppressed: <span className="font-mono">{abuseMetrics.join_request_suppressed}</span></div>
                                <div>quarantined malformed: <span className="font-mono">{abuseMetrics.quarantined_malformed_event}</span></div>
                                <div>deduped state: <span className="font-mono">{abuseMetrics.deduped_state_entry}</span></div>
                            </div>
                        </div>

                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Sybil Risk Signals</div>
                            <div className="mt-2 rounded-xl bg-zinc-100 p-2 text-[11px] dark:bg-zinc-800/50">
                                <div>level: <span className="font-mono">{sybilRisk.level}</span></div>
                                <div>score: <span className="font-mono">{sybilRisk.score}</span></div>
                                <div>window(min): <span className="font-mono">{Math.round(sybilRisk.windowMs / 60000)}</span></div>
                                <div>request burst: <span className="font-mono">{sybilRisk.counts.request_suppressed}</span></div>
                                <div>malformed burst: <span className="font-mono">{sybilRisk.counts.malformed_event_quarantined}</span></div>
                                <div>identity churn: <span className="font-mono">{sybilRisk.counts.identity_churn}</span></div>
                                <div>distinct identities: <span className="font-mono">{sybilRisk.distinctIdentityCount}</span></div>
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                                <span>Sender Delivery Issues</span>
                                <div className="flex items-center gap-1">
                                    <span className="rounded-full bg-zinc-500/20 px-1.5 py-0.5 text-[10px] text-zinc-700 dark:text-zinc-300">
                                        {senderDeliveryIssues.length}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-6 text-[10px]"
                                        onClick={handleClearSenderDeliveryIssues}
                                        disabled={senderDeliveryIssues.length === 0}
                                    >
                                        Clear
                                    </Button>
                                </div>
                            </div>
                            <div className="mt-2 rounded-xl bg-zinc-100 p-2 text-[11px] dark:bg-zinc-800/50">
                                {senderDeliveryIssues.length === 0 ? (
                                    <div className="text-zinc-500">No sender delivery issues captured.</div>
                                ) : (
                                    <div className="max-h-36 space-y-1 overflow-auto">
                                        {senderDeliveryIssues
                                            .slice(-8)
                                            .reverse()
                                            .map((issue) => (
                                                <div key={`${issue.atUnixMs}:${issue.messageId || issue.recipientPublicKeyHex}`} className="rounded bg-white/70 px-2 py-1 dark:bg-black/20">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className={cn(
                                                            "rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase",
                                                            issue.deliveryStatus === "failed"
                                                                ? "bg-rose-500/20 text-rose-700"
                                                                : "bg-amber-500/20 text-amber-700"
                                                        )}>
                                                            {issue.deliveryStatus}
                                                        </span>
                                                        <span className="font-mono text-[10px] text-zinc-500">
                                                            {new Date(issue.atUnixMs).toLocaleTimeString()}
                                                        </span>
                                                    </div>
                                                    <div className="truncate font-mono text-[10px] text-zinc-600 dark:text-zinc-300">
                                                        to {issue.recipientPublicKeyHex.slice(0, 16)} via {issue.attemptPhase}
                                                    </div>
                                                    <div className="truncate text-[10px] text-zinc-600 dark:text-zinc-300">
                                                        reason={issue.reasonCode || issue.failureReason || "unknown"} relays={issue.relayFailureCount}/{issue.relayResultCount}
                                                    </div>
                                                    {issue.error ? (
                                                        <div className="truncate text-[10px] text-rose-600 dark:text-rose-300">{issue.error}</div>
                                                    ) : null}
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                                <span>Runtime Issue Feed</span>
                                <div className="flex items-center gap-1">
                                    <span className="rounded-full bg-zinc-500/20 px-1.5 py-0.5 text-[10px] text-zinc-700 dark:text-zinc-300">
                                        {filteredRuntimeIssues.length}/{runtimeIssues.length}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-6 text-[10px]"
                                        onClick={handleCopyRuntimeIssues}
                                        disabled={filteredRuntimeIssues.length === 0 || isCopyingRuntimeIssues}
                                    >
                                        {isCopyingRuntimeIssues ? "Copying..." : "Copy"}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-6 text-[10px]"
                                        onClick={handleClearRuntimeIssues}
                                        disabled={runtimeIssues.length === 0}
                                    >
                                        Clear
                                    </Button>
                                </div>
                            </div>
                            <div className="mt-2 rounded-xl bg-zinc-100 p-2 text-[11px] dark:bg-zinc-800/50">
                                <div className="mb-2 grid grid-cols-3 gap-1">
                                    <select
                                        className="h-7 rounded border border-zinc-300 bg-white px-1 text-[10px] dark:border-zinc-700 dark:bg-zinc-900"
                                        value={runtimeIssueDomainFilter}
                                        onChange={(event) => setRuntimeIssueDomainFilter(event.target.value as RuntimeIssueDomainFilter)}
                                    >
                                        <option value="all">domain: all</option>
                                        <option value="relay">relay</option>
                                        <option value="messaging">messaging</option>
                                        <option value="upload">upload</option>
                                        <option value="runtime">runtime</option>
                                        <option value="storage">storage</option>
                                        <option value="unknown">unknown</option>
                                    </select>
                                    <select
                                        className="h-7 rounded border border-zinc-300 bg-white px-1 text-[10px] dark:border-zinc-700 dark:bg-zinc-900"
                                        value={runtimeIssueSeverityFilter}
                                        onChange={(event) => setRuntimeIssueSeverityFilter(event.target.value as RuntimeIssueSeverityFilter)}
                                    >
                                        <option value="all">severity: all</option>
                                        <option value="error">error</option>
                                        <option value="warn">warn</option>
                                    </select>
                                    <select
                                        className="h-7 rounded border border-zinc-300 bg-white px-1 text-[10px] dark:border-zinc-700 dark:bg-zinc-900"
                                        value={runtimeIssueRetryabilityFilter}
                                        onChange={(event) => setRuntimeIssueRetryabilityFilter(event.target.value as RuntimeIssueRetryabilityFilter)}
                                    >
                                        <option value="all">retry: all</option>
                                        <option value="retryable">retryable</option>
                                        <option value="terminal">terminal</option>
                                    </select>
                                </div>
                                {filteredRuntimeIssues.length === 0 ? (
                                    <div className="text-zinc-500">No runtime issues captured.</div>
                                ) : (
                                    <div className="max-h-36 space-y-1 overflow-auto">
                                        {filteredRuntimeIssues
                                            .slice(-8)
                                            .reverse()
                                            .map((issue) => (
                                                <div key={issue.id} className="rounded bg-white/70 px-2 py-1 dark:bg-black/20">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className={cn(
                                                            "rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase",
                                                            issue.severity === "error"
                                                                ? "bg-rose-500/20 text-rose-700"
                                                                : "bg-amber-500/20 text-amber-700"
                                                        )}>
                                                            {issue.domain}:{issue.operation}
                                                        </span>
                                                        <span className="font-mono text-[10px] text-zinc-500">
                                                            {new Date(issue.lastSeenAtUnixMs).toLocaleTimeString()}
                                                        </span>
                                                    </div>
                                                    <div className="truncate text-[10px] text-zinc-600 dark:text-zinc-300">
                                                        {issue.message}
                                                    </div>
                                                    <div className="truncate font-mono text-[10px] text-zinc-500">
                                                        reason={issue.reasonCode || "unknown"} repeats={issue.occurrenceCount} retryable={issue.retryable === true ? "yes" : "no"}
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Relay/NIP Probe</div>
                            <div className="mt-2 rounded-xl bg-zinc-100 p-2 text-[11px] dark:bg-zinc-800/50">
                                <div>readiness: <span className="font-mono">{relayRecovery.readiness}</span></div>
                                <div>writable relays: <span className="font-mono">{relayRecovery.writableRelayCount}</span></div>
                                <div>subscribable relays: <span className="font-mono">{relayRecovery.subscribableRelayCount}</span></div>
                                <div>subscriptions: <span className="font-mono">{relayRuntime.activeSubscriptionCount}</span></div>
                                <div>probe summary: <span className="font-mono">ok={probeSummary.ok} degraded={probeSummary.degraded} failed={probeSummary.failed}</span></div>
                            </div>
                            <div className="mt-2 rounded-xl bg-zinc-100 p-2 text-[11px] dark:bg-zinc-800/50">
                                <div className="mb-2 rounded-lg bg-white/70 px-2 py-2 dark:bg-black/20">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Recovery</div>
                                        <div className={cn(
                                            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                                            relayRecovery.readiness === "healthy" ? "bg-emerald-500/20 text-emerald-700" :
                                                relayRecovery.readiness === "recovering" ? "bg-blue-500/20 text-blue-700" :
                                                    relayRecovery.readiness === "degraded" ? "bg-amber-500/20 text-amber-700" :
                                                        "bg-rose-500/20 text-rose-700"
                                        )}>
                                            {relayRecovery.readiness}
                                        </div>
                                    </div>
                                    <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-zinc-500">
                                        <div>writable: {relayRecovery.writableRelayCount}</div>
                                        <div>readable: {relayRecovery.subscribableRelayCount}</div>
                                        <div>recoveries: {relayRecovery.recoveryAttemptCount}</div>
                                        <div>action: {relayRecovery.currentAction || "none"}</div>
                                    </div>
                                    {relayRecovery.lastFailureReason ? (
                                        <div className="mt-2 text-[10px] text-zinc-500">
                                            failure: {relayRecovery.lastFailureReason}
                                        </div>
                                    ) : null}
                                </div>
                                <div className="mb-2 flex items-center justify-between gap-2">
                                    <div className="text-[10px] text-zinc-500">
                                        last: {lastProbeAtUnixMs ? new Date(lastProbeAtUnixMs).toLocaleTimeString() : "never"}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-[10px]"
                                        onClick={handleRunRelayProbe}
                                        disabled={isRunningProbe}
                                    >
                                        {isRunningProbe ? "Running..." : "Run Probe"}
                                    </Button>
                                </div>
                                {probeResults.length === 0 ? (
                                    <div className="text-[10px] text-zinc-500">No probe results yet.</div>
                                ) : (
                                    <div className="max-h-36 space-y-1 overflow-auto">
                                        {probeResults.slice(0, 16).map((result, index) => (
                                            <div key={`${result.target}:${result.check}:${index}`} className="flex items-center justify-between gap-2 rounded bg-white/70 px-2 py-1 dark:bg-black/20">
                                                <div className="min-w-0 flex-1">
                                                    <div className="truncate text-[10px] font-bold">{result.check}</div>
                                                    <div className="truncate text-[10px] text-zinc-500">{result.target}</div>
                                                </div>
                                                <div className={cn(
                                                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                                                    result.status === "ok" ? "bg-emerald-500/20 text-emerald-700" :
                                                        result.status === "degraded" ? "bg-amber-500/20 text-amber-700" :
                                                            result.status === "unsupported" ? "bg-zinc-500/20 text-zinc-700" :
                                                                "bg-rose-500/20 text-rose-700"
                                                )}>
                                                    {result.status}
                                                </div>
                                                <div className="shrink-0 text-[10px] text-zinc-500">{result.reasonCode || "ok"}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Simulations</div>
                            <div className="mt-2 flex flex-col gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="justify-start gap-2 border-purple-500/30 text-purple-600 dark:text-purple-400"
                                    onClick={simulateIncomingMessage}
                                >
                                    <MessageSquare className="h-3 w-3" />
                                    <span>Simulate Message</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="justify-start gap-2 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                                    onClick={simulateIncomingRequest}
                                >
                                    <UserPlus className="h-3 w-3" />
                                    <span>Simulate Request</span>
                                </Button>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Quick Actions</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => botEngine.spawnBot("Ghost Bot")}>
                                    <Bot className="h-3 w-3" />
                                    <span>Spawn Bot</span>
                                </Button>
                                <Button variant="outline" size="sm" className="h-8 gap-1.5 border-red-500/30 text-red-500 hover:bg-red-500/10" onClick={handleClearBots}>
                                    <Trash2 className="h-3 w-3" />
                                    <span>Clear Bots</span>
                                </Button>
                            </div>
                        </div>

                        {/* System Info */}
                        <div className="border-t pt-4 dark:border-white/10">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs text-zinc-500">
                                    <Settings className="h-3 w-3" />
                                    <span>Dev Mode</span>
                                </div>
                                <Button
                                    variant={isDevMode ? "danger" : "primary"}
                                    size="sm"
                                    className="h-7 text-[10px]"
                                    onClick={toggleDevMode}
                                >
                                    {isDevMode ? "Disable & Reload" : "Enable Dev Mode"}
                                </Button>
                            </div>
                        </div>

                        {/* Community V2 Audit */}
                        <div className="border-t pt-4 dark:border-white/10">
                            <div className="flex items-center justify-between gap-2">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                                    Community Migration Audit
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-[10px]"
                                        onClick={runCommunityMigrationAudit}
                                    >
                                        Run
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-[10px]"
                                        onClick={copyCommunityMigrationAudit}
                                        disabled={!migrationAuditReport || isCopyingAudit}
                                    >
                                        {isCopyingAudit ? "Copying..." : "Copy Audit JSON"}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-[10px]"
                                        onClick={runAndCopyCommunityMigrationAudit}
                                        disabled={isRunAndCopyingAudit}
                                    >
                                        {isRunAndCopyingAudit ? "Running..." : "Run + Copy all"}
                                    </Button>
                                </div>
                            </div>
                            <div className="mt-2 rounded-xl bg-zinc-100 p-2 dark:bg-zinc-800/50">
                                {!migrationAuditReport ? (
                                    <div className="text-[11px] text-zinc-500">No report yet.</div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="text-[11px] text-zinc-500">Status</div>
                                            <span
                                                className={cn(
                                                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                                                    migrationAuditReport.ok
                                                        ? "bg-emerald-500/20 text-emerald-600"
                                                        : "bg-rose-500/20 text-rose-600"
                                                )}
                                            >
                                                {migrationAuditReport.ok ? "PASS" : "FAIL"}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                                            <div className="rounded bg-white/70 p-1.5 dark:bg-black/20">
                                                duplicates: {migrationAuditReport.duplicateActiveCommunityKeys.length}
                                            </div>
                                            <div className="rounded bg-white/70 p-1.5 dark:bg-black/20">
                                                tombstone conflicts: {migrationAuditReport.tombstonedActiveCommunityKeys.length}
                                            </div>
                                            <div className="rounded bg-white/70 p-1.5 dark:bg-black/20">
                                                missing genesis ids: {migrationAuditReport.missingGenesisIdentityKeys.length}
                                            </div>
                                            <div className="rounded bg-white/70 p-1.5 dark:bg-black/20">
                                                orphan ids: {migrationAuditReport.orphanConversationIds.length}
                                            </div>
                                            <div className="rounded bg-white/70 p-1.5 dark:bg-black/20">
                                                non-canonical ids: {migrationAuditReport.nonCanonicalKnownConversationIds.length}
                                            </div>
                                        </div>
                                        {migrationAuditReport.missingGenesisIdentityKeys.length > 0 && (
                                            <div className="space-y-2 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-700 dark:text-amber-300">
                                                <div>
                                                    Found communities missing genesis identity fields. Rejoin or recreate these communities to complete V2 identity migration.
                                                </div>
                                                <div className="flex flex-wrap gap-1">
                                                    {affectedCommunities.slice(0, 4).map((community) => (
                                                        <Button
                                                            key={community.key}
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-6 text-[10px]"
                                                            onClick={() => openCommunity(community.conversationId)}
                                                        >
                                                            Open {community.displayName}
                                                        </Button>
                                                    ))}
                                                </div>
                                                {affectedCommunities.length > 4 && (
                                                    <div className="text-[10px] opacity-80">
                                                        +{affectedCommunities.length - 4} more affected communities
                                                    </div>
                                                )}
                                                <div>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-6 text-[10px]"
                                                        onClick={copyAffectedCommunityKeys}
                                                        disabled={isCopyingAffectedKeys}
                                                    >
                                                        {isCopyingAffectedKeys ? "Copying..." : "Export affected keys"}
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                        {!migrationAuditReport.ok && (
                                            <pre className="max-h-32 overflow-auto rounded bg-black/80 p-2 text-[10px] text-zinc-100">
                                                {JSON.stringify(migrationAuditReport, null, 2)}
                                            </pre>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    );
};
