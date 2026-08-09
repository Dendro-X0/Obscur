"use client";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@dweb/ui-kit/toast";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { useRelayPoolRef } from "@/app/features/relays/hooks/use-relay-pool-ref";
import { getApiBaseUrl } from "@/app/features/relays/utils/api-base-url";
import { assessRelayAddTrust } from "@/app/features/relays/services/relay-add-trust-assessment";
import { assessRelayCapability, getCommunityModeDefinition } from "@/app/features/groups/services/community-mode-contract";
import { relayResilienceObservability } from "@/app/features/relays/services/relay-resilience-observability";
import type { SettingsActionPhase } from "@/app/features/settings/components/settings-action-status";
import type { SettingsTabPanelModel } from "../settings-tab-panel-model-context";
import {
  buildRelayRowsFromPreset,
  getTransportPreset,
  PRODUCT_BOOT_TRANSPORT_PRESET,
} from "@/app/features/transport-kernel/transport-preset-catalog";
import { applyRustMeshConfigureFromPreset } from "@/app/features/transport-kernel/apply-rust-mesh-configure";
import {
  isTorPresetApplyBlocked,
  resolveTemplatePrefillUrl,
  shouldConfirmTransportPresetApply,
} from "@/app/features/transport-kernel/transport-preset-apply-policy";
import { useConduitMeshTorSettingsState } from "@/app/features/transport-kernel/use-conduit-mesh-tor-settings-state";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { workspaceRelayUrlsMatch } from "@/app/features/groups/services/workspace-relay-url";
import { computeRelayQuickAverageLatency } from "@/app/features/relays/lib/format-relay-latency-label";
import {
  humanizeRelayNodeDetailCode,
  relayNodeDetailCodeI18nKey,
} from "@/app/features/relays/lib/relay-node-detail-copy";
import { DEFAULT_STABLE_PRESET, ENABLE_API_HEALTH_PROBE, RELAY_PRESETS, TRANSPORT_PRESET_GROUPS, type ApiHealthState, type RelayPresetId, } from "../settings-tab-panel-shared";
import { useSettingsDestructiveActionsModel } from "./use-settings-destructive-actions-model";
import { useSettingsRelayRuntimeStatus } from "./use-settings-relay-runtime-status";
export function useRelaysSettingsModel(): SettingsTabPanelModel {
    const { t } = useTranslation();
    const destructive = useSettingsDestructiveActionsModel();
    const torState = useConduitMeshTorSettingsState();
    const { relayPool: pool, relayList, relayRuntime, triggerRelayRecovery, relaySelection, setRelayTransportMode, } = useRelay();
    const poolRef = useRelayPoolRef(pool);
    const [apiHealth, setApiHealth] = useState<ApiHealthState>({ status: "idle" });
    const [newRelayUrl, setNewRelayUrl] = useState<string>("");
    const [showAdvancedRelays, setShowAdvancedRelays] = useState<boolean>(false);
    const [relayActionPhase, setRelayActionPhase] = useState<SettingsActionPhase>("idle");
    const [relayActionMessage, setRelayActionMessage] = useState<string>("");
    const [pendingPresetApplyId, setPendingPresetApplyId] = useState<RelayPresetId | null>(null);
    const [isPresetApplyConfirmOpen, setIsPresetApplyConfirmOpen] = useState(false);
    const translateRelayPresetLabel = useCallback((presetId: RelayPresetId): string => {
        const preset = getTransportPreset(presetId);
        return preset ? t(preset.labelKey) : presetId;
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
            case "Relay window quiet":
                return t("settings.relays.runtime.eventFlowDegraded");
            case "Relay connectivity degraded":
                return t("settings.relays.runtime.connectivityDegraded");
            case "Sockets are open and may have fine Connect/RTT; this window is idle (no recent events). Quiet is not high latency — send or wait for traffic.":
                return t("settings.relays.runtime.eventFlowDegradedDesc");
            case "Sockets are open, but this window has not seen recent relay events.":
                return t("settings.relays.runtime.eventFlowDegradedDesc");
            case "Relay event flow degraded":
                return t("settings.relays.runtime.eventFlowDegraded");
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
            case "Quiet": return t("settings.relays.node.badge.quiet", { defaultValue: "Quiet" });
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
            case "Primary": return t("settings.relays.node.role.primary", { defaultValue: "Primary" });
            case "Primary (offline)": return t("settings.relays.node.role.primaryOffline", { defaultValue: "Primary (offline)" });
            case "Active transport": return t("settings.relays.node.role.activeTransport", { defaultValue: "Active transport" });
            case "Pool member": return t("settings.relays.node.role.poolMember", { defaultValue: "Pool member" });
            case "Standby": return t("settings.relays.node.role.standby", { defaultValue: "Standby" });
            case "Standby (probed)": return t("settings.relays.node.role.standbyProbed", { defaultValue: "Standby (probed)" });
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
            case "Socket open — window idle, not high latency.":
                return t("settings.relays.node.detail.quiet", {
                    defaultValue: "Socket open — window idle, not high latency.",
                });
            case "Socket is open. This window is idle (no recent events) — not high latency. Send or wait for traffic; see Connect/RTT on the latency badge.":
                return t("settings.relays.node.detail.quiet", {
                    defaultValue: "Socket open — window idle, not high latency.",
                });
            case "Selected primary — no open socket yet.":
                return t("settings.relays.node.detail.primaryDisconnected", {
                    defaultValue: "Selected primary — no open socket yet.",
                });
            case "Not in the active transport pool.":
                return t("settings.relays.node.detail.standbyDisconnected", {
                    defaultValue: "Not in the active transport pool.",
                });
            case "No active socket.":
                return t("settings.relays.node.detail.disconnected", {
                    defaultValue: "No active socket.",
                });
            case "websocket_error":
                return t("settings.relays.node.detail.websocketError", {
                    defaultValue: "WebSocket connection failed.",
                });
            default: {
                if (value.startsWith("Repeated failures triggered backoff. Next retry is scheduled automatically.")) {
                    return t("settings.relays.node.detail.backoffRetry");
                }
                const codeKey = relayNodeDetailCodeI18nKey(value);
                const codeDefault = humanizeRelayNodeDetailCode(value);
                if (codeKey && codeDefault) {
                    return t(codeKey, { defaultValue: codeDefault });
                }
                return value;
            }
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
        const openEnabledUrls = pool.connections
            .filter((connection) => connection.status === "open" && (
                enabledSet.has(connection.url)
                || enabledRelays.some((relay) => workspaceRelayUrlsMatch(relay.url, connection.url))
            ))
            .map((connection) => connection.url);
        const openCount = openEnabledUrls.length;
        const average = computeRelayQuickAverageLatency({
            openEnabledUrls,
            metricsByUrl: relayHealthMetricsMap,
        });
        return {
            openCount,
            enabledCount: enabledRelays.length,
            averageLatencyMs: average.averageLatencyMs,
            averageLatencyKind: average.kind,
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
    const applyRelayPreset = useCallback((presetId: RelayPresetId): string | undefined => {
        const preset = getTransportPreset(presetId);
        if (!preset) {
            setRelayActionPhase("error");
            setRelayActionMessage("Unknown preset.");
            return undefined;
        }
        if (isTorPresetApplyBlocked(preset, torState)) {
            const blockedMessage = torState.configured
                ? t("settings.relays.presetTorNotReady", {
                    defaultValue: "Tor is still starting. Wait until Tor is ready, then apply this pack.",
                })
                : t("settings.relays.presetTorFollowUp");
            setRelayActionPhase("error");
            setRelayActionMessage(blockedMessage);
            toast.error(blockedMessage);
            return undefined;
        }
        relayList.replaceRelays({
            relays: [...buildRelayRowsFromPreset(preset)],
        });
        setRelayTransportMode(preset.transportMode);
        void applyRustMeshConfigureFromPreset({
            profileId: getResolvedProfileId(),
            preset,
            torReady: torState.ready,
            torConfigured: torState.configured,
            connect: true,
        }).then((meshResult) => {
            if (meshResult.attempted && !meshResult.ok) {
                console.warn(
                    "[relays] configureMeshConduits soft-failed after preset apply",
                    meshResult.errorMessage,
                );
            }
        });
        const label = t(preset.labelKey);
        const description = t(preset.descriptionKey);
        const followUps = [
            preset.requiresTor && !torState.ready ? t("settings.relays.presetTorFollowUp") : "",
            preset.isUrlTemplate ? t("settings.relays.presetTemplateFollowUp") : "",
        ].filter(Boolean).join(" ");
        setRelayActionPhase("success");
        setRelayActionMessage(followUps ? `${label}: ${description} ${followUps}` : `${label}: ${description}`);
        toast.success(t("settings.relays.presetApplied", { defaultValue: "Transport preset applied: {{label}}", label }));
        if (followUps) {
            toast.info(followUps);
        }
        return resolveTemplatePrefillUrl(preset);
    }, [relayList, setRelayTransportMode, t, torState]);
    const requestApplyRelayPreset = useCallback((presetId: RelayPresetId): string | undefined => {
        const preset = getTransportPreset(presetId);
        if (preset && isTorPresetApplyBlocked(preset, torState)) {
            return applyRelayPreset(presetId);
        }
        if (preset && shouldConfirmTransportPresetApply(preset, relayList.state.relays)) {
            setPendingPresetApplyId(presetId);
            setIsPresetApplyConfirmOpen(true);
            return undefined;
        }
        return applyRelayPreset(presetId);
    }, [applyRelayPreset, relayList.state.relays, torState]);
    const confirmApplyRelayPreset = useCallback((): string | undefined => {
        if (!pendingPresetApplyId) {
            return undefined;
        }
        const prefillUrl = applyRelayPreset(pendingPresetApplyId);
        setPendingPresetApplyId(null);
        setIsPresetApplyConfirmOpen(false);
        return prefillUrl;
    }, [applyRelayPreset, pendingPresetApplyId]);
    const cancelApplyRelayPreset = useCallback((): void => {
        setPendingPresetApplyId(null);
        setIsPresetApplyConfirmOpen(false);
    }, []);
    const handleResetRelaySection = (): void => {
        relayList.resetRelays();
        setRelayTransportMode(PRODUCT_BOOT_TRANSPORT_PRESET.transportMode);
        void applyRustMeshConfigureFromPreset({
            profileId: getResolvedProfileId(),
            preset: PRODUCT_BOOT_TRANSPORT_PRESET,
            torReady: torState.ready,
            torConfigured: torState.configured,
            connect: true,
        });
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
        TRANSPORT_PRESET_GROUPS,
        apiHealth,
        applyRelayPreset,
        cancelApplyRelayPreset,
        confirmApplyRelayPreset,
        handleAddRelay,
        handleCheckApi,
        handleRefreshRelayStatus,
        handleRelayBulkCopyList,
        handleRelayBulkEnableAll,
        handleRelayBulkRemoveDisabled,
        handleResetRelaySection,
        isPresetApplyConfirmOpen,
        managedWorkspaceDefinition,
        pendingPresetApplyId,
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
        requestApplyRelayPreset,
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
