"use client";

import React, { useState } from "react";
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
import {
    auditCommunityMigrationState,
    type CommunityMigrationAuditReport
} from "@/app/features/groups/services/community-migration-audit";

export const DevPanel = ({ dmController }: { dmController?: any }) => {
    const { isDevMode, toggleDevMode, botEngine, mockPool } = useDevMode();
    const { requestsInbox } = useNetwork();
    const identity = useIdentity();
    const [isOpen, setIsOpen] = useState(false);
    const [activeScenario, setActiveScenario] = useState<string | null>(null);
    const [stopScenario, setStopScenario] = useState<(() => void) | null>(null);
    const [migrationAuditReport, setMigrationAuditReport] = useState<CommunityMigrationAuditReport | null>(null);
    const [isCopyingAudit, setIsCopyingAudit] = useState(false);
    const [isCopyingAffectedKeys, setIsCopyingAffectedKeys] = useState(false);
    const [isRunAndCopyingAudit, setIsRunAndCopyingAudit] = useState(false);
    const [affectedCommunities, setAffectedCommunities] = useState<ReadonlyArray<Readonly<{
        key: string;
        conversationId: string;
        displayName: string;
    }>>>([]);

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
