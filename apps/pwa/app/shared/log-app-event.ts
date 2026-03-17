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

const APP_EVENT_ISSUE_EXCLUSION_SET: ReadonlySet<string> = new Set([
  "messaging.delivery.sender_delivery_failed",
  "messaging.delivery.sender_delivery_queued",
]);

const DEV_WARN_ONLY_ERROR_EVENT_SET: ReadonlySet<string> = new Set([
  "messaging.delivery.sender_delivery_failed",
]);

const RUNTIME_WARN_EVENT_PATTERN = /(failed|failure|timeout|timed_out|unavailable|insufficient|rejected|degraded|cooldown|mismatch|error)/i;

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
