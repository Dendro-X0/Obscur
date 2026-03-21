import { logWithRateLimit } from "@/app/shared/log-hygiene";
import { reportDevRuntimeIssue, type DevRuntimeIssueDomain } from "@/app/shared/dev-runtime-issue-reporter";

type AppEventLevel = "debug" | "info" | "warn" | "error";

type AppEvent = Readonly<{
  name: string;
  level: AppEventLevel;
  atUnixMs: number;
  scope?: Readonly<{ feature: string; action: string }>;
  context?: Readonly<Record<string, string | number | boolean | null>>;
}>;

type LogAppEventParams = Readonly<{
  name: string;
  level?: AppEventLevel;
  scope?: Readonly<{ feature: string; action: string }>;
  context?: Readonly<Record<string, string | number | boolean | null>>;
}>;

type AppEventDiagnosticsApi = Readonly<{
  getRecent: (count?: number) => ReadonlyArray<AppEvent>;
  findByName: (name: string, count?: number) => ReadonlyArray<AppEvent>;
  getDigest: (count?: number) => Readonly<{
    total: number;
    windowSize: number;
    byLevel: Readonly<Record<AppEventLevel, number>>;
    topNames: ReadonlyArray<Readonly<{ name: string; count: number }>>;
    recentErrors: ReadonlyArray<Readonly<{ name: string; atUnixMs: number; reasonCode: string | null }>>;
    warmUpSummary: ReadonlyArray<Readonly<{ name: string; toPhase: string | null; reasonCode: string | null; atUnixMs: number }>>;
  }>;
  getCrossDeviceSyncDigest: (count?: number) => Readonly<{
    totalBufferedEvents: number;
    windowSize: number;
    generatedAtUnixMs: number;
    events: Readonly<Record<string, ReadonlyArray<Readonly<{
      atUnixMs: number;
      level: AppEventLevel;
      context: Readonly<Record<string, string | number | boolean | null>>;
    }>>>>;
    recentWarnOrError: ReadonlyArray<Readonly<{
      name: string;
      atUnixMs: number;
      level: AppEventLevel;
      reasonCode: string | null;
      message: string | null;
    }>>;
  }>;
  clear: () => void;
}>;

const APP_EVENT_ISSUE_EXCLUSION_SET: ReadonlySet<string> = new Set([
  "messaging.delivery.sender_delivery_failed",
  "messaging.delivery.sender_delivery_queued",
]);

const DEV_WARN_ONLY_ERROR_EVENT_SET: ReadonlySet<string> = new Set([
  "messaging.delivery.sender_delivery_failed",
]);

const APP_EVENT_BUFFER_KEY = "__obscur_app_event_buffer__";
const APP_EVENT_API_KEY = "obscurAppEvents";
const APP_EVENT_BUFFER_MAX = 500;
const RUNTIME_WARN_EVENT_PATTERN = /(failed|failure|timeout|timed_out|unavailable|insufficient|rejected|degraded|cooldown|mismatch|error)/i;
const CROSS_DEVICE_DIGEST_EVENT_CONFIG: Readonly<Record<string, ReadonlyArray<string>>> = {
  "account_sync.backup_restore_merge_diagnostics": [
    "publicKeySuffix",
    "freshDevice",
    "includeHydratedLocalMessages",
    "localPayloadMerged",
    "incomingLedgerEntryCount",
    "localLedgerEntryCount",
    "mergedLedgerEntryCount",
    "incomingDmOutgoingCount",
    "localDmOutgoingCount",
    "mergedDmOutgoingCount",
    "incomingGroupConversationCount",
    "localGroupConversationCount",
    "mergedGroupConversationCount",
  ],
  "account_sync.backup_restore_apply_diagnostics": [
    "publicKeySuffix",
    "restorePath",
    "restoreChatStateDomains",
    "appliedDmOutgoingCount",
    "appliedDmIncomingCount",
    "appliedDmMessageCount",
    "appliedGroupConversationCount",
    "appliedGroupMessageCount",
    "appliedGroupSelfAuthoredCount",
  ],
  "account_sync.backup_payload_projection_fallback": [
    "profileId",
    "reasonNoOutgoingHistory",
    "reasonSparseOutgoingEvidence",
    "sparseOutgoingEvidenceThreshold",
    "outgoingCountBeforeFallback",
    "outgoingCountAfterFallback",
    "sourceRecordCount",
    "sourceOutgoingRecordCount",
    "sourceIncomingRecordCount",
  ],
  "account_sync.backup_payload_hydration_diagnostics": [
    "publicKeySuffix",
    "sourceRecordCount",
    "sourceOutgoingRecordCount",
    "sourceIncomingRecordCount",
    "hydratedDmMessageCount",
    "hydratedDmOutgoingCount",
    "hydratedDmIncomingCount",
    "hydratedDmIncomingOnlyConversationCount",
  ],
  "groups.membership_recovery_hydrate": [
    "publicKeySuffix",
    "profileId",
    "persistedGroupCount",
    "ledgerEntryCount",
    "visibleGroupCount",
    "hiddenByLedgerStatusCount",
    "missingLedgerCoverageCount",
  ],
  "groups.membership_ledger_load": [
    "publicKeySuffix",
    "profileId",
    "scopedEntryCount",
    "legacyEntryCount",
    "mergedEntryCount",
  ],
  "messaging.chat_state_replaced": [
    "publicKeySuffix",
    "profileId",
    "createdConnectionCount",
    "createdGroupCount",
    "dmConversationCount",
    "groupConversationCount",
  ],
  "account_sync.backup_restore_result": [
    "reason",
    "result",
    "guardEnabled",
    "convergenceLatencyMs",
  ],
  "account_sync.backup_publish_result": [
    "reason",
    "result",
    "guardEnabled",
  ],
  "runtime.activation.timeout": [
    "timeouts",
    "projectionPhase",
    "projectionStatus",
    "relayOpenCount",
    "relayTotalCount",
  ],
  "runtime.activation.degraded": [
    "resultPhase",
    "activationDurationMs",
    "relayOpenWaitMs",
    "relayOpenCount",
    "relayTotalCount",
  ],
};

const toStringOrNull = (value: unknown): string | null => (
  typeof value === "string" && value.trim().length > 0 ? value : null
);

const toCompactContext = (
  context: AppEvent["context"] | undefined,
  keys: ReadonlyArray<string>,
): Readonly<Record<string, string | number | boolean | null>> => {
  const compact: Record<string, string | number | boolean | null> = {};
  if (!context) {
    return compact;
  }
  keys.forEach((key) => {
    const value = context[key];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
      compact[key] = value;
    }
  });
  return compact;
};

const getEventBuffer = (): AppEvent[] => {
  const root = globalThis as Record<string, unknown>;
  const existing = root[APP_EVENT_BUFFER_KEY];
  if (Array.isArray(existing)) {
    return existing as AppEvent[];
  }
  const next: AppEvent[] = [];
  root[APP_EVENT_BUFFER_KEY] = next;
  return next;
};

const installDiagnosticsApi = (): void => {
  const root = globalThis as Record<string, unknown>;
  if (root[APP_EVENT_API_KEY]) {
    return;
  }
  const api: AppEventDiagnosticsApi = {
    getRecent: (count = 100): ReadonlyArray<AppEvent> => {
      const maxCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 100;
      const buffer = getEventBuffer();
      if (maxCount === 0) {
        return [];
      }
      return buffer.slice(-maxCount);
    },
    findByName: (name: string, count = 100): ReadonlyArray<AppEvent> => {
      const normalizedName = name.trim();
      if (!normalizedName) {
        return [];
      }
      const maxCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 100;
      const matches = getEventBuffer().filter((event) => event.name === normalizedName);
      if (maxCount === 0) {
        return [];
      }
      return matches.slice(-maxCount);
    },
    getDigest: (count = 200) => {
      const windowSize = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : 200;
      const recent = getEventBuffer().slice(-windowSize);
      const byLevel: Record<AppEventLevel, number> = {
        debug: 0,
        info: 0,
        warn: 0,
        error: 0,
      };
      const byName = new Map<string, number>();
      recent.forEach((event) => {
        byLevel[event.level] += 1;
        byName.set(event.name, (byName.get(event.name) ?? 0) + 1);
      });
      const topNames = Array.from(byName.entries())
        .sort((left, right) => right[1] - left[1])
        .slice(0, 8)
        .map(([name, seen]) => ({ name, count: seen }));
      const recentErrors = recent
        .filter((event) => event.level === "error")
        .slice(-8)
        .map((event) => ({
          name: event.name,
          atUnixMs: event.atUnixMs,
          reasonCode: typeof event.context?.reasonCode === "string"
            ? event.context.reasonCode
            : typeof event.context?.toReasonCode === "string"
              ? event.context.toReasonCode
              : typeof event.context?.primaryReasonCode === "string"
                ? event.context.primaryReasonCode
                : null,
        }));
      const warmUpSummary = recent
        .filter((event) => event.name === "warmup.phase_transition" || event.name === "warmup.rollout_gate_result")
        .slice(-12)
        .map((event) => ({
          name: event.name,
          toPhase: typeof event.context?.toPhase === "string"
            ? event.context.toPhase
            : typeof event.context?.terminalPhase === "string"
              ? event.context.terminalPhase
              : null,
          reasonCode: typeof event.context?.toReasonCode === "string"
            ? event.context.toReasonCode
            : typeof event.context?.primaryReasonCode === "string"
              ? event.context.primaryReasonCode
              : null,
          atUnixMs: event.atUnixMs,
        }));
      return {
        total: getEventBuffer().length,
        windowSize: recent.length,
        byLevel,
        topNames,
        recentErrors,
        warmUpSummary,
      };
    },
    getCrossDeviceSyncDigest: (count = 300) => {
      const windowSize = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : 300;
      const recent = getEventBuffer().slice(-windowSize);
      const events = Object.fromEntries(
        Object.entries(CROSS_DEVICE_DIGEST_EVENT_CONFIG).map(([name, keys]) => {
          const compactEvents = recent
            .filter((event) => event.name === name)
            .slice(-6)
            .map((event) => ({
              atUnixMs: event.atUnixMs,
              level: event.level,
              context: toCompactContext(event.context, keys),
            }));
          return [name, compactEvents] as const;
        })
      );
      const recentWarnOrError = recent
        .filter((event) => event.level === "warn" || event.level === "error")
        .slice(-12)
        .map((event) => ({
          name: event.name,
          atUnixMs: event.atUnixMs,
          level: event.level,
          reasonCode: toStringOrNull(
            event.context?.reasonCode
            ?? event.context?.toReasonCode
            ?? event.context?.primaryReasonCode
            ?? event.context?.reason
            ?? event.context?.errorCode
          ),
          message: toStringOrNull(
            event.context?.message
            ?? event.context?.error
            ?? event.context?.detail
          ),
        }));
      return {
        totalBufferedEvents: getEventBuffer().length,
        windowSize: recent.length,
        generatedAtUnixMs: Date.now(),
        events,
        recentWarnOrError,
      };
    },
    clear: (): void => {
      const buffer = getEventBuffer();
      buffer.splice(0, buffer.length);
    },
  };
  root[APP_EVENT_API_KEY] = api;
};

const bufferAppEvent = (event: AppEvent): void => {
  const buffer = getEventBuffer();
  buffer.push(event);
  if (buffer.length > APP_EVENT_BUFFER_MAX) {
    buffer.splice(0, buffer.length - APP_EVENT_BUFFER_MAX);
  }
  installDiagnosticsApi();
};

const toIssueDomain = (feature?: string): DevRuntimeIssueDomain => {
  if (!feature) return "unknown";
  if (feature === "relay" || feature === "relays") return "relay";
  if (feature === "messaging") return "messaging";
  if (feature === "runtime" || feature === "auth" || feature === "profile" || feature === "profiles") return "runtime";
  if (feature === "storage") return "storage";
  if (feature === "upload") return "upload";
  return "unknown";
};

const shouldEscalateToRuntimeIssue = (event: AppEvent): boolean => {
  if (APP_EVENT_ISSUE_EXCLUSION_SET.has(event.name)) {
    return false;
  }
  if (event.level === "error") {
    return true;
  }
  if (event.level === "warn" && RUNTIME_WARN_EVENT_PATTERN.test(event.name)) {
    return true;
  }
  return false;
};

const emitRuntimeIssueFromAppEvent = (event: AppEvent): void => {
  if (!shouldEscalateToRuntimeIssue(event)) {
    return;
  }
  const reasonLike = event.context?.reasonCode
    ?? event.context?.reason
    ?? event.context?.errorCode
    ?? null;
  const messageLike = event.context?.message
    ?? event.context?.error
    ?? event.context?.detail
    ?? null;

  reportDevRuntimeIssue({
    domain: toIssueDomain(event.scope?.feature),
    operation: event.scope?.action ?? event.name,
    severity: event.level === "error" ? "error" : "warn",
    reasonCode: typeof reasonLike === "string" ? reasonLike : undefined,
    message: typeof messageLike === "string" && messageLike.trim().length > 0
      ? messageLike
      : `App event signaled issue: ${event.name}`,
    retryable: event.level !== "error",
    source: "log-app-event",
    context: {
      eventName: event.name,
      feature: event.scope?.feature ?? null,
      action: event.scope?.action ?? null,
      ...(event.context ?? {}),
    },
    fingerprint: [
      "app_event",
      event.level,
      event.name,
      typeof reasonLike === "string" ? reasonLike : "none",
    ].join("|"),
  });
};

export const logAppEvent = (params: LogAppEventParams): void => {
  const event: AppEvent = {
    name: params.name,
    level: params.level ?? "info",
    atUnixMs: Date.now(),
    scope: params.scope,
    context: params.context
  };
  bufferAppEvent(event);
  emitRuntimeIssueFromAppEvent(event);
  const payload: string = JSON.stringify(event);
  const key = `app_event.${event.level}.${event.name}`;
  if (event.level === "error") {
    const shouldWarnOnlyInDev = (
      process.env.NODE_ENV !== "production"
      && DEV_WARN_ONLY_ERROR_EVENT_SET.has(event.name)
    );
    logWithRateLimit(shouldWarnOnlyInDev ? "warn" : "error", key, [payload], {
      windowMs: 20_000,
      maxPerWindow: 4,
      summaryEverySuppressed: 10,
    });
    return;
  }
  if (event.level === "warn") {
    logWithRateLimit("warn", key, [payload], {
      windowMs: 20_000,
      maxPerWindow: 6,
      summaryEverySuppressed: 15,
    });
    return;
  }
  if (event.level === "debug") {
    logWithRateLimit("debug", key, [payload], {
      windowMs: 10_000,
      maxPerWindow: 8,
      summaryEverySuppressed: 25,
    });
    return;
  }
  logWithRateLimit("info", key, [payload], {
    windowMs: 10_000,
    maxPerWindow: 20,
    summaryEverySuppressed: 50,
  });
};
