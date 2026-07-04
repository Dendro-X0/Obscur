"use client";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@dweb/ui-kit";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { useRelayPoolRef } from "@/app/features/relays/hooks/use-relay-pool-ref";
import { getApiBaseUrl } from "@/app/features/relays/utils/api-base-url";
import { assessRelayAddTrust } from "@/app/features/relays/services/relay-add-trust-assessment";
import { assessRelayCapability, getCommunityModeDefinition } from "@/app/features/groups/services/community-mode-contract";
import { relayResilienceObservability } from "@/app/features/relays/services/relay-resilience-observability";
import type { SettingsActionPhase } from "@/app/features/settings/components/settings-action-status";
import type { SettingsTabPanelModel } from "../settings-tab-panel-model-context";
import { DEFAULT_STABLE_PRESET, ENABLE_API_HEALTH_PROBE, RELAY_PRESETS, type ApiHealthState, type RelayPresetId, } from "../settings-tab-panel-shared";
import { useSettingsDestructiveActionsModel } from "./use-settings-destructive-actions-model";
import { useSettingsRelayRuntimeStatus } from "./use-settings-relay-runtime-status";
export function useRelaysSettingsModel(): SettingsTabPanelModel {
    const { t } = useTranslation();
    const destructive = useSettingsDestructiveActionsModel();
    const { relayPool: pool, relayList, relayRuntime, triggerRelayRecovery, relaySelection, setRelayTransportMode, } = useRelay();
    const poolRef = useRelayPoolRef(pool);
    const [apiHealth, setApiHealth] = useState<ApiHealthState>({ status: "idle" });
    const [newRelayUrl, setNewRelayUrl] = useState<string>("");
    const [showAdvancedRelays, setShowAdvancedRelays] = useState<boolean>(false);
    const [relayActionPhase, setRelayActionPhase] = useState<SettingsActionPhase>("idle");
    const [relayActionMessage, setRelayActionMessage] = useState<string>("");
    const translateRelayPresetLabel = useCallback((presetId: RelayPresetId): string => {
        if (presetId === "default_stable") {
            return t("settings.relays.preset.defaultStable");
        }
        if (presetId === "high_redundancy") {
            return t("settings.relays.preset.highRedundancy");
        }
        return t("settings.relays.preset.lowLatency");
    }, [t]);
    const translateRelayRuntimeText = useCallback((value: string): string => {
        switch (value) {
            case "No relay configured":
                return t("settings.relays.runtime.noRelayConfigured");
            case "Add at least one relay in Settings -> Relays.":
                return t("settings.relays.runtime.noRelayConfiguredDesc");
            case "Relay recovery in progress":
                return t("settings.relays.runtime.recoveryInProgress");
            case "Relay connections starting":
                return t("settings.relays.runtime.connectionsStarting");
            case "Reconnecting relays and restoring subscriptions.":
                return t("settings.relays.runtime.reconnecting");
            case "No writable relays available":
                return t("settings.relays.runtime.noWritableRelays");
            case "Messages can queue locally, but relay-backed delivery is currently unavailable.":
                return t("settings.relays.runtime.noWritableRelaysDesc");
            case "Configured relays healthy":
                return t("settings.relays.runtime.configuredHealthy");
            case "Relay communication healthy":
                return t("settings.relays.runtime.communicationHealthy");
            case "Configured relays are healthy again. Fallback relays may remain connected temporarily as standby coverage.":
                return t("settings.relays.runtime.configuredHealthyDesc");
            case "Configured relays are writable and this window is seeing recent relay events.":
                return t("settings.relays.runtime.communicationHealthyDesc");
            case "Relay event flow degraded":
                return t("settings.relays.runtime.eventFlowDegraded");
            case "Relay connectivity degraded":
                return t("settings.relays.runtime.connectivityDegraded");
            case "Sockets are open, but this window has not seen recent relay events.":
                return t("settings.relays.runtime.eventFlowDegradedDesc");
            case "Fallback relays are active; connectivity is working with reduced trust and redundancy.":
                return t("settings.relays.runtime.connectivityDegradedDesc");
            case "Some configured relays are unavailable or partially useful. Review individual relay status below.":
                return t("settings.relays.runtime.partialUtilityDesc");
            default:
                if (value.startsWith("Restoring runtime state: ")) {
                    return t("settings.relays.runtime.restoringState", {
                        defaultValue: "Restoring runtime state: {{stage}}.",
                        stage: value.replace("Restoring runtime state: ", "").replace(/\.$/, ""),
                    });
                }
                return value;
        }
    }, [t]);
    const translateRelayNodeBadge = useCallback((value: string): string => {
        switch (value) {
            case "Disabled": return t("settings.relays.node.badge.disabled");
            case "Cooling down": return t("settings.relays.node.badge.coolingDown");
            case "Connecting": return t("settings.relays.node.badge.connecting");
            case "Error": return t("settings.relays.node.badge.error");
            case "Fallback active": return t("settings.relays.node.badge.fallbackActive");
            case "Degraded": return t("settings.relays.node.badge.degraded");
            case "High latency": return t("settings.relays.node.badge.highLatency");
            case "No recent events": return t("settings.relays.node.badge.noRecentEvents");
            case "Healthy": return t("settings.relays.node.badge.healthy");
            default: return value;
        }
    }, [t]);
    const translateRelayNodeRole = useCallback((value: string): string => {
        switch (value) {
            case "Disabled": return t("settings.relays.node.role.disabled");
            case "Fallback": return t("settings.relays.node.role.fallback");
            case "Transient": return t("settings.relays.node.role.transient");
            case "Configured": return t("settings.relays.node.role.configured");
            default: return value;
        }
    }, [t]);
    const translateRelayNodeDetail = useCallback((value: string): string => {
        switch (value) {
            case "This relay is configured for the profile but currently disabled.":
                return t("settings.relays.node.detail.disabled");
            case "Repeated failures triggered relay backoff.":
                return t("settings.relays.node.detail.backoff");
            case "The runtime is actively establishing this relay connection.":
                return t("settings.relays.node.detail.connecting");
            case "The last relay connection attempt failed.":
                return t("settings.relays.node.detail.lastAttemptFailed");
            case "This relay is connected as temporary fallback coverage, not primary configured transport.":
                return t("settings.relays.node.detail.fallbackActive");
            case "This relay is connected, but it is still being evaluated after recent failures.":
                return t("settings.relays.node.detail.degraded");
            case "The socket is open, but observed latency is high enough to reduce delivery quality.":
                return t("settings.relays.node.detail.highLatency");
            default:
                if (value.startsWith("Repeated failures triggered backoff. Next retry is scheduled automatically.")) {
                    return t("settings.relays.node.detail.backoffRetry");
                }
                return value;
        }
    }, [t]);
    const translateRelayConfidenceLabel = useCallback((value: string): string => {
        if (value.startsWith("Insufficient data (")) {
            const count = Number(value.replace("Insufficient data (", "").replace(")", "")) || 0;
            return t("settings.relays.node.confidence.insufficient", { count });
        }
        if (value.startsWith("Low confidence (")) {
            const count = Number(value.replace("Low confidence (", "").replace(")", "")) || 0;
            return t("settings.relays.node.confidence.low", { count });
        }
        if (value.startsWith("High confidence (")) {
            const count = Number(value.replace("High confidence (", "").replace(")", "")) || 0;
            return t("settings.relays.node.confidence.high", { count });
        }
        return value;
    }, [t]);
    const relayConnectionMap = useMemo(() => new Map(pool.connections.map((connection) => [connection.url, connection])), [pool.connections]);
    const relayHealthMetricsMap = useMemo(() => new Map(pool.healthMetrics.map((metric) => [metric.url, metric])), [pool.healthMetrics]);
    const relayRuntimeStatus = useSettingsRelayRuntimeStatus();
    const relayQuickHealth = useMemo(() => {
        const enabledRelays = relayList.state.relays.filter((relay) => relay.enabled);
        const enabledSet = new Set(enabledRelays.map((relay) => relay.url));
        const openCount = pool.connections.filter((connection) => connection.status === "open" && enabledSet.has(connection.url)).length;
        const latencyValues = enabledRelays
            .map((relay) => relayHealthMetricsMap.get(relay.url)?.latency ?? 0)
            .filter((value) => Number.isFinite(value) && value > 0);
        const averageLatencyMs = latencyValues.length > 0
            ? Math.round(latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length)
            : undefined;
        return {
            openCount,
            enabledCount: enabledRelays.length,
            averageLatencyMs,
            recommendation: relayRuntimeStatus.actionText,
        };
    }, [pool.connections, relayHealthMetricsMap, relayList.state.relays, relayRuntimeStatus]);
    const relayCapabilityAssessment = useMemo(() => assessRelayCapability({
        enabledRelayUrls: relayList.state.relays.filter((relay) => relay.enabled).map((relay) => relay.url),
    }), [relayList.state.relays]);
    const sovereignRoomDefinition = useMemo(() => getCommunityModeDefinition("sovereign_room"), []);
    const managedWorkspaceDefinition = useMemo(() => getCommunityModeDefinition("managed_workspace"), []);
    const handleCheckApi = (): void => {
        const baseUrl: string = getApiBaseUrl().replace(/\/$/, "");
        if (!ENABLE_API_HEALTH_PROBE) {
            setApiHealth({
                status: "disabled",
                baseUrl,
                message: "API probe is disabled in recovery mode. Relay connectivity is the source of truth.",
            });
            return;
        }
        setApiHealth({ status: "checking" });
        const startMs: number = Date.now();
        void fetch(`${baseUrl}/v1/health`, { method: "GET" })
            .then(async (response: Response): Promise<void> => {
            const latencyMs: number = Date.now() - startMs;
            if (!response.ok) {
                setApiHealth({ status: "error", message: `HTTP ${response.status}`, baseUrl });
                return;
            }
            const data = await response.json() as {
                timeIso?: string;
            };
            setApiHealth({
                status: "ok",
                latencyMs,
                timeIso: data.timeIso ?? new Date().toISOString(),
                baseUrl,
            });
        })
            .catch((error: unknown): void => {
            const message = error instanceof Error ? error.message : "Unknown error";
            setApiHealth({ status: "error", message, baseUrl });
        });
    };
    const handleAddRelay = (): void => {
        const enabledRelayUrls = relayList.state.relays
            .filter((relay) => relay.enabled)
            .map((relay) => relay.url);
        const assessment = assessRelayAddTrust({
            rawUrl: newRelayUrl,
            enabledRelayUrls,
            allowLocalhostWs: true,
        });
        if (!assessment.allowed || !assessment.normalizedUrl) {
            toast.error(t("settings.relays.invalidRelayUrl", assessment.userMessage));
            return;
        }
        relayList.addRelay({ url: assessment.normalizedUrl });
        setNewRelayUrl("");
        if (assessment.showWorkspaceNotice) {
            toast.success(t("settings.relays.addTrust.addedWithNotice", assessment.userMessage));
            toast.info(t("settings.relays.addTrust.workspaceHint", assessment.settingsHint));
            return;
        }
        toast.success(t("settings.relays.relayAdded"));
    };
    const handleRelayBulkEnableAll = (): void => {
        if (relayList.state.relays.length === 0) {
            return;
        }
        relayList.replaceRelays({
            relays: relayList.state.relays.map((r) => ({ url: r.url, enabled: true })),
        });
        toast.success(t("settings.relays.bulkEnableAll"));
    };
    const handleRelayBulkRemoveDisabled = (): void => {
        const kept = relayList.state.relays.filter((r) => r.enabled);
        if (kept.length === 0) {
            toast.error(t("settings.relays.bulkRemoveDisabledBlocked"));
            return;
        }
        if (kept.length === relayList.state.relays.length) {
            toast.info(t("settings.relays.bulkRemoveDisabledNone"));
            return;
        }
        relayList.replaceRelays({ relays: kept });
        toast.success(t("settings.relays.bulkRemoveDisabled"));
    };
    const handleRelayBulkCopyList = async (): Promise<void> => {
        if (typeof navigator === "undefined" || !navigator.clipboard) {
            toast.error(t("settings.relays.bulkCopyUnavailable"));
            return;
        }
        try {
            await navigator.clipboard.writeText(JSON.stringify(relayList.state.relays, null, 2));
            toast.success(t("settings.relays.bulkCopySuccess"));
        }
        catch {
            toast.error(t("settings.relays.bulkCopyFailed"));
        }
    };
    const applyRelayPreset = (presetId: RelayPresetId): void => {
        const preset = RELAY_PRESETS.find((candidate) => candidate.id === presetId);
        if (!preset) {
            setRelayActionPhase("error");
            setRelayActionMessage("Unknown preset.");
            return;
        }
        relayList.replaceRelays({
            relays: preset.relays.map((url) => ({ url, enabled: true })),
        });
        if (presetId === "high_redundancy") {
            setRelayTransportMode("redundancy");
        }
        setRelayActionPhase("success");
        setRelayActionMessage(`Applied preset: ${preset.label}.`);
        toast.success(`Relay preset applied: ${preset.label}`);
    };
    const handleResetRelaySection = (): void => {
        relayList.resetRelays();
        setRelayActionPhase("success");
        setRelayActionMessage("Relay section reset to default list.");
        toast.success("Relay section reset.");
    };
    const handleRefreshRelayStatus = async (): Promise<void> => {
        relayResilienceObservability.recordOperatorIntervention();
        const enabledCount = relayList.state.relays.filter((relay) => relay.enabled).length;
        if (enabledCount === 0) {
            setRelayActionPhase("error");
            setRelayActionMessage("Enable at least one relay before refreshing status.");
            toast.error("No enabled relays to refresh.");
            return;
        }
        setRelayActionPhase("working");
        setRelayActionMessage("Refreshing relay status...");
        try {
            pool.reconnectAll();
            pool.resubscribeAll();
            await triggerRelayRecovery("manual");
            const connected = await pool.waitForConnection(2500);
            const writableSnapshot = pool.getWritableRelaySnapshot(relayList.state.relays.filter((relay) => relay.enabled).map((relay) => relay.url));
            if (connected && writableSnapshot.openRelayCount > 0) {
                setRelayActionPhase("success");
                setRelayActionMessage(`Relay status refreshed. ${writableSnapshot.openRelayCount}/${writableSnapshot.totalRelayCount} relays are writable.`);
                toast.success("Relay status refreshed.");
                return;
            }
            setRelayActionPhase("error");
            setRelayActionMessage("Refresh completed, but no writable relays are currently available.");
            toast.error("Relay refresh completed without a writable connection.");
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Relay refresh failed.";
            setRelayActionPhase("error");
            setRelayActionMessage(message);
            toast.error(message);
        }
    };
    return {
        ...destructive,
        DEFAULT_STABLE_PRESET,
        ENABLE_API_HEALTH_PROBE,
        RELAY_PRESETS,
        apiHealth,
        applyRelayPreset,
        handleAddRelay,
        handleCheckApi,
        handleRefreshRelayStatus,
        handleRelayBulkCopyList,
        handleRelayBulkEnableAll,
        handleRelayBulkRemoveDisabled,
        handleResetRelaySection,
        managedWorkspaceDefinition,
        newRelayUrl,
        pool,
        relayActionMessage,
        relayActionPhase,
        relayCapabilityAssessment,
        relayConnectionMap,
        relayHealthMetricsMap,
        relayList,
        relayQuickHealth,
        relayRuntime,
        relaySelection,
        setApiHealth,
        setNewRelayUrl,
        setRelayActionMessage,
        setRelayActionPhase,
        setShowAdvancedRelays,
        showAdvancedRelays,
        sovereignRoomDefinition,
        t,
        translateRelayConfidenceLabel,
        translateRelayNodeBadge,
        translateRelayNodeDetail,
        translateRelayNodeRole,
        translateRelayPresetLabel,
        translateRelayRuntimeText,
        triggerRelayRecovery,
    };
}
