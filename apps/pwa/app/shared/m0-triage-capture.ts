type MinimalWindowSnapshotApi = Readonly<{
  getSnapshot?: () => unknown;
}>;

type MinimalRouteMountDiagnosticsApi = Readonly<{
  getSnapshot?: () => unknown;
}>;

type MinimalAppEvent = Readonly<{
  name: string;
  level?: string;
  atUnixMs?: number;
  context?: Readonly<Record<string, string | number | boolean | null>>;
}>;

type MinimalAppEventsApi = Readonly<{
  getDigest?: (count?: number) => unknown;
  getCrossDeviceSyncDigest?: (count?: number) => unknown;
  getRecent?: (count?: number) => ReadonlyArray<MinimalAppEvent>;
  findByName?: (name: string, count?: number) => ReadonlyArray<MinimalAppEvent>;
}>;

type M0FocusCategory =
  | "startup"
  | "navigation"
  | "sync_restore"
  | "media_hydration";

export type M0TriageBundle = Readonly<{
  generatedAtUnixMs: number;
  version: "obscur.m0.capture.v1";
  source: Readonly<{
    userAgent: string;
    locationHref: string;
  }>;
  checks: Readonly<{
    requiredApis: Readonly<{
      windowRuntime: boolean;
      relayRuntime: boolean;
      relayTransportJournal: boolean;
      appEvents: boolean;
    }>;
  }>;
  snapshots: Readonly<{
    windowRuntime: unknown | null;
    relayRuntime: unknown | null;
    relayTransportJournal: unknown | null;
    uiResponsiveness: unknown | null;
    routeMountDiagnostics: unknown | null;
  }>;
  events: Readonly<{
    digest: unknown | null;
    crossDeviceDigest: unknown | null;
    focusedByCategory: Readonly<Record<M0FocusCategory, ReadonlyArray<MinimalAppEvent>>>;
  }>;
}>;

type M0TriageApi = Readonly<{
  capture: (eventWindowSize?: number) => M0TriageBundle;
  captureJson: (eventWindowSize?: number) => string;
}>;

const DEFAULT_EVENT_WINDOW_SIZE = 300;
const FOCUS_EVENT_LIMIT_PER_NAME = 6;

const M0_FOCUS_EVENT_NAMES: Readonly<Record<M0FocusCategory, ReadonlyArray<string>>> = {
  startup: [
    "runtime.profile_boot_stall_timeout",
    "runtime.activation.start",
    "runtime.activation.timeout",
    "runtime.activation.relay_runtime_gate",
    "runtime.boot_watchdog_auto_recovery",
  ],
  navigation: [
    "navigation.route_request",
    "navigation.route_stall_hard_fallback",
    "navigation.route_mount_probe_slow",
    "navigation.route_mount_probe_settled",
    "navigation.page_transition_watchdog_timeout",
    "navigation.page_transition_effects_disabled",
  ],
  sync_restore: [
    "account_sync.backup_restore_merge_diagnostics",
    "account_sync.backup_restore_apply_diagnostics",
    "account_sync.backup_restore_result",
    "messaging.legacy_migration_diagnostics",
  ],
  media_hydration: [
    "messaging.conversation_hydration_diagnostics",
    "messaging.conversation_projection_merge_window_cap_applied",
  ],
};

type M0TriageWindow = Window & {
  obscurWindowRuntime?: MinimalWindowSnapshotApi;
  obscurRelayRuntime?: MinimalWindowSnapshotApi;
  obscurRelayTransportJournal?: MinimalWindowSnapshotApi;
  obscurUiResponsiveness?: MinimalWindowSnapshotApi;
  obscurRouteMountDiagnostics?: MinimalRouteMountDiagnosticsApi;
  obscurAppEvents?: MinimalAppEventsApi;
  obscurM0Triage?: M0TriageApi;
};

declare global {
  interface Window {
    obscurM0Triage?: M0TriageApi;
  }
}

const getNumericWindowSize = (value: unknown): number => {
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

const readDigestSafe = (
  appEventsApi: MinimalAppEventsApi | undefined,
  method: "getDigest" | "getCrossDeviceSyncDigest",
  eventWindowSize: number,
): unknown | null => {
  try {
    const fn = appEventsApi?.[method];
    return typeof fn === "function" ? fn(eventWindowSize) : null;
  } catch {
    return null;
  }
};

const readFocusedEvents = (
  appEventsApi: MinimalAppEventsApi | undefined,
  category: M0FocusCategory,
): ReadonlyArray<MinimalAppEvent> => {
  if (typeof appEventsApi?.findByName !== "function") {
    return [];
  }
  const names = M0_FOCUS_EVENT_NAMES[category];
  const focused: MinimalAppEvent[] = [];
  names.forEach((eventName) => {
    try {
      const matches = appEventsApi.findByName?.(eventName, FOCUS_EVENT_LIMIT_PER_NAME) ?? [];
      matches.forEach((event) => {
        focused.push(event);
      });
    } catch {
      // Best-effort diagnostics only.
    }
  });
  return focused.slice(-24);
};

const createBundle = (
  root: M0TriageWindow,
  eventWindowSizeInput?: number,
): M0TriageBundle => {
  const eventWindowSize = getNumericWindowSize(eventWindowSizeInput);
  const appEventsApi = root.obscurAppEvents;
  const requiredApis = {
    windowRuntime: typeof root.obscurWindowRuntime?.getSnapshot === "function",
    relayRuntime: typeof root.obscurRelayRuntime?.getSnapshot === "function",
    relayTransportJournal: typeof root.obscurRelayTransportJournal?.getSnapshot === "function",
    appEvents: typeof appEventsApi?.getDigest === "function",
  };
  return {
    generatedAtUnixMs: Date.now(),
    version: "obscur.m0.capture.v1",
    source: {
      userAgent: root.navigator?.userAgent ?? "unknown",
      locationHref: root.location?.href ?? "unknown",
    },
    checks: {
      requiredApis,
    },
    snapshots: {
      windowRuntime: readSnapshotSafe(root.obscurWindowRuntime),
      relayRuntime: readSnapshotSafe(root.obscurRelayRuntime),
      relayTransportJournal: readSnapshotSafe(root.obscurRelayTransportJournal),
      uiResponsiveness: readSnapshotSafe(root.obscurUiResponsiveness),
      routeMountDiagnostics: readSnapshotSafe(root.obscurRouteMountDiagnostics),
    },
    events: {
      digest: readDigestSafe(appEventsApi, "getDigest", eventWindowSize),
      crossDeviceDigest: readDigestSafe(appEventsApi, "getCrossDeviceSyncDigest", eventWindowSize),
      focusedByCategory: {
        startup: readFocusedEvents(appEventsApi, "startup"),
        navigation: readFocusedEvents(appEventsApi, "navigation"),
        sync_restore: readFocusedEvents(appEventsApi, "sync_restore"),
        media_hydration: readFocusedEvents(appEventsApi, "media_hydration"),
      },
    },
  };
};

export const installM0TriageCapture = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  const root = window as M0TriageWindow;
  if (root.obscurM0Triage) {
    return;
  }
  root.obscurM0Triage = {
    capture: (eventWindowSize = DEFAULT_EVENT_WINDOW_SIZE): M0TriageBundle => (
      createBundle(root, eventWindowSize)
    ),
    captureJson: (eventWindowSize = DEFAULT_EVENT_WINDOW_SIZE): string => (
      JSON.stringify(createBundle(root, eventWindowSize), null, 2)
    ),
  };
};

export const m0TriageCaptureInternals = {
  createBundle,
  getNumericWindowSize,
};
