import type { RelayHealthMetrics } from "@/app/features/relays/hooks/relay-health-monitor";
import type { RelayConnection } from "@/app/features/relays/hooks/relay-connection";
import type { RelayRuntimePhase, RelayRuntimeSnapshot } from "@/app/features/relays/services/relay-runtime-contracts";

export type RelayUiStatus = "healthy" | "degraded" | "recovering" | "unavailable";

export type RelayRuntimeStatus = Readonly<{
  status: RelayUiStatus;
  label: string;
  actionText: string;
  openCount: number;
  totalCount: number;
}>;

export type RelayNodeStatus = Readonly<{
  status: RelayUiStatus;
  badge: string;
  detail: string;
  roleLabel: string;
  successLabel: string;
  confidenceLabel: string;
}>;

const STALE_EVENT_WINDOW_MS = 45_000;

const getSampleCount = (metrics?: RelayHealthMetrics): number => {
  if (!metrics) return 0;
  return metrics.successfulConnections + metrics.failedConnections;
};

const getSuccessLabel = (metrics?: RelayHealthMetrics): string => {
  const samples = getSampleCount(metrics);
  if (samples < 5) {
    return "n/a";
  }
  return `${Math.round(metrics?.successRate ?? 0)}%`;
};

const getConfidenceLabel = (metrics?: RelayHealthMetrics): string => {
  const samples = getSampleCount(metrics);
  if (samples < 5) return `Insufficient data (${samples})`;
  if (samples < 20) return `Low confidence (${samples})`;
  return `High confidence (${samples})`;
};

const isEventFlowStale = (params: Readonly<{
  phase?: RelayRuntimePhase;
  lastInboundEventAtUnixMs?: number;
  nowUnixMs?: number;
}>): boolean => {
  if (params.phase === "recovering" || params.phase === "connecting" || params.phase === "offline") {
    return false;
  }
  if (typeof params.lastInboundEventAtUnixMs !== "number") {
    return true;
  }
  return (params.nowUnixMs ?? Date.now()) - params.lastInboundEventAtUnixMs > STALE_EVENT_WINDOW_MS;
};

export const deriveRelayRuntimeStatus = (params: Readonly<{
  totalCount: number;
  openCount: number;
  writableCount?: number;
  subscribableCount?: number;
  phase?: RelayRuntimePhase;
  recoveryStage?: RelayRuntimeSnapshot["recoveryStage"];
  lastInboundEventAtUnixMs?: number;
  fallbackRelayCount?: number;
  nowUnixMs?: number;
}>): RelayRuntimeStatus => {
  const totalCount = Math.max(0, params.totalCount);
  const openCount = Math.max(0, params.openCount);
  const writableCount = Math.max(0, params.writableCount ?? openCount);
  const subscribableCount = Math.max(0, params.subscribableCount ?? openCount);
  const phase = params.phase;
  const fallbackRelayCount = Math.max(0, params.fallbackRelayCount ?? 0);
  const staleEvents = isEventFlowStale({
    phase,
    lastInboundEventAtUnixMs: params.lastInboundEventAtUnixMs,
    nowUnixMs: params.nowUnixMs,
  });

  if (totalCount === 0) {
    return {
      status: "unavailable",
      label: "No relay configured",
      actionText: "Add at least one relay in Settings -> Relays.",
      openCount,
      totalCount,
    };
  }

  if (phase === "recovering" || phase === "connecting") {
    return {
      status: "recovering",
      label: phase === "recovering" ? "Relay recovery in progress" : "Relay connections starting",
      actionText: params.recoveryStage
        ? `Restoring runtime state: ${params.recoveryStage.replace(/_/g, " ")}.`
        : "Reconnecting relays and restoring subscriptions.",
      openCount,
      totalCount,
    };
  }

  if (writableCount === 0) {
    return {
      status: "unavailable",
      label: "No writable relays available",
      actionText: "Messages can queue locally, but relay-backed delivery is currently unavailable.",
      openCount,
      totalCount,
    };
  }

  const configuredRelaysHealthy = openCount >= totalCount && totalCount > 0 && subscribableCount >= totalCount && !staleEvents;

  if (configuredRelaysHealthy && phase === "healthy") {
    return {
      status: "healthy",
      label: fallbackRelayCount > 0 ? "Configured relays healthy" : "Relay communication healthy",
      actionText: fallbackRelayCount > 0
        ? "Configured relays are healthy again. Fallback relays may remain connected temporarily as standby coverage."
        : "Configured relays are writable and this window is seeing recent relay events.",
      openCount,
      totalCount,
    };
  }

  if (fallbackRelayCount > 0 || staleEvents || openCount < totalCount || subscribableCount < totalCount) {
    return {
      status: "degraded",
      label: staleEvents ? "Relay event flow degraded" : "Relay connectivity degraded",
      actionText: staleEvents
        ? "Sockets are open, but this window has not seen recent relay events."
        : fallbackRelayCount > 0
          ? "Fallback relays are active; connectivity is working with reduced trust and redundancy."
          : "Some configured relays are unavailable or partially useful. Review individual relay status below.",
      openCount,
      totalCount,
    };
  }

  return {
    status: "healthy",
    label: "Relay communication healthy",
    actionText: "Configured relays are writable and this window is seeing recent relay events.",
    openCount,
    totalCount,
  };
};

export const deriveRelayNodeStatus = (params: Readonly<{
  url: string;
  enabled: boolean;
  connection?: RelayConnection;
  metrics?: RelayHealthMetrics;
  isFallback?: boolean;
  isConfigured?: boolean;
  runtimePhase?: RelayRuntimePhase;
  lastInboundEventAtUnixMs?: number;
  nowUnixMs?: number;
}>): RelayNodeStatus => {
  const { enabled, connection, metrics } = params;
  const samples = getSampleCount(metrics);
  const roleLabel = !enabled
    ? "Disabled"
    : params.isFallback
      ? "Fallback"
      : params.isConfigured === false
        ? "Transient"
        : "Configured";
  const successLabel = getSuccessLabel(metrics);
  const confidenceLabel = getConfidenceLabel(metrics);
  const staleEvents = isEventFlowStale({
    phase: params.runtimePhase,
    lastInboundEventAtUnixMs: params.lastInboundEventAtUnixMs,
    nowUnixMs: params.nowUnixMs,
  });

  if (!enabled) {
    return {
      status: "unavailable",
      badge: "Disabled",
      detail: "This relay is configured for the profile but currently disabled.",
      roleLabel,
      successLabel,
      confidenceLabel,
    };
  }

  if (metrics?.circuitBreakerState === "open") {
    return {
      status: "recovering",
      badge: "Cooling down",
      detail: metrics.nextRetryAt
        ? `Repeated failures triggered backoff. Next retry is scheduled automatically.`
        : "Repeated failures triggered relay backoff.",
      roleLabel,
      successLabel,
      confidenceLabel,
    };
  }

  if (connection?.status === "connecting") {
    return {
      status: "recovering",
      badge: "Connecting",
      detail: "The runtime is actively establishing this relay connection.",
      roleLabel,
      successLabel,
      confidenceLabel,
    };
  }

  if (connection?.status === "error") {
    return {
      status: "unavailable",
      badge: "Error",
      detail: metrics?.lastError || connection.errorMessage || "The last relay connection attempt failed.",
      roleLabel,
      successLabel,
      confidenceLabel,
    };
  }

  if (connection?.status === "open") {
    if (params.isFallback) {
      return {
        status: "degraded",
        badge: "Fallback active",
        detail: "This relay is connected as temporary fallback coverage, not primary configured transport.",
        roleLabel,
        successLabel,
        confidenceLabel,
      };
    }
    if (metrics?.circuitBreakerState === "half-open") {
      return {
        status: "degraded",
        badge: "Degraded",
        detail: "This relay is connected, but it is still being evaluated after recent failures.",
        roleLabel,
        successLabel,
        confidenceLabel,
      };
    }
    if (typeof metrics?.latency === "number" && metrics.latency > 1500) {
      return {
        status: "degraded",
        badge: "High latency",
        detail: "The socket is open, but observed latency is high enough to reduce delivery quality.",
        roleLabel,
        successLabel,
        confidenceLabel,
      };
    }
    if (staleEvents) {
      return {
        status: "degraded",
        badge: "No recent events",
        detail: "The socket is open, but this window has not seen recent useful relay events.",
        roleLabel,
        successLabel,
        confidenceLabel,
      };
    }
    return {
      status: "healthy",
      badge: samples < 5 ? "Connected" : "Connected",
      detail: "Socket open and contributing to this window's relay runtime.",
      roleLabel,
      successLabel,
      confidenceLabel,
    };
  }

  return {
    status: "unavailable",
    badge: "Disconnected",
    detail: "This relay is configured but does not currently have an active socket.",
    roleLabel,
    successLabel,
    confidenceLabel,
  };
};
