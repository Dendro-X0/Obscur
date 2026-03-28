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
  staleEventIgnoredCount: number;
  connectTimeoutDiagnosticsCount: number;
  connectTimeoutNoOpenRelayCount: number;
  connectingWatchdogGateCount: number;
  connectingWatchdogGatePassCount: number;
  connectingWatchdogGateFailCount: number;
  unexpectedConnectingWatchdogGateFailCount: number;
  longSessionGateCount: number;
  longSessionGatePassCount: number;
  longSessionGateFailCount: number;
  unexpectedLongSessionGateFailCount: number;
  checkpointGateCount: number;
  checkpointGatePassCount: number;
  checkpointGateFailCount: number;
  unexpectedCheckpointGateFailCount: number;
  releaseReadinessGateCount: number;
  releaseReadinessGatePassCount: number;
  releaseReadinessGateFailCount: number;
  unexpectedReleaseReadinessGateFailCount: number;
  releaseEvidenceGateCount: number;
  releaseEvidenceGatePassCount: number;
  releaseEvidenceGateFailCount: number;
  unexpectedReleaseEvidenceGateFailCount: number;
  closeoutGateCount: number;
  closeoutGatePassCount: number;
  closeoutGateFailCount: number;
  unexpectedCloseoutGateFailCount: number;
  latestToPhase: string | null;
  latestReasonCode: string | null;
  latestIgnoredReasonCode: string | null;
  latestConnectTimeoutRtcConnectionState: string | null;
  latestConnectTimeoutOpenRelayCount: number | null;
  latestConnectingWatchdogGatePass: boolean | null;
  latestConnectingWatchdogGateFailedCheckSample: string | null;
  latestLongSessionGatePass: boolean | null;
  latestLongSessionGateFailedCheckSample: string | null;
  latestCheckpointGatePass: boolean | null;
  latestCheckpointGateFailedCheckSample: string | null;
  latestReleaseReadinessGatePass: boolean | null;
  latestReleaseReadinessGateFailedCheckSample: string | null;
  latestReleaseEvidenceGatePass: boolean | null;
  latestReleaseEvidenceGateFailedCheckSample: string | null;
  latestCloseoutGatePass: boolean | null;
  latestCloseoutGateFailedCheckSample: string | null;
}>;

type AsyncVoiceNoteSummary = Readonly<{
  riskLevel: "none" | "watch" | "high";
  recordingCompleteCount: number;
  recordingUnsupportedCount: number;
  recordingStartFailedCount: number;
  recordingEmptyCount: number;
  latestReasonCode: string | null;
}>;

type DeleteConvergenceSummary = Readonly<{
  riskLevel: "none" | "watch" | "high";
  requestedCount: number;
  localAppliedCount: number;
  remoteConfirmedCount: number;
  remoteQueuedCount: number;
  remoteFailedCount: number;
  rejectedCount: number;
  latestChannel: string | null;
  latestResultCode: string | null;
  latestReasonCode: string | null;
}>;

type MinimalCrossDeviceDigest = Readonly<{
  summary?: Readonly<{
    realtimeVoiceSession?: RealtimeVoiceSessionSummary;
    asyncVoiceNote?: AsyncVoiceNoteSummary;
    deleteConvergence?: DeleteConvergenceSummary;
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
    asyncVoiceNoteSummary: AsyncVoiceNoteSummary | null;
    deleteConvergenceSummary: DeleteConvergenceSummary | null;
    transitions: ReadonlyArray<MinimalAppEvent>;
    ignoredEvents: ReadonlyArray<MinimalAppEvent>;
    connectTimeoutEvents: ReadonlyArray<MinimalAppEvent>;
    connectingWatchdogGateEvents: ReadonlyArray<MinimalAppEvent>;
    longSessionGateEvents: ReadonlyArray<MinimalAppEvent>;
    checkpointGateEvents: ReadonlyArray<MinimalAppEvent>;
    releaseReadinessGateEvents: ReadonlyArray<MinimalAppEvent>;
    releaseEvidenceGateEvents: ReadonlyArray<MinimalAppEvent>;
    closeoutGateEvents: ReadonlyArray<MinimalAppEvent>;
    voiceNoteEvents: ReadonlyArray<MinimalAppEvent>;
    deleteConvergenceEvents: ReadonlyArray<MinimalAppEvent>;
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

const toBooleanOrNull = (value: unknown): boolean | null => (
  typeof value === "boolean" ? value : null
);

const toNumber = (value: unknown): number => (
  typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 0
);

const toNumberOrNull = (value: unknown): number | null => (
  typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : null
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
    staleEventIgnoredCount: toNumber(value.staleEventIgnoredCount),
    connectTimeoutDiagnosticsCount: toNumber(value.connectTimeoutDiagnosticsCount),
    connectTimeoutNoOpenRelayCount: toNumber(value.connectTimeoutNoOpenRelayCount),
    connectingWatchdogGateCount: toNumber(value.connectingWatchdogGateCount),
    connectingWatchdogGatePassCount: toNumber(value.connectingWatchdogGatePassCount),
    connectingWatchdogGateFailCount: toNumber(value.connectingWatchdogGateFailCount),
    unexpectedConnectingWatchdogGateFailCount: toNumber(value.unexpectedConnectingWatchdogGateFailCount),
    longSessionGateCount: toNumber(value.longSessionGateCount),
    longSessionGatePassCount: toNumber(value.longSessionGatePassCount),
    longSessionGateFailCount: toNumber(value.longSessionGateFailCount),
    unexpectedLongSessionGateFailCount: toNumber(value.unexpectedLongSessionGateFailCount),
    checkpointGateCount: toNumber(value.checkpointGateCount),
    checkpointGatePassCount: toNumber(value.checkpointGatePassCount),
    checkpointGateFailCount: toNumber(value.checkpointGateFailCount),
    unexpectedCheckpointGateFailCount: toNumber(value.unexpectedCheckpointGateFailCount),
    releaseReadinessGateCount: toNumber(value.releaseReadinessGateCount),
    releaseReadinessGatePassCount: toNumber(value.releaseReadinessGatePassCount),
    releaseReadinessGateFailCount: toNumber(value.releaseReadinessGateFailCount),
    unexpectedReleaseReadinessGateFailCount: toNumber(value.unexpectedReleaseReadinessGateFailCount),
    releaseEvidenceGateCount: toNumber(value.releaseEvidenceGateCount),
    releaseEvidenceGatePassCount: toNumber(value.releaseEvidenceGatePassCount),
    releaseEvidenceGateFailCount: toNumber(value.releaseEvidenceGateFailCount),
    unexpectedReleaseEvidenceGateFailCount: toNumber(value.unexpectedReleaseEvidenceGateFailCount),
    closeoutGateCount: toNumber(value.closeoutGateCount),
    closeoutGatePassCount: toNumber(value.closeoutGatePassCount),
    closeoutGateFailCount: toNumber(value.closeoutGateFailCount),
    unexpectedCloseoutGateFailCount: toNumber(value.unexpectedCloseoutGateFailCount),
    latestToPhase: toStringOrNull(value.latestToPhase),
    latestReasonCode: toStringOrNull(value.latestReasonCode),
    latestIgnoredReasonCode: toStringOrNull(value.latestIgnoredReasonCode),
    latestConnectTimeoutRtcConnectionState: toStringOrNull(value.latestConnectTimeoutRtcConnectionState),
    latestConnectTimeoutOpenRelayCount: toNumberOrNull(value.latestConnectTimeoutOpenRelayCount),
    latestConnectingWatchdogGatePass: toBooleanOrNull(value.latestConnectingWatchdogGatePass),
    latestConnectingWatchdogGateFailedCheckSample: toStringOrNull(value.latestConnectingWatchdogGateFailedCheckSample),
    latestLongSessionGatePass: toBooleanOrNull(value.latestLongSessionGatePass),
    latestLongSessionGateFailedCheckSample: toStringOrNull(value.latestLongSessionGateFailedCheckSample),
    latestCheckpointGatePass: toBooleanOrNull(value.latestCheckpointGatePass),
    latestCheckpointGateFailedCheckSample: toStringOrNull(value.latestCheckpointGateFailedCheckSample),
    latestReleaseReadinessGatePass: toBooleanOrNull(value.latestReleaseReadinessGatePass),
    latestReleaseReadinessGateFailedCheckSample: toStringOrNull(value.latestReleaseReadinessGateFailedCheckSample),
    latestReleaseEvidenceGatePass: toBooleanOrNull(value.latestReleaseEvidenceGatePass),
    latestReleaseEvidenceGateFailedCheckSample: toStringOrNull(value.latestReleaseEvidenceGateFailedCheckSample),
    latestCloseoutGatePass: toBooleanOrNull(value.latestCloseoutGatePass),
    latestCloseoutGateFailedCheckSample: toStringOrNull(value.latestCloseoutGateFailedCheckSample),
  };
};

const parseAsyncVoiceNoteSummary = (value: unknown): AsyncVoiceNoteSummary | null => {
  if (!isRecord(value)) {
    return null;
  }
  const riskLevel = value.riskLevel;
  if (riskLevel !== "none" && riskLevel !== "watch" && riskLevel !== "high") {
    return null;
  }
  return {
    riskLevel,
    recordingCompleteCount: toNumber(value.recordingCompleteCount),
    recordingUnsupportedCount: toNumber(value.recordingUnsupportedCount),
    recordingStartFailedCount: toNumber(value.recordingStartFailedCount),
    recordingEmptyCount: toNumber(value.recordingEmptyCount),
    latestReasonCode: toStringOrNull(value.latestReasonCode),
  };
};

const parseDeleteConvergenceSummary = (value: unknown): DeleteConvergenceSummary | null => {
  if (!isRecord(value)) {
    return null;
  }
  const riskLevel = value.riskLevel;
  if (riskLevel !== "none" && riskLevel !== "watch" && riskLevel !== "high") {
    return null;
  }
  return {
    riskLevel,
    requestedCount: toNumber(value.requestedCount),
    localAppliedCount: toNumber(value.localAppliedCount),
    remoteConfirmedCount: toNumber(value.remoteConfirmedCount),
    remoteQueuedCount: toNumber(value.remoteQueuedCount),
    remoteFailedCount: toNumber(value.remoteFailedCount),
    rejectedCount: toNumber(value.rejectedCount),
    latestChannel: toStringOrNull(value.latestChannel),
    latestResultCode: toStringOrNull(value.latestResultCode),
    latestReasonCode: toStringOrNull(value.latestReasonCode),
  };
};

const readCrossDeviceDigestSafe = (
  appEventsApi: MinimalAppEventsApi | undefined,
  eventWindowSize: number,
): Readonly<{
  summary: RealtimeVoiceSessionSummary | null;
  asyncVoiceNoteSummary: AsyncVoiceNoteSummary | null;
  deleteConvergenceSummary: DeleteConvergenceSummary | null;
  recentWarnOrError: ReadonlyArray<Readonly<{
    name: string;
    level: string;
    atUnixMs: number;
    reasonCode: string | null;
  }>>;
}> => {
  try {
    if (typeof appEventsApi?.getCrossDeviceSyncDigest !== "function") {
      return {
        summary: null,
        asyncVoiceNoteSummary: null,
        deleteConvergenceSummary: null,
        recentWarnOrError: [],
      };
    }
    const raw = appEventsApi.getCrossDeviceSyncDigest(eventWindowSize) as MinimalCrossDeviceDigest;
    const summary = parseRealtimeVoiceSummary(raw?.summary?.realtimeVoiceSession);
    const asyncVoiceNoteSummary = parseAsyncVoiceNoteSummary(raw?.summary?.asyncVoiceNote);
    const deleteConvergenceSummary = parseDeleteConvergenceSummary(raw?.summary?.deleteConvergence);
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
      asyncVoiceNoteSummary,
      deleteConvergenceSummary,
      recentWarnOrError,
    };
  } catch {
    return {
      summary: null,
      asyncVoiceNoteSummary: null,
      deleteConvergenceSummary: null,
      recentWarnOrError: [],
    };
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

const readRecentIgnoredEvents = (
  appEventsApi: MinimalAppEventsApi | undefined,
): ReadonlyArray<MinimalAppEvent> => {
  try {
    if (typeof appEventsApi?.findByName !== "function") {
      return [];
    }
    return appEventsApi.findByName("messaging.realtime_voice.session_event_ignored", EVENT_CAPTURE_LIMIT) ?? [];
  } catch {
    return [];
  }
};

const readRecentConnectTimeoutEvents = (
  appEventsApi: MinimalAppEventsApi | undefined,
): ReadonlyArray<MinimalAppEvent> => {
  try {
    if (typeof appEventsApi?.findByName !== "function") {
      return [];
    }
    return appEventsApi.findByName("messaging.realtime_voice.connect_timeout_diagnostics", EVENT_CAPTURE_LIMIT) ?? [];
  } catch {
    return [];
  }
};

const readRecentConnectingWatchdogGateEvents = (
  appEventsApi: MinimalAppEventsApi | undefined,
): ReadonlyArray<MinimalAppEvent> => {
  try {
    if (typeof appEventsApi?.findByName !== "function") {
      return [];
    }
    return appEventsApi.findByName("messaging.realtime_voice.connecting_watchdog_gate", EVENT_CAPTURE_LIMIT) ?? [];
  } catch {
    return [];
  }
};

const readRecentCp4GateEvents = (
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

const readRecentVoiceNoteEvents = (
  appEventsApi: MinimalAppEventsApi | undefined,
): ReadonlyArray<MinimalAppEvent> => {
  try {
    if (typeof appEventsApi?.findByName !== "function") {
      return [];
    }
    return [
      ...(appEventsApi.findByName("messaging.voice_note.recording_complete", 8) ?? []),
      ...(appEventsApi.findByName("messaging.voice_note.recording_unsupported", 8) ?? []),
      ...(appEventsApi.findByName("messaging.voice_note.recording_start_failed", 8) ?? []),
      ...(appEventsApi.findByName("messaging.voice_note.recording_empty", 8) ?? []),
    ]
      .sort((left, right) => toNumber(left.atUnixMs) - toNumber(right.atUnixMs))
      .slice(-EVENT_CAPTURE_LIMIT);
  } catch {
    return [];
  }
};

const readRecentDeleteConvergenceEvents = (
  appEventsApi: MinimalAppEventsApi | undefined,
): ReadonlyArray<MinimalAppEvent> => {
  try {
    if (typeof appEventsApi?.findByName !== "function") {
      return [];
    }
    return [
      ...(appEventsApi.findByName("messaging.delete_for_everyone_requested", 8) ?? []),
      ...(appEventsApi.findByName("messaging.delete_for_everyone_rejected", 8) ?? []),
      ...(appEventsApi.findByName("messaging.delete_for_everyone_local_applied", 8) ?? []),
      ...(appEventsApi.findByName("messaging.delete_for_everyone_remote_result", 8) ?? []),
    ]
      .sort((left, right) => toNumber(left.atUnixMs) - toNumber(right.atUnixMs))
      .slice(-EVENT_CAPTURE_LIMIT);
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
      asyncVoiceNoteSummary: digest.asyncVoiceNoteSummary,
      deleteConvergenceSummary: digest.deleteConvergenceSummary,
      transitions: readRecentTransitions(appEventsApi),
      ignoredEvents: readRecentIgnoredEvents(appEventsApi),
      connectTimeoutEvents: readRecentConnectTimeoutEvents(appEventsApi),
      connectingWatchdogGateEvents: readRecentConnectingWatchdogGateEvents(appEventsApi),
      longSessionGateEvents: readRecentCp4GateEvents(appEventsApi, "messaging.realtime_voice.long_session_gate"),
      checkpointGateEvents: readRecentCp4GateEvents(appEventsApi, "messaging.realtime_voice.cp4_checkpoint_gate"),
      releaseReadinessGateEvents: readRecentCp4GateEvents(appEventsApi, "messaging.realtime_voice.cp4_release_readiness_gate"),
      releaseEvidenceGateEvents: readRecentCp4GateEvents(appEventsApi, "messaging.realtime_voice.cp4_release_evidence_gate"),
      closeoutGateEvents: readRecentCp4GateEvents(appEventsApi, "messaging.realtime_voice.v120_closeout_gate"),
      voiceNoteEvents: readRecentVoiceNoteEvents(appEventsApi),
      deleteConvergenceEvents: readRecentDeleteConvergenceEvents(appEventsApi),
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
  parseAsyncVoiceNoteSummary,
  parseDeleteConvergenceSummary,
  parseRealtimeVoiceSummary,
  toNumericWindowSize,
};
