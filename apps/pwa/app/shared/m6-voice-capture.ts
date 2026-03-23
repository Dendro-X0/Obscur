type MinimalAppEvent = Readonly<{
  name: string;
  level?: string;
  atUnixMs?: number;
  context?: Readonly<Record<string, string | number | boolean | null>>;
}>;

type RealtimeVoiceSessionSummary = Readonly<{
  riskLevel: "none" | "watch" | "high";
  transitionCount: number;
  degradedCount: number;
  unsupportedCount: number;
  recoveryExhaustedCount: number;
  latestToPhase: string | null;
  latestReasonCode: string | null;
}>;

type MinimalCrossDeviceDigest = Readonly<{
  summary?: Readonly<{
    realtimeVoiceSession?: RealtimeVoiceSessionSummary;
  }>;
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

export type M6VoiceCaptureBundle = Readonly<{
  generatedAtUnixMs: number;
  version: "obscur.m6.voice.v1";
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
  voice: Readonly<{
    summary: RealtimeVoiceSessionSummary | null;
    transitions: ReadonlyArray<MinimalAppEvent>;
    recentWarnOrError: ReadonlyArray<Readonly<{
      name: string;
      level: string;
      atUnixMs: number;
      reasonCode: string | null;
    }>>;
  }>;
  m0Triage: unknown | null;
}>;

type M6VoiceCaptureApi = Readonly<{
  capture: (eventWindowSize?: number) => M6VoiceCaptureBundle;
  captureJson: (eventWindowSize?: number) => string;
}>;

const DEFAULT_EVENT_WINDOW_SIZE = 400;
const EVENT_CAPTURE_LIMIT = 24;

type M6VoiceCaptureWindow = Window & {
  obscurAppEvents?: MinimalAppEventsApi;
  obscurM0Triage?: MinimalM0TriageApi;
  obscurM6VoiceCapture?: M6VoiceCaptureApi;
};

declare global {
  interface Window {
    obscurM6VoiceCapture?: M6VoiceCaptureApi;
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

const parseRealtimeVoiceSummary = (value: unknown): RealtimeVoiceSessionSummary | null => {
  if (!isRecord(value)) {
    return null;
  }
  const riskLevel = value.riskLevel;
  if (riskLevel !== "none" && riskLevel !== "watch" && riskLevel !== "high") {
    return null;
  }
  return {
    riskLevel,
    transitionCount: toNumber(value.transitionCount),
    degradedCount: toNumber(value.degradedCount),
    unsupportedCount: toNumber(value.unsupportedCount),
    recoveryExhaustedCount: toNumber(value.recoveryExhaustedCount),
    latestToPhase: toStringOrNull(value.latestToPhase),
    latestReasonCode: toStringOrNull(value.latestReasonCode),
  };
};

const readCrossDeviceDigestSafe = (
  appEventsApi: MinimalAppEventsApi | undefined,
  eventWindowSize: number,
): Readonly<{
  summary: RealtimeVoiceSessionSummary | null;
  recentWarnOrError: ReadonlyArray<Readonly<{
    name: string;
    level: string;
    atUnixMs: number;
    reasonCode: string | null;
  }>>;
}> => {
  try {
    if (typeof appEventsApi?.getCrossDeviceSyncDigest !== "function") {
      return { summary: null, recentWarnOrError: [] };
    }
    const raw = appEventsApi.getCrossDeviceSyncDigest(eventWindowSize) as MinimalCrossDeviceDigest;
    const summary = parseRealtimeVoiceSummary(raw?.summary?.realtimeVoiceSession);
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
      recentWarnOrError,
    };
  } catch {
    return { summary: null, recentWarnOrError: [] };
  }
};

const readRecentTransitions = (
  appEventsApi: MinimalAppEventsApi | undefined,
): ReadonlyArray<MinimalAppEvent> => {
  try {
    if (typeof appEventsApi?.findByName !== "function") {
      return [];
    }
    return appEventsApi.findByName("messaging.realtime_voice.session_transition", EVENT_CAPTURE_LIMIT) ?? [];
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

const createBundle = (
  root: M6VoiceCaptureWindow,
  eventWindowSizeInput?: number,
): M6VoiceCaptureBundle => {
  const eventWindowSize = toNumericWindowSize(eventWindowSizeInput);
  const appEventsApi = root.obscurAppEvents;
  const digest = readCrossDeviceDigestSafe(appEventsApi, eventWindowSize);
  return {
    generatedAtUnixMs: Date.now(),
    version: "obscur.m6.voice.v1",
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
    voice: {
      summary: digest.summary,
      transitions: readRecentTransitions(appEventsApi),
      recentWarnOrError: digest.recentWarnOrError,
    },
    m0Triage: readM0TriageSafe(root.obscurM0Triage, eventWindowSize),
  };
};

export const installM6VoiceCapture = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  const root = window as M6VoiceCaptureWindow;
  if (root.obscurM6VoiceCapture) {
    return;
  }
  root.obscurM6VoiceCapture = {
    capture: (eventWindowSize = DEFAULT_EVENT_WINDOW_SIZE): M6VoiceCaptureBundle => (
      createBundle(root, eventWindowSize)
    ),
    captureJson: (eventWindowSize = DEFAULT_EVENT_WINDOW_SIZE): string => (
      JSON.stringify(createBundle(root, eventWindowSize), null, 2)
    ),
  };
};

export const m6VoiceCaptureInternals = {
  createBundle,
  parseRealtimeVoiceSummary,
  toNumericWindowSize,
};
