type MinimalAppEvent = Readonly<{
  name: string;
  level?: string;
  atUnixMs?: number;
  context?: Readonly<Record<string, string | number | boolean | null>>;
}>;

type IncomingRequestAntiAbuseSummary = Readonly<{
  riskLevel: "none" | "watch" | "high";
  quarantinedCount: number;
  peerRateLimitedCount: number;
  peerCooldownActiveCount: number;
  globalRateLimitedCount: number;
  uniquePeerPrefixCount: number;
  latestReasonCode: string | null;
  latestPeerPubkeyPrefix: string | null;
  latestCooldownRemainingMs: number | null;
}>;

type MinimalCrossDeviceDigest = Readonly<{
  summary?: Readonly<{
    incomingRequestAntiAbuse?: IncomingRequestAntiAbuseSummary;
  }>;
  events?: Readonly<Record<string, ReadonlyArray<Readonly<{
    atUnixMs: number;
    level: string;
    context: Readonly<Record<string, string | number | boolean | null>>;
  }>>>>;
  recentWarnOrError?: ReadonlyArray<Readonly<{
    name: string;
    level: string;
    atUnixMs: number;
    reasonCode?: string | null;
  }>>;
}>;

type MinimalAppEventsApi = Readonly<{
  getCrossDeviceSyncDigest?: (count?: number) => unknown;
  findByName?: (name: string, count?: number) => ReadonlyArray<MinimalAppEvent>;
}>;

type MinimalM0TriageApi = Readonly<{
  capture?: (count?: number) => unknown;
}>;

export type M7AntiAbuseCaptureBundle = Readonly<{
  generatedAtUnixMs: number;
  version: "obscur.m7.anti_abuse.v1";
  source: Readonly<{
    userAgent: string;
    locationHref: string;
  }>;
  checks: Readonly<{
    requiredApis: Readonly<{
      appEvents: boolean;
      m0Triage: boolean;
    }>;
  }>;
  antiAbuse: Readonly<{
    summary: IncomingRequestAntiAbuseSummary | null;
    compactQuarantineEvents: ReadonlyArray<Readonly<{
      atUnixMs: number;
      level: string;
      context: Readonly<Record<string, string | number | boolean | null>>;
    }>>;
    recentQuarantinedEvents: ReadonlyArray<MinimalAppEvent>;
    recentWarnOrError: ReadonlyArray<Readonly<{
      name: string;
      level: string;
      atUnixMs: number;
      reasonCode: string | null;
    }>>;
    replayReadiness: Readonly<{
      observedReasonCodes: ReadonlyArray<string>;
      hasPeerRateLimited: boolean;
      hasPeerCooldownActive: boolean;
      hasExpectedReasonTransition: boolean;
      digestHasPeerRateLimitedCount: boolean;
      digestHasPeerCooldownActiveCount: boolean;
      readyForCp3Evidence: boolean;
    }>;
  }>;
  m0Triage: unknown | null;
}>;

type M7AntiAbuseCaptureApi = Readonly<{
  capture: (eventWindowSize?: number) => M7AntiAbuseCaptureBundle;
  captureJson: (eventWindowSize?: number) => string;
}>;

const DEFAULT_EVENT_WINDOW_SIZE = 400;
const EVENT_CAPTURE_LIMIT = 30;
const QUARANTINE_EVENT_NAME = "messaging.request.incoming_quarantined";
const PEER_RATE_LIMITED_REASON_CODE = "incoming_connection_request_peer_rate_limited";
const PEER_COOLDOWN_ACTIVE_REASON_CODE = "incoming_connection_request_peer_cooldown_active";

type M7AntiAbuseCaptureWindow = Window & {
  obscurAppEvents?: MinimalAppEventsApi;
  obscurM0Triage?: MinimalM0TriageApi;
  obscurM7AntiAbuseCapture?: M7AntiAbuseCaptureApi;
};

declare global {
  interface Window {
    obscurM7AntiAbuseCapture?: M7AntiAbuseCaptureApi;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null
);

const toStringOrNull = (value: unknown): string | null => (
  typeof value === "string" && value.trim().length > 0 ? value : null
);

const toNumber = (value: unknown): number => (
  typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 0
);

const toNumericWindowSize = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.floor(value));
  }
  return DEFAULT_EVENT_WINDOW_SIZE;
};

const toPrimitiveContext = (
  value: unknown,
): Readonly<Record<string, string | number | boolean | null>> => {
  if (!isRecord(value)) {
    return {};
  }
  const next: Record<string, string | number | boolean | null> = {};
  Object.entries(value).forEach(([key, entryValue]) => {
    if (
      typeof entryValue === "string"
      || typeof entryValue === "number"
      || typeof entryValue === "boolean"
      || entryValue === null
    ) {
      next[key] = entryValue;
    }
  });
  return next;
};

const parseIncomingRequestAntiAbuseSummary = (value: unknown): IncomingRequestAntiAbuseSummary | null => {
  if (!isRecord(value)) {
    return null;
  }
  const riskLevel = value.riskLevel;
  if (riskLevel !== "none" && riskLevel !== "watch" && riskLevel !== "high") {
    return null;
  }
  return {
    riskLevel,
    quarantinedCount: toNumber(value.quarantinedCount),
    peerRateLimitedCount: toNumber(value.peerRateLimitedCount),
    peerCooldownActiveCount: toNumber(value.peerCooldownActiveCount),
    globalRateLimitedCount: toNumber(value.globalRateLimitedCount),
    uniquePeerPrefixCount: toNumber(value.uniquePeerPrefixCount),
    latestReasonCode: toStringOrNull(value.latestReasonCode),
    latestPeerPubkeyPrefix: toStringOrNull(value.latestPeerPubkeyPrefix),
    latestCooldownRemainingMs: typeof value.latestCooldownRemainingMs === "number"
      && Number.isFinite(value.latestCooldownRemainingMs)
      ? Math.max(0, Math.floor(value.latestCooldownRemainingMs))
      : null,
  };
};

const readCrossDeviceDigestSafe = (
  appEventsApi: MinimalAppEventsApi | undefined,
  eventWindowSize: number,
): Readonly<{
  summary: IncomingRequestAntiAbuseSummary | null;
  compactQuarantineEvents: ReadonlyArray<Readonly<{
    atUnixMs: number;
    level: string;
    context: Readonly<Record<string, string | number | boolean | null>>;
  }>>;
  recentWarnOrError: ReadonlyArray<Readonly<{
    name: string;
    level: string;
    atUnixMs: number;
    reasonCode: string | null;
  }>>;
}> => {
  try {
    if (typeof appEventsApi?.getCrossDeviceSyncDigest !== "function") {
      return { summary: null, compactQuarantineEvents: [], recentWarnOrError: [] };
    }
    const raw = appEventsApi.getCrossDeviceSyncDigest(eventWindowSize) as MinimalCrossDeviceDigest;
    const summary = parseIncomingRequestAntiAbuseSummary(raw?.summary?.incomingRequestAntiAbuse);
    const compactQuarantineEvents = Array.isArray(raw?.events?.[QUARANTINE_EVENT_NAME])
      ? raw.events[QUARANTINE_EVENT_NAME].slice(-12).map((event) => ({
        atUnixMs: toNumber(event.atUnixMs),
        level: toStringOrNull(event.level) ?? "unknown",
        context: toPrimitiveContext(event.context),
      }))
      : [];
    const recentWarnOrError = Array.isArray(raw?.recentWarnOrError)
      ? raw.recentWarnOrError
        .slice(-12)
        .map((entry) => ({
          name: toStringOrNull(entry.name) ?? "unknown",
          level: toStringOrNull(entry.level) ?? "unknown",
          atUnixMs: toNumber(entry.atUnixMs),
          reasonCode: toStringOrNull(entry.reasonCode),
        }))
      : [];
    return {
      summary,
      compactQuarantineEvents,
      recentWarnOrError,
    };
  } catch {
    return { summary: null, compactQuarantineEvents: [], recentWarnOrError: [] };
  }
};

const readRecentQuarantinedEvents = (
  appEventsApi: MinimalAppEventsApi | undefined,
): ReadonlyArray<MinimalAppEvent> => {
  try {
    if (typeof appEventsApi?.findByName !== "function") {
      return [];
    }
    return appEventsApi.findByName(QUARANTINE_EVENT_NAME, EVENT_CAPTURE_LIMIT) ?? [];
  } catch {
    return [];
  }
};

const readM0TriageSafe = (
  m0TriageApi: MinimalM0TriageApi | undefined,
  eventWindowSize: number,
): unknown | null => {
  try {
    if (typeof m0TriageApi?.capture !== "function") {
      return null;
    }
    return m0TriageApi.capture(eventWindowSize);
  } catch {
    return null;
  }
};

const buildReplayReadiness = (params: Readonly<{
  summary: IncomingRequestAntiAbuseSummary | null;
  compactQuarantineEvents: ReadonlyArray<Readonly<{
    atUnixMs: number;
    context: Readonly<Record<string, string | number | boolean | null>>;
  }>>;
  recentQuarantinedEvents: ReadonlyArray<MinimalAppEvent>;
}>): Readonly<{
  observedReasonCodes: ReadonlyArray<string>;
  hasPeerRateLimited: boolean;
  hasPeerCooldownActive: boolean;
  hasExpectedReasonTransition: boolean;
  digestHasPeerRateLimitedCount: boolean;
  digestHasPeerCooldownActiveCount: boolean;
  readyForCp3Evidence: boolean;
}> => {
  const timeline: Array<Readonly<{
    atUnixMs: number;
    sequence: number;
    reasonCode: string;
  }>> = [];
  let sequence = 0;
  params.compactQuarantineEvents.forEach((event) => {
    const reasonCode = toStringOrNull(event.context.reasonCode);
    if (!reasonCode) {
      return;
    }
    timeline.push({
      atUnixMs: toNumber(event.atUnixMs),
      sequence: sequence++,
      reasonCode,
    });
  });
  params.recentQuarantinedEvents.forEach((event, index) => {
    const context = toPrimitiveContext(event.context);
    const reasonCode = toStringOrNull(context.reasonCode);
    if (!reasonCode) {
      return;
    }
    const time = toNumber(event.atUnixMs);
    const fallbackTime = -(index + 1);
    timeline.push({
      atUnixMs: time > 0 ? time : fallbackTime,
      sequence: sequence++,
      reasonCode,
    });
  });
  const observedReasonCodes = timeline
    .slice()
    .sort((left, right) => (
      left.atUnixMs === right.atUnixMs
        ? left.sequence - right.sequence
        : left.atUnixMs - right.atUnixMs
    ))
    .map((entry) => entry.reasonCode);
  const hasPeerRateLimited = observedReasonCodes.includes(PEER_RATE_LIMITED_REASON_CODE);
  const hasPeerCooldownActive = observedReasonCodes.includes(PEER_COOLDOWN_ACTIVE_REASON_CODE);
  const firstPeerRateLimited = observedReasonCodes.indexOf(PEER_RATE_LIMITED_REASON_CODE);
  const firstPeerCooldownActive = observedReasonCodes.indexOf(PEER_COOLDOWN_ACTIVE_REASON_CODE);
  const hasExpectedReasonTransition = (
    firstPeerRateLimited >= 0
    && firstPeerCooldownActive >= 0
    && firstPeerRateLimited < firstPeerCooldownActive
  );
  const digestHasPeerRateLimitedCount = (params.summary?.peerRateLimitedCount ?? 0) > 0;
  const digestHasPeerCooldownActiveCount = (params.summary?.peerCooldownActiveCount ?? 0) > 0;
  return {
    observedReasonCodes,
    hasPeerRateLimited,
    hasPeerCooldownActive,
    hasExpectedReasonTransition,
    digestHasPeerRateLimitedCount,
    digestHasPeerCooldownActiveCount,
    readyForCp3Evidence: (
      hasExpectedReasonTransition
      && digestHasPeerRateLimitedCount
      && digestHasPeerCooldownActiveCount
    ),
  };
};

const createBundle = (
  root: M7AntiAbuseCaptureWindow,
  eventWindowSizeInput?: number,
): M7AntiAbuseCaptureBundle => {
  const eventWindowSize = toNumericWindowSize(eventWindowSizeInput);
  const appEventsApi = root.obscurAppEvents;
  const digest = readCrossDeviceDigestSafe(appEventsApi, eventWindowSize);
  const recentQuarantinedEvents = readRecentQuarantinedEvents(appEventsApi);
  const replayReadiness = buildReplayReadiness({
    summary: digest.summary,
    compactQuarantineEvents: digest.compactQuarantineEvents,
    recentQuarantinedEvents,
  });
  return {
    generatedAtUnixMs: Date.now(),
    version: "obscur.m7.anti_abuse.v1",
    source: {
      userAgent: root.navigator?.userAgent ?? "unknown",
      locationHref: root.location?.href ?? "unknown",
    },
    checks: {
      requiredApis: {
        appEvents: typeof appEventsApi?.getCrossDeviceSyncDigest === "function",
        m0Triage: typeof root.obscurM0Triage?.capture === "function",
      },
    },
    antiAbuse: {
      summary: digest.summary,
      compactQuarantineEvents: digest.compactQuarantineEvents,
      recentQuarantinedEvents,
      recentWarnOrError: digest.recentWarnOrError,
      replayReadiness,
    },
    m0Triage: readM0TriageSafe(root.obscurM0Triage, eventWindowSize),
  };
};

export const installM7AntiAbuseCapture = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  const root = window as M7AntiAbuseCaptureWindow;
  if (root.obscurM7AntiAbuseCapture) {
    return;
  }
  root.obscurM7AntiAbuseCapture = {
    capture: (eventWindowSize = DEFAULT_EVENT_WINDOW_SIZE): M7AntiAbuseCaptureBundle => (
      createBundle(root, eventWindowSize)
    ),
    captureJson: (eventWindowSize = DEFAULT_EVENT_WINDOW_SIZE): string => (
      JSON.stringify(createBundle(root, eventWindowSize), null, 2)
    ),
  };
};

export const m7AntiAbuseCaptureInternals = {
  buildReplayReadiness,
  createBundle,
  parseIncomingRequestAntiAbuseSummary,
  toNumericWindowSize,
};
