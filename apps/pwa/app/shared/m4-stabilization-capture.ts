type MinimalWindowSnapshotApi = Readonly<{
  getSnapshot?: () => unknown;
}>;

type MinimalAppEvent = Readonly<{
  name: string;
  level?: string;
  atUnixMs?: number;
  context?: Readonly<Record<string, string | number | boolean | null>>;
}>;

type SearchJumpNavigationSummary = Readonly<{
  riskLevel: "none" | "watch" | "high";
  requestedCount: number;
  resolvedCount: number;
  unresolvedCount: number;
  timestampFallbackResolvedCount: number;
  domUnresolvedCount: number;
  loadExhaustedUnresolvedCount: number;
  latestResolutionMode: string | null;
  latestUnresolvedReasonCode: string | null;
}>;

type MinimalCrossDeviceDigest = Readonly<{
  summary?: Readonly<{
    searchJumpNavigation?: SearchJumpNavigationSummary;
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

export type M4StabilizationBundle = Readonly<{
  generatedAtUnixMs: number;
  version: "obscur.m4.stabilization.v1";
  source: Readonly<{
    userAgent: string;
    locationHref: string;
  }>;
  checks: Readonly<{
    requiredApis: Readonly<{
      appEvents: boolean;
      uiResponsiveness: boolean;
      routeMountDiagnostics: boolean;
    }>;
  }>;
  snapshots: Readonly<{
    uiResponsiveness: unknown | null;
    routeMountDiagnostics: unknown | null;
  }>;
  searchJump: Readonly<{
    summary: SearchJumpNavigationSummary | null;
    recentRequested: ReadonlyArray<MinimalAppEvent>;
    recentResolved: ReadonlyArray<MinimalAppEvent>;
    recentUnresolved: ReadonlyArray<MinimalAppEvent>;
    recentWarnOrError: ReadonlyArray<Readonly<{
      name: string;
      level: string;
      atUnixMs: number;
      reasonCode: string | null;
    }>>;
  }>;
}>;

type M4StabilizationApi = Readonly<{
  capture: (eventWindowSize?: number) => M4StabilizationBundle;
  captureJson: (eventWindowSize?: number) => string;
}>;

const DEFAULT_EVENT_WINDOW_SIZE = 400;
const EVENT_CAPTURE_LIMIT = 24;

type M4StabilizationWindow = Window & {
  obscurAppEvents?: MinimalAppEventsApi;
  obscurUiResponsiveness?: MinimalWindowSnapshotApi;
  obscurRouteMountDiagnostics?: MinimalWindowSnapshotApi;
  obscurM4Stabilization?: M4StabilizationApi;
};

declare global {
  interface Window {
    obscurM4Stabilization?: M4StabilizationApi;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null
);

const toStringOrNull = (value: unknown): string | null => (
  typeof value === "string" && value.trim().length > 0 ? value : null
);

const toNumericWindowSize = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.floor(value));
  }
  return DEFAULT_EVENT_WINDOW_SIZE;
};

const readSnapshotSafe = (api: MinimalWindowSnapshotApi | undefined): unknown | null => {
  try {
    return typeof api?.getSnapshot === "function" ? api.getSnapshot() : null;
  } catch {
    return null;
  }
};

const readRecentEvents = (
  appEventsApi: MinimalAppEventsApi | undefined,
  eventName: string,
): ReadonlyArray<MinimalAppEvent> => {
  try {
    if (typeof appEventsApi?.findByName !== "function") {
      return [];
    }
    return appEventsApi.findByName(eventName, EVENT_CAPTURE_LIMIT) ?? [];
  } catch {
    return [];
  }
};

const parseSearchJumpSummary = (value: unknown): SearchJumpNavigationSummary | null => {
  if (!isRecord(value)) {
    return null;
  }
  const riskLevel = value.riskLevel;
  if (riskLevel !== "none" && riskLevel !== "watch" && riskLevel !== "high") {
    return null;
  }
  const getNumber = (field: string): number => (
    typeof value[field] === "number" && Number.isFinite(value[field] as number)
      ? Math.floor(value[field] as number)
      : 0
  );
  return {
    riskLevel,
    requestedCount: getNumber("requestedCount"),
    resolvedCount: getNumber("resolvedCount"),
    unresolvedCount: getNumber("unresolvedCount"),
    timestampFallbackResolvedCount: getNumber("timestampFallbackResolvedCount"),
    domUnresolvedCount: getNumber("domUnresolvedCount"),
    loadExhaustedUnresolvedCount: getNumber("loadExhaustedUnresolvedCount"),
    latestResolutionMode: toStringOrNull(value.latestResolutionMode),
    latestUnresolvedReasonCode: toStringOrNull(value.latestUnresolvedReasonCode),
  };
};

const readCrossDeviceDigestSafe = (
  appEventsApi: MinimalAppEventsApi | undefined,
  eventWindowSize: number,
): Readonly<{
  summary: SearchJumpNavigationSummary | null;
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
    const summary = parseSearchJumpSummary(raw?.summary?.searchJumpNavigation);
    const recentWarnOrError = Array.isArray(raw?.recentWarnOrError)
      ? raw.recentWarnOrError
        .slice(-12)
        .map((entry) => ({
          name: toStringOrNull(entry.name) ?? "unknown",
          level: toStringOrNull(entry.level) ?? "unknown",
          atUnixMs: typeof entry.atUnixMs === "number" && Number.isFinite(entry.atUnixMs)
            ? Math.floor(entry.atUnixMs)
            : 0,
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

const createBundle = (
  root: M4StabilizationWindow,
  eventWindowSizeInput?: number,
): M4StabilizationBundle => {
  const eventWindowSize = toNumericWindowSize(eventWindowSizeInput);
  const appEventsApi = root.obscurAppEvents;
  const crossDeviceDigest = readCrossDeviceDigestSafe(appEventsApi, eventWindowSize);
  return {
    generatedAtUnixMs: Date.now(),
    version: "obscur.m4.stabilization.v1",
    source: {
      userAgent: root.navigator?.userAgent ?? "unknown",
      locationHref: root.location?.href ?? "unknown",
    },
    checks: {
      requiredApis: {
        appEvents: typeof appEventsApi?.getCrossDeviceSyncDigest === "function",
        uiResponsiveness: typeof root.obscurUiResponsiveness?.getSnapshot === "function",
        routeMountDiagnostics: typeof root.obscurRouteMountDiagnostics?.getSnapshot === "function",
      },
    },
    snapshots: {
      uiResponsiveness: readSnapshotSafe(root.obscurUiResponsiveness),
      routeMountDiagnostics: readSnapshotSafe(root.obscurRouteMountDiagnostics),
    },
    searchJump: {
      summary: crossDeviceDigest.summary,
      recentRequested: readRecentEvents(appEventsApi, "messaging.search_jump_requested"),
      recentResolved: readRecentEvents(appEventsApi, "messaging.search_jump_resolved"),
      recentUnresolved: readRecentEvents(appEventsApi, "messaging.search_jump_unresolved"),
      recentWarnOrError: crossDeviceDigest.recentWarnOrError,
    },
  };
};

export const installM4StabilizationCapture = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  const root = window as M4StabilizationWindow;
  if (root.obscurM4Stabilization) {
    return;
  }
  root.obscurM4Stabilization = {
    capture: (eventWindowSize = DEFAULT_EVENT_WINDOW_SIZE): M4StabilizationBundle => (
      createBundle(root, eventWindowSize)
    ),
    captureJson: (eventWindowSize = DEFAULT_EVENT_WINDOW_SIZE): string => (
      JSON.stringify(createBundle(root, eventWindowSize), null, 2)
    ),
  };
};

export const m4StabilizationCaptureInternals = {
  createBundle,
  toNumericWindowSize,
  parseSearchJumpSummary,
};
