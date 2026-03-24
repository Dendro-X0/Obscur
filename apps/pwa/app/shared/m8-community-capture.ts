type MinimalAppEvent = Readonly<{
  name: string;
  level?: string;
  atUnixMs?: number;
  context?: Readonly<Record<string, string | number | boolean | null>>;
}>;

type CommunityLifecycleConvergenceSummary = Readonly<{
  riskLevel: "none" | "watch" | "high";
  latestPersistedGroupCount: number | null;
  latestPersistedDuplicateMergeCount: number | null;
  latestHydratedFromPersistedWithLedgerCount: number | null;
  latestHydratedFromPersistedFallbackCount: number | null;
  latestHydratedFromLedgerOnlyCount: number | null;
  latestPlaceholderDisplayNameRecoveredCount: number | null;
  latestLocalMemberBackfillCount: number | null;
  latestMissingLedgerCoverageCount: number | null;
  latestHiddenByLedgerStatusCount: number | null;
  recoveryRepairSignalCount: number;
}>;

type MembershipSendabilitySummary = Readonly<{
  riskLevel: "none" | "watch" | "high";
  latestVisibleGroupCount: number | null;
  latestChatStateGroupCount: number | null;
  roomKeyMissingSendBlockedCount: number;
}>;

type MinimalCrossDeviceDigest = Readonly<{
  summary?: Readonly<{
    communityLifecycleConvergence?: CommunityLifecycleConvergenceSummary;
    membershipSendability?: MembershipSendabilitySummary;
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
}>;

type MinimalM0TriageApi = Readonly<{
  capture?: (count?: number) => unknown;
}>;

export type M8CommunityCaptureBundle = Readonly<{
  generatedAtUnixMs: number;
  version: "obscur.m8.community.v1";
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
  community: Readonly<{
    communityLifecycleConvergence: CommunityLifecycleConvergenceSummary | null;
    membershipSendability: MembershipSendabilitySummary | null;
    membershipRecoveryHydrate: ReadonlyArray<Readonly<{
      atUnixMs: number;
      level: string;
      context: Readonly<Record<string, string | number | boolean | null>>;
    }>>;
    membershipLedgerLoad: ReadonlyArray<Readonly<{
      atUnixMs: number;
      level: string;
      context: Readonly<Record<string, string | number | boolean | null>>;
    }>>;
    roomKeyMissingSendBlocked: ReadonlyArray<Readonly<{
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
    replayReadiness: Readonly<{
      hasCommunityLifecycleSummary: boolean;
      hasMembershipSendabilitySummary: boolean;
      hasRecoveryHydrateEvents: boolean;
      hasLedgerLoadEvents: boolean;
      observedJoinedRoomKeyMismatch: boolean;
      readyForCp2Evidence: boolean;
    }>;
  }>;
  m0Triage: unknown | null;
}>;

type M8CommunityCaptureApi = Readonly<{
  capture: (eventWindowSize?: number) => M8CommunityCaptureBundle;
  captureJson: (eventWindowSize?: number) => string;
}>;

const DEFAULT_EVENT_WINDOW_SIZE = 400;
const EVENT_CAPTURE_LIMIT = 24;
const MEMBERSHIP_RECOVERY_HYDRATE_EVENT = "groups.membership_recovery_hydrate";
const MEMBERSHIP_LEDGER_LOAD_EVENT = "groups.membership_ledger_load";
const ROOM_KEY_MISSING_SEND_BLOCKED_EVENT = "groups.room_key_missing_send_blocked";
const ROOM_KEY_MISMATCH_REASON = "target_room_key_missing_after_membership_joined";

type M8CommunityCaptureWindow = Window & {
  obscurAppEvents?: MinimalAppEventsApi;
  obscurM0Triage?: MinimalM0TriageApi;
  obscurM8CommunityCapture?: M8CommunityCaptureApi;
};

declare global {
  interface Window {
    obscurM8CommunityCapture?: M8CommunityCaptureApi;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null
);

const toStringOrNull = (value: unknown): string | null => (
  typeof value === "string" && value.trim().length > 0 ? value : null
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

const parseCommunityLifecycleConvergenceSummary = (
  value: unknown,
): CommunityLifecycleConvergenceSummary | null => {
  if (!isRecord(value)) {
    return null;
  }
  const riskLevel = value.riskLevel;
  if (riskLevel !== "none" && riskLevel !== "watch" && riskLevel !== "high") {
    return null;
  }
  return {
    riskLevel,
    latestPersistedGroupCount: toNumberOrNull(value.latestPersistedGroupCount),
    latestPersistedDuplicateMergeCount: toNumberOrNull(value.latestPersistedDuplicateMergeCount),
    latestHydratedFromPersistedWithLedgerCount: toNumberOrNull(value.latestHydratedFromPersistedWithLedgerCount),
    latestHydratedFromPersistedFallbackCount: toNumberOrNull(value.latestHydratedFromPersistedFallbackCount),
    latestHydratedFromLedgerOnlyCount: toNumberOrNull(value.latestHydratedFromLedgerOnlyCount),
    latestPlaceholderDisplayNameRecoveredCount: toNumberOrNull(value.latestPlaceholderDisplayNameRecoveredCount),
    latestLocalMemberBackfillCount: toNumberOrNull(value.latestLocalMemberBackfillCount),
    latestMissingLedgerCoverageCount: toNumberOrNull(value.latestMissingLedgerCoverageCount),
    latestHiddenByLedgerStatusCount: toNumberOrNull(value.latestHiddenByLedgerStatusCount),
    recoveryRepairSignalCount: toNumberOrNull(value.recoveryRepairSignalCount) ?? 0,
  };
};

const parseMembershipSendabilitySummary = (
  value: unknown,
): MembershipSendabilitySummary | null => {
  if (!isRecord(value)) {
    return null;
  }
  const riskLevel = value.riskLevel;
  if (riskLevel !== "none" && riskLevel !== "watch" && riskLevel !== "high") {
    return null;
  }
  return {
    riskLevel,
    latestVisibleGroupCount: toNumberOrNull(value.latestVisibleGroupCount),
    latestChatStateGroupCount: toNumberOrNull(value.latestChatStateGroupCount),
    roomKeyMissingSendBlockedCount: toNumberOrNull(value.roomKeyMissingSendBlockedCount) ?? 0,
  };
};

const readCrossDeviceDigestSafe = (
  appEventsApi: MinimalAppEventsApi | undefined,
  eventWindowSize: number,
): Readonly<{
  communityLifecycleConvergence: CommunityLifecycleConvergenceSummary | null;
  membershipSendability: MembershipSendabilitySummary | null;
  membershipRecoveryHydrate: ReadonlyArray<Readonly<{
    atUnixMs: number;
    level: string;
    context: Readonly<Record<string, string | number | boolean | null>>;
  }>>;
  membershipLedgerLoad: ReadonlyArray<Readonly<{
    atUnixMs: number;
    level: string;
    context: Readonly<Record<string, string | number | boolean | null>>;
  }>>;
  roomKeyMissingSendBlocked: ReadonlyArray<Readonly<{
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
      return {
        communityLifecycleConvergence: null,
        membershipSendability: null,
        membershipRecoveryHydrate: [],
        membershipLedgerLoad: [],
        roomKeyMissingSendBlocked: [],
        recentWarnOrError: [],
      };
    }
    const raw = appEventsApi.getCrossDeviceSyncDigest(eventWindowSize) as MinimalCrossDeviceDigest;
    const toCompactEvents = (
      entries: ReadonlyArray<Readonly<{
        atUnixMs: number;
        level: string;
        context: Readonly<Record<string, string | number | boolean | null>>;
      }>> | undefined,
    ): ReadonlyArray<Readonly<{
      atUnixMs: number;
      level: string;
      context: Readonly<Record<string, string | number | boolean | null>>;
    }>> => (
      Array.isArray(entries)
        ? entries
          .slice(-EVENT_CAPTURE_LIMIT)
          .map((event) => ({
            atUnixMs: typeof event.atUnixMs === "number" && Number.isFinite(event.atUnixMs)
              ? Math.floor(event.atUnixMs)
              : 0,
            level: toStringOrNull(event.level) ?? "unknown",
            context: toPrimitiveContext(event.context),
          }))
        : []
    );
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
      communityLifecycleConvergence: parseCommunityLifecycleConvergenceSummary(
        raw?.summary?.communityLifecycleConvergence,
      ),
      membershipSendability: parseMembershipSendabilitySummary(raw?.summary?.membershipSendability),
      membershipRecoveryHydrate: toCompactEvents(raw?.events?.[MEMBERSHIP_RECOVERY_HYDRATE_EVENT]),
      membershipLedgerLoad: toCompactEvents(raw?.events?.[MEMBERSHIP_LEDGER_LOAD_EVENT]),
      roomKeyMissingSendBlocked: toCompactEvents(raw?.events?.[ROOM_KEY_MISSING_SEND_BLOCKED_EVENT]),
      recentWarnOrError,
    };
  } catch {
    return {
      communityLifecycleConvergence: null,
      membershipSendability: null,
      membershipRecoveryHydrate: [],
      membershipLedgerLoad: [],
      roomKeyMissingSendBlocked: [],
      recentWarnOrError: [],
    };
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
  communityLifecycleConvergence: CommunityLifecycleConvergenceSummary | null;
  membershipSendability: MembershipSendabilitySummary | null;
  membershipRecoveryHydrate: ReadonlyArray<Readonly<{
    context: Readonly<Record<string, string | number | boolean | null>>;
  }>>;
  membershipLedgerLoad: ReadonlyArray<Readonly<{
    context: Readonly<Record<string, string | number | boolean | null>>;
  }>>;
  roomKeyMissingSendBlocked: ReadonlyArray<Readonly<{
    context: Readonly<Record<string, string | number | boolean | null>>;
  }>>;
}>): Readonly<{
  hasCommunityLifecycleSummary: boolean;
  hasMembershipSendabilitySummary: boolean;
  hasRecoveryHydrateEvents: boolean;
  hasLedgerLoadEvents: boolean;
  observedJoinedRoomKeyMismatch: boolean;
  readyForCp2Evidence: boolean;
}> => {
  const observedJoinedRoomKeyMismatch = params.roomKeyMissingSendBlocked.some((entry) => (
    toStringOrNull(entry.context.reasonCode) === ROOM_KEY_MISMATCH_REASON
  ));
  const hasCommunityLifecycleSummary = params.communityLifecycleConvergence !== null;
  const hasMembershipSendabilitySummary = params.membershipSendability !== null;
  const hasRecoveryHydrateEvents = params.membershipRecoveryHydrate.length > 0;
  const hasLedgerLoadEvents = params.membershipLedgerLoad.length > 0;
  return {
    hasCommunityLifecycleSummary,
    hasMembershipSendabilitySummary,
    hasRecoveryHydrateEvents,
    hasLedgerLoadEvents,
    observedJoinedRoomKeyMismatch,
    readyForCp2Evidence: (
      hasCommunityLifecycleSummary
      && hasMembershipSendabilitySummary
      && hasRecoveryHydrateEvents
      && hasLedgerLoadEvents
    ),
  };
};

const createBundle = (
  root: M8CommunityCaptureWindow,
  eventWindowSizeInput?: number,
): M8CommunityCaptureBundle => {
  const eventWindowSize = toNumericWindowSize(eventWindowSizeInput);
  const appEventsApi = root.obscurAppEvents;
  const digest = readCrossDeviceDigestSafe(appEventsApi, eventWindowSize);
  return {
    generatedAtUnixMs: Date.now(),
    version: "obscur.m8.community.v1",
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
    community: {
      communityLifecycleConvergence: digest.communityLifecycleConvergence,
      membershipSendability: digest.membershipSendability,
      membershipRecoveryHydrate: digest.membershipRecoveryHydrate,
      membershipLedgerLoad: digest.membershipLedgerLoad,
      roomKeyMissingSendBlocked: digest.roomKeyMissingSendBlocked,
      recentWarnOrError: digest.recentWarnOrError,
      replayReadiness: buildReplayReadiness({
        communityLifecycleConvergence: digest.communityLifecycleConvergence,
        membershipSendability: digest.membershipSendability,
        membershipRecoveryHydrate: digest.membershipRecoveryHydrate,
        membershipLedgerLoad: digest.membershipLedgerLoad,
        roomKeyMissingSendBlocked: digest.roomKeyMissingSendBlocked,
      }),
    },
    m0Triage: readM0TriageSafe(root.obscurM0Triage, eventWindowSize),
  };
};

export const installM8CommunityCapture = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  const root = window as M8CommunityCaptureWindow;
  if (root.obscurM8CommunityCapture) {
    return;
  }
  root.obscurM8CommunityCapture = {
    capture: (eventWindowSize = DEFAULT_EVENT_WINDOW_SIZE): M8CommunityCaptureBundle => (
      createBundle(root, eventWindowSize)
    ),
    captureJson: (eventWindowSize = DEFAULT_EVENT_WINDOW_SIZE): string => (
      JSON.stringify(createBundle(root, eventWindowSize), null, 2)
    ),
  };
};

export const m8CommunityCaptureInternals = {
  createBundle,
  toNumericWindowSize,
  parseCommunityLifecycleConvergenceSummary,
  parseMembershipSendabilitySummary,
  buildReplayReadiness,
};
