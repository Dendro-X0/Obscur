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
    summary: Readonly<{
      selfAuthoredDmContinuity: Readonly<{
        riskLevel: "none" | "watch" | "high";
        latestHydratedOutgoingCount: number | null;
        latestMergedOutgoingCount: number | null;
        sparseOutgoingEvidence: boolean | null;
        idSplitDetectedCount: number;
      }>;
      membershipSendability: Readonly<{
        riskLevel: "none" | "watch" | "high";
        latestVisibleGroupCount: number | null;
        latestChatStateGroupCount: number | null;
        roomKeyMissingSendBlockedCount: number;
        joinedMembershipRoomKeyMismatchCount: number;
        localProfileScopeRoomKeyMissingCount: number;
        noLocalRoomKeysCount: number;
        latestReasonCode: string | null;
      }>;
      accountSwitchScopeConvergence: Readonly<{
        riskLevel: "none" | "watch" | "high";
        backupRestoreProfileScopeMismatchCount: number;
        runtimeActivationProfileScopeMismatchCount: number;
        autoUnlockScopeDriftDetectedCount: number;
        latestBackupRestoreReasonCode: string | null;
        latestRuntimeActivationReasonCode: string | null;
        latestAutoUnlockReasonCode: string | null;
      }>;
      incomingRequestAntiAbuse: Readonly<{
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
      m10TrustControls: Readonly<{
        riskLevel: "none" | "watch" | "high";
        cp2StabilityGateCount: number;
        cp2StabilityGatePassCount: number;
        cp2StabilityGateFailCount: number;
        cp2StabilityGateUnexpectedFailCount: number;
        latestExpectedStable: boolean | null;
        latestPass: boolean | null;
        latestFailedCheckSample: string | null;
      }>;
      communityLifecycleConvergence: Readonly<{
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
      mediaHydrationParity: Readonly<{
        riskLevel: "none" | "watch" | "high";
        latestHydratedDmAttachmentCount: number | null;
        latestMergedDmAttachmentCount: number | null;
        latestAppliedDmAttachmentCount: number | null;
        latestHydratedGroupAttachmentCount: number | null;
        latestMergedGroupAttachmentCount: number | null;
        latestAppliedGroupAttachmentCount: number | null;
        attachmentDropRegressionCount: number;
        criticalHydrationDriftCount: number;
      }>;
      searchJumpNavigation: Readonly<{
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
      uiResponsiveness: Readonly<{
        riskLevel: "none" | "watch" | "high";
        routeRequestCount: number;
        routeSettledCount: number;
        routeStallHardFallbackCount: number;
        routeMountProbeSlowCount: number;
        routeMountProbeSettledWarnCount: number;
        routeMountPerformanceGuardEnabledCount: number;
        pageTransitionWatchdogTimeoutCount: number;
        pageTransitionEffectsDisabledCount: number;
        startupProfileBootStallTimeoutCount: number;
        latestRouteSurface: string | null;
        latestRouteStallElapsedMs: number | null;
        latestRouteMountProbeElapsedMs: number | null;
        latestPageTransitionWatchdogElapsedMs: number | null;
        latestStartupProfileBootPhase: string | null;
      }>;
      realtimeVoiceSession: Readonly<{
        riskLevel: "none" | "watch" | "high";
        transitionCount: number;
        degradedCount: number;
        unsupportedCount: number;
        recoveryExhaustedCount: number;
        staleEventIgnoredCount: number;
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
      asyncVoiceNote: Readonly<{
        riskLevel: "none" | "watch" | "high";
        recordingCompleteCount: number;
        recordingUnsupportedCount: number;
        recordingStartFailedCount: number;
        recordingEmptyCount: number;
        latestReasonCode: string | null;
      }>;
      deleteConvergence: Readonly<{
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
    }>;
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
const SEARCH_JUMP_DOM_UNRESOLVED_REASON_CODES: ReadonlySet<string> = new Set([
  "target_dom_not_resolved_after_index_match",
  "timestamp_fallback_dom_not_resolved",
]);
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
    "incomingDmAttachmentCount",
    "localDmAttachmentCount",
    "mergedDmAttachmentCount",
    "incomingGroupConversationCount",
    "localGroupConversationCount",
    "mergedGroupConversationCount",
    "incomingGroupAttachmentCount",
    "localGroupAttachmentCount",
    "mergedGroupAttachmentCount",
  ],
  "account_sync.backup_restore_apply_diagnostics": [
    "publicKeySuffix",
    "restorePath",
    "restoreChatStateDomains",
    "appliedDmOutgoingCount",
    "appliedDmIncomingCount",
    "appliedDmMessageCount",
    "appliedDmAttachmentCount",
    "appliedGroupConversationCount",
    "appliedGroupMessageCount",
    "appliedGroupSelfAuthoredCount",
    "appliedGroupAttachmentCount",
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
    "hydratedDmAttachmentCount",
    "hydratedGroupAttachmentCount",
  ],
  "messaging.conversation_hydration_diagnostics": [
    "conversationIdHint",
    "indexedMessageCount",
    "indexedOutgoingCount",
    "indexedIncomingCount",
    "projectionMessageCount",
    "projectionOutgoingCount",
    "projectionIncomingCount",
    "shouldUseProjectionFallback",
    "projectionReadAuthorityReason",
    "criticalDriftCount",
  ],
  "messaging.conversation_hydration_id_split_detected": [
    "conversationIdHint",
    "indexedIncomingOnlyCount",
    "siblingConversationCount",
    "siblingWithOutgoingCount",
    "siblingOutgoingCount",
    "siblingIncomingCount",
    "projectionReadAuthorityReason",
    "criticalDriftCount",
  ],
  "messaging.legacy_migration_diagnostics": [
    "publicKeySuffix",
    "sourceConversationCount",
    "migratedConversationCount",
    "migratedMessageCount",
    "migratedOutgoingCount",
    "migratedIncomingCount",
    "incomingOnlyConversationCount",
    "potentialConversationSplitDetected",
  ],
  "groups.membership_recovery_hydrate": [
    "publicKeySuffix",
    "profileId",
    "persistedGroupCount",
    "persistedDuplicateMergeCount",
    "ledgerEntryCount",
    "visibleGroupCount",
    "hydratedFromPersistedWithLedgerCount",
    "hydratedFromPersistedFallbackCount",
    "hydratedFromLedgerOnlyCount",
    "placeholderDisplayNameRecoveredCount",
    "localMemberBackfillCount",
    "hiddenByTombstoneCount",
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
  "groups.room_key_missing_send_blocked": [
    "groupIdHint",
    "reasonCode",
    "localRoomKeyCount",
    "hasTargetGroupRecord",
    "activeProfileId",
    "senderPubkeySuffix",
    "knownGroupHintSample",
  ],
  "messaging.chat_state_replaced": [
    "publicKeySuffix",
    "profileId",
    "createdConnectionCount",
    "createdGroupCount",
    "dmConversationCount",
    "groupConversationCount",
  ],
  "messaging.chat_state_groups_update": [
    "publicKeySuffix",
    "profileId",
    "groupCount",
  ],
  "messaging.request.incoming_quarantined": [
    "reasonCode",
    "peerPubkeyPrefix",
    "peerWindowCount",
    "globalWindowCount",
    "peerLimit",
    "globalLimit",
    "windowMs",
    "peerCooldownMs",
    "cooldownRemainingMs",
  ],
  "messaging.m10.cp2_stability_gate": [
    "expectedStable",
    "cp2Pass",
    "failedCheckCount",
    "failedCheckSample",
    "incomingRequestRiskLevel",
    "incomingRequestQuarantinedCount",
    "uiResponsivenessRiskLevel",
    "uiRouteStallHardFallbackCount",
    "uiPageTransitionEffectsDisabledCount",
    "uiRouteMountPerformanceGuardEnabledCount",
    "uiStartupProfileBootStallTimeoutCount",
  ],
  "account_sync.backup_restore_result": [
    "reason",
    "result",
    "guardEnabled",
    "convergenceLatencyMs",
  ],
  "account_sync.backup_restore_profile_scope_mismatch": [
    "reasonCode",
    "publicKeySuffix",
    "backupEventId",
    "requestedProfileId",
    "effectiveProfileId",
    "activeProfileIdAtRestoreStart",
    "activeProfileIdBeforeApply",
    "activeProfileIdAfterApply",
    "hasCanonicalAppender",
  ],
  "account_sync.backup_publish_result": [
    "reason",
    "result",
    "guardEnabled",
  ],
  "account_sync.backup_restore_history_regression": [
    "publicKeySuffix",
    "stage",
    "restorePath",
    "dmOutgoingDropped",
    "groupSelfAuthoredDropped",
    "dmAttachmentDropped",
    "groupAttachmentDropped",
    "dmOutgoingDelta",
    "groupSelfAuthoredDelta",
    "dmAttachmentDelta",
    "groupAttachmentDelta",
    "fromDmAttachmentCount",
    "toDmAttachmentCount",
    "fromGroupAttachmentCount",
    "toGroupAttachmentCount",
  ],
  "messaging.search_jump_requested": [
    "conversationIdHint",
    "conversationKind",
    "targetMessageIdHint",
    "targetTimestampMs",
  ],
  "messaging.search_jump_resolved": [
    "resolutionMode",
    "conversationIdHint",
    "targetMessageIdHint",
    "resolvedMessageIdHint",
    "loadAttemptCount",
    "renderResolveAttemptCount",
    "messageWindowCount",
  ],
  "messaging.search_jump_unresolved": [
    "reasonCode",
    "conversationIdHint",
    "targetMessageIdHint",
    "loadAttemptCount",
    "renderResolveAttemptCount",
    "messageWindowCount",
  ],
  "messaging.realtime_voice.session_transition": [
    "roomIdHint",
    "mode",
    "fromPhase",
    "toPhase",
    "reasonCode",
    "participantCount",
    "hasPeerSessionEvidence",
    "recoveryAttemptCount",
    "maxRecoveryAttempts",
    "isRecoverable",
  ],
  "messaging.realtime_voice.session_event_ignored": [
    "reasonCode",
    "roomIdHint",
    "phase",
    "mode",
    "eventUnixMs",
    "lastTransitionAtUnixMs",
  ],
  "messaging.realtime_voice.long_session_gate": [
    "cp4Pass",
    "failedCheckCount",
    "failedCheckSample",
    "cycleCount",
    "injectRecoveryExhausted",
    "finalPhase",
    "finalReasonCode",
    "transitionEventCount",
    "degradedTransitionCount",
    "recoveredActiveTransitionCount",
    "endedTransitionCount",
    "digestRecoveryExhaustedCount",
    "digestRiskLevel",
    "replayReadinessReadyForCp2",
  ],
  "messaging.realtime_voice.cp4_checkpoint_gate": [
    "cp4CheckpointPass",
    "expectedPass",
    "failedCheckCount",
    "failedCheckSample",
    "longSessionGatePass",
    "gateProbePass",
    "selfTestGatePass",
    "digestRiskNotHigh",
    "digestUnexpectedGateFailZero",
    "digestRiskLevel",
    "digestUnexpectedLongSessionGateFailCount",
    "cycleCount",
    "injectRecoveryExhausted",
  ],
  "messaging.realtime_voice.cp4_release_readiness_gate": [
    "cp4ReleaseReadinessPass",
    "expectedPass",
    "failedCheckCount",
    "failedCheckSample",
    "checkpointGatePass",
    "checkpointEventObserved",
    "digestSummaryPresent",
    "digestCheckpointGateCountObserved",
    "digestLatestCheckpointAligned",
    "digestUnexpectedCheckpointFailZeroWhenExpectedPass",
    "digestRiskNotHighWhenExpectedPass",
    "digestRiskLevel",
    "digestCheckpointGateCount",
    "digestLatestCheckpointGatePass",
    "digestUnexpectedCheckpointGateFailCount",
    "cycleCount",
    "injectRecoveryExhausted",
  ],
  "messaging.realtime_voice.cp4_release_evidence_gate": [
    "cp4ReleaseEvidencePass",
    "expectedPass",
    "failedCheckCount",
    "failedCheckSample",
    "releaseReadinessGatePass",
    "longSessionEventObserved",
    "checkpointEventObserved",
    "releaseReadinessEventObserved",
    "latestReleaseReadinessEventMatchesGate",
    "digestSummaryPresent",
    "digestRiskNotHighWhenExpectedPass",
    "digestUnexpectedReleaseReadinessFailZeroWhenExpectedPass",
    "digestRiskLevel",
    "digestUnexpectedReleaseReadinessGateFailCount",
    "eventSliceLimit",
    "cycleCount",
    "injectRecoveryExhausted",
  ],
  "messaging.realtime_voice.v120_closeout_gate": [
    "closeoutPass",
    "expectedPass",
    "failedCheckCount",
    "failedCheckSample",
    "cp3SuitePass",
    "weakNetworkCp2Pass",
    "accountSwitchCp2Pass",
    "cp4ReleaseEvidencePass",
    "cp4ReleaseReadinessPass",
    "cp4CheckpointPass",
    "weakDeleteRemoteFailureCount",
    "accountDeleteRemoteFailureCount",
    "longSessionDeleteRemoteFailureCount",
    "digestRiskLevel",
    "digestUnexpectedReleaseEvidenceGateFailCount",
    "eventSliceLimit",
  ],
  "messaging.voice_note.recording_complete": [
    "durationSeconds",
    "mimeType",
    "byteLength",
  ],
  "messaging.voice_note.recording_unsupported": [
    "reasonCode",
    "isTauri",
    "isSecureContext",
    "supportsMediaDevices",
    "supportsMediaRecorder",
    "supportsGetUserMedia",
  ],
  "messaging.voice_note.recording_start_failed": [
    "reasonCode",
    "errorName",
    "errorMessage",
  ],
  "messaging.voice_note.recording_empty": [
    "reasonCode",
    "mimeType",
  ],
  "messaging.delete_for_everyone_requested": [
    "conversationIdHint",
    "messageIdHint",
    "conversationKind",
    "isOutgoing",
    "hasVoiceNoteAttachment",
  ],
  "messaging.delete_for_everyone_rejected": [
    "reasonCode",
    "conversationIdHint",
    "messageIdHint",
    "conversationKind",
    "isOutgoing",
    "hasVoiceNoteAttachment",
  ],
  "messaging.delete_for_everyone_local_applied": [
    "conversationIdHint",
    "messageIdHint",
    "conversationKind",
    "isOutgoing",
    "hasVoiceNoteAttachment",
  ],
  "messaging.delete_for_everyone_remote_result": [
    "channel",
    "resultCode",
    "reasonCode",
    "deliveryStatus",
    "conversationIdHint",
    "messageIdHint",
    "conversationKind",
    "isOutgoing",
    "deleteTargetCount",
    "remoteMessageIdHint",
  ],
  "navigation.route_request": [
    "guardSource",
    "fromPathname",
    "fromRouteSurface",
    "targetHref",
    "targetRouteSurface",
    "hardFallbackAfterMs",
  ],
  "navigation.route_settled": [
    "guardSource",
    "pathname",
    "routeSurface",
    "elapsedMs",
  ],
  "navigation.route_stall_hard_fallback": [
    "guardSource",
    "fromPathname",
    "fromRouteSurface",
    "currentPathname",
    "currentRouteSurface",
    "targetHref",
    "targetRouteSurface",
    "elapsedMs",
    "hardFallbackAfterMs",
  ],
  "navigation.route_mount_probe_slow": [
    "pathname",
    "routeSurface",
    "elapsedMs",
    "warnThresholdMs",
    "pendingTargetHref",
  ],
  "navigation.route_mount_probe_settled": [
    "pathname",
    "routeSurface",
    "elapsedMs",
    "firstFrameDelayMs",
    "secondFrameDelayMs",
    "routeRequestElapsedMs",
    "warnThresholdMs",
    "pageTransitionsEnabled",
    "transitionWatchdogTimeoutCount",
  ],
  "navigation.route_mount_performance_guard_enabled": [
    "pathname",
    "routeSurface",
    "elapsedMs",
    "slowSampleCount",
    "consecutiveSlowSampleCount",
    "disableThreshold",
    "warnThresholdMs",
  ],
  "navigation.page_transition_watchdog_timeout": [
    "pathname",
    "routeSurface",
    "elapsedMs",
    "timeoutCount",
    "transitionsDisabled",
    "watchdogTimeoutMs",
  ],
  "navigation.page_transition_effects_disabled": [
    "pathname",
    "routeSurface",
    "timeoutCount",
    "disableReason",
    "consecutiveSlowSampleCount",
    "disableThreshold",
  ],
  "runtime.profile_boot_stall_timeout": [
    "phase",
    "timeoutMs",
  ],
  "runtime.activation.timeout": [
    "timeouts",
    "projectionPhase",
    "projectionStatus",
    "relayOpenCount",
    "relayTotalCount",
  ],
  "runtime.activation.profile_scope_mismatch": [
    "reasonCode",
    "runtimePhase",
    "boundProfileId",
    "projectionProfileId",
    "identityPubkeySuffix",
    "projectionPubkeySuffix",
    "accountSyncPubkeySuffix",
    "runtimeSessionPubkeySuffix",
    "accountProjectionPhase",
    "accountSyncPhase",
  ],
  "auth.auto_unlock_scope_drift_detected": [
    "reasonCode",
    "profileId",
    "rememberSource",
    "tokenSource",
    "runtimePhase",
    "identityStatus",
    "resolvedRememberProfileId",
    "resolvedTokenProfileId",
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

const toNumberOrNull = (value: unknown): number | null => (
  typeof value === "number" && Number.isFinite(value) ? value : null
);

const toBooleanOrNull = (value: unknown): boolean | null => (
  typeof value === "boolean" ? value : null
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

const getLatestContext = (
  events: Readonly<Record<string, ReadonlyArray<Readonly<{
    atUnixMs: number;
    level: AppEventLevel;
    context: Readonly<Record<string, string | number | boolean | null>>;
  }>>>>,
  name: string,
): Readonly<Record<string, string | number | boolean | null>> | null => {
  const list = events[name];
  if (!Array.isArray(list) || list.length === 0) {
    return null;
  }
  return list[list.length - 1]?.context ?? null;
};

const getRiskLevel = (params: Readonly<{ watch: boolean; high: boolean }>): "none" | "watch" | "high" => {
  if (params.high) {
    return "high";
  }
  if (params.watch) {
    return "watch";
  }
  return "none";
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
      const latestHydration = getLatestContext(events, "account_sync.backup_payload_hydration_diagnostics");
      const latestMerge = getLatestContext(events, "account_sync.backup_restore_merge_diagnostics");
      const latestApply = getLatestContext(events, "account_sync.backup_restore_apply_diagnostics");
      const latestFallback = getLatestContext(events, "account_sync.backup_payload_projection_fallback");
      const latestMembershipHydrate = getLatestContext(events, "groups.membership_recovery_hydrate");
      const latestChatStateGroups = getLatestContext(events, "messaging.chat_state_groups_update");
      const idSplitDetectedCount = recent.filter((event) => (
        event.name === "messaging.conversation_hydration_id_split_detected"
      )).length;
      const roomKeyMissingSendBlockedCount = recent.filter((event) => (
        event.name === "groups.room_key_missing_send_blocked"
      )).length;
      const roomKeyMissingSendBlockedEvents = recent.filter((event) => (
        event.name === "groups.room_key_missing_send_blocked"
      ));
      const backupRestoreProfileScopeMismatchEvents = recent.filter((event) => (
        event.name === "account_sync.backup_restore_profile_scope_mismatch"
      ));
      const runtimeActivationProfileScopeMismatchEvents = recent.filter((event) => (
        event.name === "runtime.activation.profile_scope_mismatch"
      ));
      const autoUnlockScopeDriftDetectedEvents = recent.filter((event) => (
        event.name === "auth.auto_unlock_scope_drift_detected"
      ));
      const joinedMembershipRoomKeyMismatchCount = roomKeyMissingSendBlockedEvents.filter((event) => (
        event.context?.reasonCode === "target_room_key_missing_after_membership_joined"
      )).length;
      const localProfileScopeRoomKeyMissingCount = roomKeyMissingSendBlockedEvents.filter((event) => (
        event.context?.reasonCode === "target_room_key_missing_local_profile_scope"
      )).length;
      const noLocalRoomKeysCount = roomKeyMissingSendBlockedEvents.filter((event) => (
        event.context?.reasonCode === "no_local_room_keys"
      )).length;
      const latestRoomKeyMissingSendBlockedReasonCode = toStringOrNull(
        roomKeyMissingSendBlockedEvents.at(-1)?.context?.reasonCode,
      );
      const backupRestoreProfileScopeMismatchCount = backupRestoreProfileScopeMismatchEvents.length;
      const runtimeActivationProfileScopeMismatchCount = runtimeActivationProfileScopeMismatchEvents.length;
      const autoUnlockScopeDriftDetectedCount = autoUnlockScopeDriftDetectedEvents.length;
      const latestBackupRestoreProfileScopeMismatchReasonCode = toStringOrNull(
        backupRestoreProfileScopeMismatchEvents.at(-1)?.context?.reasonCode,
      );
      const latestRuntimeActivationProfileScopeMismatchReasonCode = toStringOrNull(
        runtimeActivationProfileScopeMismatchEvents.at(-1)?.context?.reasonCode,
      );
      const latestAutoUnlockScopeDriftReasonCode = toStringOrNull(
        autoUnlockScopeDriftDetectedEvents.at(-1)?.context?.reasonCode,
      );
      const incomingRequestQuarantineEvents = recent.filter((event) => (
        event.name === "messaging.request.incoming_quarantined"
      ));
      const incomingRequestQuarantinedCount = incomingRequestQuarantineEvents.length;
      const incomingRequestPeerRateLimitedCount = incomingRequestQuarantineEvents.filter((event) => (
        event.context?.reasonCode === "incoming_connection_request_peer_rate_limited"
      )).length;
      const incomingRequestPeerCooldownActiveCount = incomingRequestQuarantineEvents.filter((event) => (
        event.context?.reasonCode === "incoming_connection_request_peer_cooldown_active"
      )).length;
      const incomingRequestGlobalRateLimitedCount = incomingRequestQuarantineEvents.filter((event) => (
        event.context?.reasonCode === "incoming_connection_request_global_rate_limited"
      )).length;
      const incomingRequestUniquePeerPrefixCount = new Set(
        incomingRequestQuarantineEvents
          .map((event) => toStringOrNull(event.context?.peerPubkeyPrefix))
          .filter((value): value is string => typeof value === "string" && value.length > 0),
      ).size;
      const latestIncomingRequestQuarantineEvent = incomingRequestQuarantineEvents.at(-1);
      const latestIncomingRequestReasonCode = toStringOrNull(
        latestIncomingRequestQuarantineEvent?.context?.reasonCode,
      );
      const latestIncomingRequestPeerPubkeyPrefix = toStringOrNull(
        latestIncomingRequestQuarantineEvent?.context?.peerPubkeyPrefix,
      );
      const latestIncomingRequestCooldownRemainingMs = toNumberOrNull(
        latestIncomingRequestQuarantineEvent?.context?.cooldownRemainingMs,
      );
      const m10Cp2StabilityGateEvents = recent.filter((event) => (
        event.name === "messaging.m10.cp2_stability_gate"
      ));
      const m10Cp2StabilityGateCount = m10Cp2StabilityGateEvents.length;
      const m10Cp2StabilityGatePassCount = m10Cp2StabilityGateEvents.filter((event) => (
        event.context?.cp2Pass === true
      )).length;
      const m10Cp2StabilityGateFailCount = m10Cp2StabilityGateEvents.filter((event) => (
        event.context?.cp2Pass === false
      )).length;
      const m10Cp2StabilityGateUnexpectedFailCount = m10Cp2StabilityGateEvents.filter((event) => (
        event.context?.cp2Pass === false
        && event.context?.expectedStable === true
      )).length;
      const latestM10Cp2StabilityGateEvent = m10Cp2StabilityGateEvents.at(-1);
      const latestM10Cp2StabilityGateExpectedStable = toBooleanOrNull(
        latestM10Cp2StabilityGateEvent?.context?.expectedStable,
      );
      const latestM10Cp2StabilityGatePass = toBooleanOrNull(
        latestM10Cp2StabilityGateEvent?.context?.cp2Pass,
      );
      const latestM10Cp2StabilityGateFailedCheckSample = toStringOrNull(
        latestM10Cp2StabilityGateEvent?.context?.failedCheckSample,
      );
      const latestHydratedOutgoingCount = toNumberOrNull(
        latestHydration?.hydratedDmOutgoingCount,
      );
      const latestMergedOutgoingCount = toNumberOrNull(
        latestMerge?.mergedDmOutgoingCount,
      );
      const latestMergedIncomingCount = toNumberOrNull(
        latestMerge?.mergedDmIncomingCount,
      );
      const sparseOutgoingEvidence = toBooleanOrNull(
        latestFallback?.reasonSparseOutgoingEvidence,
      );
      const latestVisibleGroupCount = toNumberOrNull(
        latestMembershipHydrate?.visibleGroupCount,
      );
      const latestPersistedGroupCount = toNumberOrNull(
        latestMembershipHydrate?.persistedGroupCount,
      );
      const latestPersistedDuplicateMergeCount = toNumberOrNull(
        latestMembershipHydrate?.persistedDuplicateMergeCount,
      );
      const latestHydratedFromPersistedWithLedgerCount = toNumberOrNull(
        latestMembershipHydrate?.hydratedFromPersistedWithLedgerCount,
      );
      const latestHydratedFromPersistedFallbackCount = toNumberOrNull(
        latestMembershipHydrate?.hydratedFromPersistedFallbackCount,
      );
      const latestHydratedFromLedgerOnlyCount = toNumberOrNull(
        latestMembershipHydrate?.hydratedFromLedgerOnlyCount,
      );
      const latestPlaceholderDisplayNameRecoveredCount = toNumberOrNull(
        latestMembershipHydrate?.placeholderDisplayNameRecoveredCount,
      );
      const latestLocalMemberBackfillCount = toNumberOrNull(
        latestMembershipHydrate?.localMemberBackfillCount,
      );
      const latestMissingLedgerCoverageCount = toNumberOrNull(
        latestMembershipHydrate?.missingLedgerCoverageCount,
      );
      const latestHiddenByLedgerStatusCount = toNumberOrNull(
        latestMembershipHydrate?.hiddenByLedgerStatusCount,
      );
      const latestChatStateGroupCount = toNumberOrNull(
        latestChatStateGroups?.groupCount,
      );
      const latestHydratedDmAttachmentCount = toNumberOrNull(
        latestHydration?.hydratedDmAttachmentCount,
      );
      const latestMergedDmAttachmentCount = toNumberOrNull(
        latestMerge?.mergedDmAttachmentCount,
      );
      const latestAppliedDmAttachmentCount = toNumberOrNull(
        latestApply?.appliedDmAttachmentCount,
      );
      const latestHydratedGroupAttachmentCount = toNumberOrNull(
        latestHydration?.hydratedGroupAttachmentCount,
      );
      const latestMergedGroupAttachmentCount = toNumberOrNull(
        latestMerge?.mergedGroupAttachmentCount,
      );
      const latestAppliedGroupAttachmentCount = toNumberOrNull(
        latestApply?.appliedGroupAttachmentCount,
      );
      const attachmentDropRegressionCount = recent.filter((event) => (
        event.name === "account_sync.backup_restore_history_regression"
        && (
          event.context?.dmAttachmentDropped === true
          || event.context?.groupAttachmentDropped === true
        )
      )).length;
      const searchJumpRequestedCount = recent.filter((event) => (
        event.name === "messaging.search_jump_requested"
      )).length;
      const searchJumpResolvedEvents = recent.filter((event) => (
        event.name === "messaging.search_jump_resolved"
      ));
      const searchJumpUnresolvedEvents = recent.filter((event) => (
        event.name === "messaging.search_jump_unresolved"
      ));
      const searchJumpResolvedCount = searchJumpResolvedEvents.length;
      const searchJumpUnresolvedCount = searchJumpUnresolvedEvents.length;
      const searchJumpTimestampFallbackResolvedCount = searchJumpResolvedEvents.filter((event) => (
        event.context?.resolutionMode === "timestamp_fallback"
      )).length;
      const searchJumpDomUnresolvedCount = searchJumpUnresolvedEvents.filter((event) => (
        typeof event.context?.reasonCode === "string"
        && SEARCH_JUMP_DOM_UNRESOLVED_REASON_CODES.has(event.context.reasonCode)
      )).length;
      const searchJumpLoadExhaustedUnresolvedCount = searchJumpUnresolvedEvents.filter((event) => (
        event.context?.reasonCode === "target_not_found_after_load_attempts"
      )).length;
      const membershipRecoveryRepairSignalCount = recent.filter((event) => (
        event.name === "groups.membership_recovery_hydrate"
        && (
          (typeof event.context?.persistedDuplicateMergeCount === "number" && event.context.persistedDuplicateMergeCount > 0)
          || (typeof event.context?.placeholderDisplayNameRecoveredCount === "number" && event.context.placeholderDisplayNameRecoveredCount > 0)
          || (typeof event.context?.localMemberBackfillCount === "number" && event.context.localMemberBackfillCount > 0)
        )
      )).length;
      const latestSearchJumpResolutionMode = toStringOrNull(
        searchJumpResolvedEvents.at(-1)?.context?.resolutionMode,
      );
      const latestSearchJumpUnresolvedReasonCode = toStringOrNull(
        searchJumpUnresolvedEvents.at(-1)?.context?.reasonCode,
      );
      const routeRequestEvents = recent.filter((event) => (
        event.name === "navigation.route_request"
      ));
      const routeSettledEvents = recent.filter((event) => (
        event.name === "navigation.route_settled"
      ));
      const routeStallHardFallbackEvents = recent.filter((event) => (
        event.name === "navigation.route_stall_hard_fallback"
      ));
      const routeMountProbeSlowEvents = recent.filter((event) => (
        event.name === "navigation.route_mount_probe_slow"
      ));
      const routeMountProbeSettledEvents = recent.filter((event) => (
        event.name === "navigation.route_mount_probe_settled"
      ));
      const routeMountPerformanceGuardEnabledEvents = recent.filter((event) => (
        event.name === "navigation.route_mount_performance_guard_enabled"
      ));
      const pageTransitionWatchdogTimeoutEvents = recent.filter((event) => (
        event.name === "navigation.page_transition_watchdog_timeout"
      ));
      const pageTransitionEffectsDisabledEvents = recent.filter((event) => (
        event.name === "navigation.page_transition_effects_disabled"
      ));
      const startupProfileBootStallTimeoutEvents = recent.filter((event) => (
        event.name === "runtime.profile_boot_stall_timeout"
      ));
      const routeRequestCount = routeRequestEvents.length;
      const routeSettledCount = routeSettledEvents.length;
      const routeStallHardFallbackCount = routeStallHardFallbackEvents.length;
      const routeMountProbeSlowCount = routeMountProbeSlowEvents.length;
      const routeMountProbeSettledWarnCount = routeMountProbeSettledEvents.filter((event) => (
        event.level === "warn"
        || (
          typeof event.context?.elapsedMs === "number"
          && typeof event.context?.warnThresholdMs === "number"
          && event.context.elapsedMs >= event.context.warnThresholdMs
        )
      )).length;
      const routeMountPerformanceGuardEnabledCount = routeMountPerformanceGuardEnabledEvents.length;
      const pageTransitionWatchdogTimeoutCount = pageTransitionWatchdogTimeoutEvents.length;
      const pageTransitionEffectsDisabledCount = pageTransitionEffectsDisabledEvents.length;
      const startupProfileBootStallTimeoutCount = startupProfileBootStallTimeoutEvents.length;
      const latestRouteStallHardFallbackEvent = routeStallHardFallbackEvents.at(-1);
      const latestRouteMountProbeSettledEvent = routeMountProbeSettledEvents.at(-1);
      const latestRouteMountProbeSlowEvent = routeMountProbeSlowEvents.at(-1);
      const latestPageTransitionWatchdogTimeoutEvent = pageTransitionWatchdogTimeoutEvents.at(-1);
      const latestStartupProfileBootStallTimeoutEvent = startupProfileBootStallTimeoutEvents.at(-1);
      const latestUiRouteSurface = toStringOrNull(
        latestRouteStallHardFallbackEvent?.context?.targetRouteSurface
        ?? latestRouteMountProbeSettledEvent?.context?.routeSurface
        ?? latestRouteMountProbeSlowEvent?.context?.routeSurface
        ?? routeSettledEvents.at(-1)?.context?.routeSurface,
      );
      const latestRouteStallElapsedMs = toNumberOrNull(
        latestRouteStallHardFallbackEvent?.context?.elapsedMs,
      );
      const latestRouteMountProbeElapsedMs = toNumberOrNull(
        latestRouteMountProbeSettledEvent?.context?.elapsedMs
        ?? latestRouteMountProbeSlowEvent?.context?.elapsedMs,
      );
      const latestPageTransitionWatchdogElapsedMs = toNumberOrNull(
        latestPageTransitionWatchdogTimeoutEvent?.context?.elapsedMs,
      );
      const latestStartupProfileBootPhase = toStringOrNull(
        latestStartupProfileBootStallTimeoutEvent?.context?.phase,
      );
      const voiceSessionTransitionEvents = recent.filter((event) => (
        event.name === "messaging.realtime_voice.session_transition"
      ));
      const voiceSessionTransitionCount = voiceSessionTransitionEvents.length;
      const voiceSessionDegradedCount = voiceSessionTransitionEvents.filter((event) => (
        event.context?.toPhase === "degraded"
      )).length;
      const voiceSessionUnsupportedCount = voiceSessionTransitionEvents.filter((event) => (
        event.context?.toPhase === "unsupported"
      )).length;
      const voiceSessionRecoveryExhaustedCount = voiceSessionTransitionEvents.filter((event) => (
        event.context?.reasonCode === "recovery_exhausted"
      )).length;
      const voiceSessionIgnoredEvents = recent.filter((event) => (
        event.name === "messaging.realtime_voice.session_event_ignored"
      ));
      const voiceSessionStaleIgnoredCount = voiceSessionIgnoredEvents.filter((event) => (
        event.context?.reasonCode === "stale_event"
      )).length;
      const voiceLongSessionGateEvents = recent.filter((event) => (
        event.name === "messaging.realtime_voice.long_session_gate"
      ));
      const voiceLongSessionGateCount = voiceLongSessionGateEvents.length;
      const voiceLongSessionGatePassCount = voiceLongSessionGateEvents.filter((event) => (
        event.context?.cp4Pass === true
      )).length;
      const voiceLongSessionGateFailCount = voiceLongSessionGateEvents.filter((event) => (
        event.context?.cp4Pass === false
      )).length;
      const voiceUnexpectedLongSessionGateFailCount = voiceLongSessionGateEvents.filter((event) => (
        event.context?.cp4Pass === false
        && event.context?.injectRecoveryExhausted !== true
      )).length;
      const voiceCheckpointGateEvents = recent.filter((event) => (
        event.name === "messaging.realtime_voice.cp4_checkpoint_gate"
      ));
      const voiceCheckpointGateCount = voiceCheckpointGateEvents.length;
      const voiceCheckpointGatePassCount = voiceCheckpointGateEvents.filter((event) => (
        event.context?.cp4CheckpointPass === true
      )).length;
      const voiceCheckpointGateFailCount = voiceCheckpointGateEvents.filter((event) => (
        event.context?.cp4CheckpointPass === false
      )).length;
      const voiceUnexpectedCheckpointGateFailCount = voiceCheckpointGateEvents.filter((event) => (
        event.context?.cp4CheckpointPass === false
        && event.context?.expectedPass === true
      )).length;
      const voiceReleaseReadinessGateEvents = recent.filter((event) => (
        event.name === "messaging.realtime_voice.cp4_release_readiness_gate"
      ));
      const voiceReleaseReadinessGateCount = voiceReleaseReadinessGateEvents.length;
      const voiceReleaseReadinessGatePassCount = voiceReleaseReadinessGateEvents.filter((event) => (
        event.context?.cp4ReleaseReadinessPass === true
      )).length;
      const voiceReleaseReadinessGateFailCount = voiceReleaseReadinessGateEvents.filter((event) => (
        event.context?.cp4ReleaseReadinessPass === false
      )).length;
      const voiceUnexpectedReleaseReadinessGateFailCount = voiceReleaseReadinessGateEvents.filter((event) => (
        event.context?.cp4ReleaseReadinessPass === false
        && event.context?.expectedPass === true
      )).length;
      const voiceReleaseEvidenceGateEvents = recent.filter((event) => (
        event.name === "messaging.realtime_voice.cp4_release_evidence_gate"
      ));
      const voiceReleaseEvidenceGateCount = voiceReleaseEvidenceGateEvents.length;
      const voiceReleaseEvidenceGatePassCount = voiceReleaseEvidenceGateEvents.filter((event) => (
        event.context?.cp4ReleaseEvidencePass === true
      )).length;
      const voiceReleaseEvidenceGateFailCount = voiceReleaseEvidenceGateEvents.filter((event) => (
        event.context?.cp4ReleaseEvidencePass === false
      )).length;
      const voiceUnexpectedReleaseEvidenceGateFailCount = voiceReleaseEvidenceGateEvents.filter((event) => (
        event.context?.cp4ReleaseEvidencePass === false
        && event.context?.expectedPass === true
      )).length;
      const voiceCloseoutGateEvents = recent.filter((event) => (
        event.name === "messaging.realtime_voice.v120_closeout_gate"
      ));
      const voiceCloseoutGateCount = voiceCloseoutGateEvents.length;
      const voiceCloseoutGatePassCount = voiceCloseoutGateEvents.filter((event) => (
        event.context?.closeoutPass === true
      )).length;
      const voiceCloseoutGateFailCount = voiceCloseoutGateEvents.filter((event) => (
        event.context?.closeoutPass === false
      )).length;
      const voiceUnexpectedCloseoutGateFailCount = voiceCloseoutGateEvents.filter((event) => (
        event.context?.closeoutPass === false
        && event.context?.expectedPass === true
      )).length;
      const latestVoiceSessionTransition = voiceSessionTransitionEvents.at(-1);
      const latestVoiceSessionToPhase = toStringOrNull(
        latestVoiceSessionTransition?.context?.toPhase,
      );
      const latestVoiceSessionReasonCode = toStringOrNull(
        latestVoiceSessionTransition?.context?.reasonCode,
      );
      const latestVoiceSessionIgnoredReasonCode = toStringOrNull(
        voiceSessionIgnoredEvents.at(-1)?.context?.reasonCode,
      );
      const latestVoiceLongSessionGate = voiceLongSessionGateEvents.at(-1);
      const latestVoiceLongSessionGatePass = toBooleanOrNull(
        latestVoiceLongSessionGate?.context?.cp4Pass,
      );
      const latestVoiceLongSessionFailedCheckSample = toStringOrNull(
        latestVoiceLongSessionGate?.context?.failedCheckSample,
      );
      const latestVoiceCheckpointGate = voiceCheckpointGateEvents.at(-1);
      const latestVoiceCheckpointGatePass = toBooleanOrNull(
        latestVoiceCheckpointGate?.context?.cp4CheckpointPass,
      );
      const latestVoiceCheckpointFailedCheckSample = toStringOrNull(
        latestVoiceCheckpointGate?.context?.failedCheckSample,
      );
      const latestVoiceReleaseReadinessGate = voiceReleaseReadinessGateEvents.at(-1);
      const latestVoiceReleaseReadinessGatePass = toBooleanOrNull(
        latestVoiceReleaseReadinessGate?.context?.cp4ReleaseReadinessPass,
      );
      const latestVoiceReleaseReadinessFailedCheckSample = toStringOrNull(
        latestVoiceReleaseReadinessGate?.context?.failedCheckSample,
      );
      const latestVoiceReleaseEvidenceGate = voiceReleaseEvidenceGateEvents.at(-1);
      const latestVoiceReleaseEvidenceGatePass = toBooleanOrNull(
        latestVoiceReleaseEvidenceGate?.context?.cp4ReleaseEvidencePass,
      );
      const latestVoiceReleaseEvidenceFailedCheckSample = toStringOrNull(
        latestVoiceReleaseEvidenceGate?.context?.failedCheckSample,
      );
      const latestVoiceCloseoutGate = voiceCloseoutGateEvents.at(-1);
      const latestVoiceCloseoutGatePass = toBooleanOrNull(
        latestVoiceCloseoutGate?.context?.closeoutPass,
      );
      const latestVoiceCloseoutGateFailedCheckSample = toStringOrNull(
        latestVoiceCloseoutGate?.context?.failedCheckSample,
      );
      const voiceNoteRecordingCompleteEvents = recent.filter((event) => (
        event.name === "messaging.voice_note.recording_complete"
      ));
      const voiceNoteRecordingUnsupportedEvents = recent.filter((event) => (
        event.name === "messaging.voice_note.recording_unsupported"
      ));
      const voiceNoteRecordingStartFailedEvents = recent.filter((event) => (
        event.name === "messaging.voice_note.recording_start_failed"
      ));
      const voiceNoteRecordingEmptyEvents = recent.filter((event) => (
        event.name === "messaging.voice_note.recording_empty"
      ));
      const voiceNoteRecordingCompleteCount = voiceNoteRecordingCompleteEvents.length;
      const voiceNoteRecordingUnsupportedCount = voiceNoteRecordingUnsupportedEvents.length;
      const voiceNoteRecordingStartFailedCount = voiceNoteRecordingStartFailedEvents.length;
      const voiceNoteRecordingEmptyCount = voiceNoteRecordingEmptyEvents.length;
      const latestVoiceNoteReasonCode = toStringOrNull(
        voiceNoteRecordingStartFailedEvents.at(-1)?.context?.reasonCode
        ?? voiceNoteRecordingUnsupportedEvents.at(-1)?.context?.reasonCode
        ?? voiceNoteRecordingEmptyEvents.at(-1)?.context?.reasonCode,
      );
      const deleteForEveryoneRequestedEvents = recent.filter((event) => (
        event.name === "messaging.delete_for_everyone_requested"
      ));
      const deleteForEveryoneRejectedEvents = recent.filter((event) => (
        event.name === "messaging.delete_for_everyone_rejected"
      ));
      const deleteForEveryoneLocalAppliedEvents = recent.filter((event) => (
        event.name === "messaging.delete_for_everyone_local_applied"
      ));
      const deleteForEveryoneRemoteResultEvents = recent.filter((event) => (
        event.name === "messaging.delete_for_everyone_remote_result"
      ));
      const deleteForEveryoneRequestedCount = deleteForEveryoneRequestedEvents.length;
      const deleteForEveryoneRejectedCount = deleteForEveryoneRejectedEvents.length;
      const deleteForEveryoneLocalAppliedCount = deleteForEveryoneLocalAppliedEvents.length;
      const deleteForEveryoneRemoteConfirmedCount = deleteForEveryoneRemoteResultEvents.filter((event) => (
        event.context?.resultCode === "confirmed" || event.context?.resultCode === "published"
      )).length;
      const deleteForEveryoneRemoteQueuedCount = deleteForEveryoneRemoteResultEvents.filter((event) => (
        event.context?.resultCode === "queued_retrying"
      )).length;
      const deleteForEveryoneRemoteFailedCount = deleteForEveryoneRemoteResultEvents.filter((event) => (
        event.context?.resultCode === "failed"
      )).length;
      const latestDeleteForEveryoneRemoteResult = deleteForEveryoneRemoteResultEvents.at(-1);
      const latestDeleteForEveryoneChannel = toStringOrNull(
        latestDeleteForEveryoneRemoteResult?.context?.channel,
      );
      const latestDeleteForEveryoneResultCode = toStringOrNull(
        latestDeleteForEveryoneRemoteResult?.context?.resultCode,
      );
      const latestDeleteForEveryoneReasonCode = toStringOrNull(
        latestDeleteForEveryoneRemoteResult?.context?.reasonCode
        ?? deleteForEveryoneRejectedEvents.at(-1)?.context?.reasonCode,
      );
      const criticalHydrationDriftCount = recent.filter((event) => (
        event.name === "messaging.conversation_hydration_diagnostics"
        && typeof event.context?.criticalDriftCount === "number"
        && event.context.criticalDriftCount > 0
      )).length;
      const dmAttachmentDropAcrossStages = (
        typeof latestHydratedDmAttachmentCount === "number"
        && typeof latestMergedDmAttachmentCount === "number"
        && latestMergedDmAttachmentCount < latestHydratedDmAttachmentCount
      ) || (
        typeof latestMergedDmAttachmentCount === "number"
        && typeof latestAppliedDmAttachmentCount === "number"
        && latestAppliedDmAttachmentCount < latestMergedDmAttachmentCount
      );
      const groupAttachmentDropAcrossStages = (
        typeof latestHydratedGroupAttachmentCount === "number"
        && typeof latestMergedGroupAttachmentCount === "number"
        && latestMergedGroupAttachmentCount < latestHydratedGroupAttachmentCount
      ) || (
        typeof latestMergedGroupAttachmentCount === "number"
        && typeof latestAppliedGroupAttachmentCount === "number"
        && latestAppliedGroupAttachmentCount < latestMergedGroupAttachmentCount
      );
      const selfAuthoredDmContinuityRiskLevel = getRiskLevel({
        watch: (
          sparseOutgoingEvidence === true
          || (
            latestHydratedOutgoingCount === 0
            && latestMergedOutgoingCount === 0
            && typeof latestMergedIncomingCount === "number"
            && latestMergedIncomingCount > 0
          )
        ),
        high: idSplitDetectedCount > 0,
      });
      const membershipSendabilityRiskLevel = getRiskLevel({
        watch: (
          roomKeyMissingSendBlockedCount > 0
          || (
          typeof latestVisibleGroupCount === "number"
          && typeof latestChatStateGroupCount === "number"
          && latestChatStateGroupCount < latestVisibleGroupCount
          )
        ),
        high: joinedMembershipRoomKeyMismatchCount > 0,
      });
      const accountSwitchScopeConvergenceRiskLevel = getRiskLevel({
        watch: autoUnlockScopeDriftDetectedCount > 0,
        high: (
          backupRestoreProfileScopeMismatchCount > 0
          || runtimeActivationProfileScopeMismatchCount > 0
        ),
      });
      const incomingRequestAntiAbuseRiskLevel = getRiskLevel({
        watch: incomingRequestQuarantinedCount > 0,
        high: (
          incomingRequestGlobalRateLimitedCount > 0
          || incomingRequestPeerCooldownActiveCount >= 5
        ),
      });
      const m10TrustControlsRiskLevel = getRiskLevel({
        watch: m10Cp2StabilityGateFailCount > 0,
        high: m10Cp2StabilityGateUnexpectedFailCount > 0,
      });
      const communityLifecycleConvergenceRiskLevel = getRiskLevel({
        watch: (
          membershipRecoveryRepairSignalCount > 0
          || (typeof latestMissingLedgerCoverageCount === "number" && latestMissingLedgerCoverageCount > 0)
        ),
        high: roomKeyMissingSendBlockedCount > 0 && membershipRecoveryRepairSignalCount > 0,
      });
      const mediaHydrationParityRiskLevel = getRiskLevel({
        watch: (
          dmAttachmentDropAcrossStages
          || groupAttachmentDropAcrossStages
          || criticalHydrationDriftCount > 0
        ),
        high: attachmentDropRegressionCount > 0,
      });
      const searchJumpNavigationRiskLevel = getRiskLevel({
        watch: searchJumpUnresolvedCount > 0,
        high: searchJumpDomUnresolvedCount > 0,
      });
      const uiResponsivenessRiskLevel = getRiskLevel({
        watch: (
          routeMountProbeSlowCount > 0
          || routeMountProbeSettledWarnCount > 0
          || pageTransitionWatchdogTimeoutCount > 0
          || startupProfileBootStallTimeoutCount > 0
        ),
        high: (
          routeStallHardFallbackCount > 0
          || pageTransitionEffectsDisabledCount > 0
        ),
      });
      const realtimeVoiceSessionRiskLevel = getRiskLevel({
        watch: (
          voiceSessionDegradedCount > 0
          || voiceSessionUnsupportedCount > 0
          || voiceSessionStaleIgnoredCount > 0
          || voiceLongSessionGateFailCount > 0
          || voiceCheckpointGateFailCount > 0
          || voiceReleaseReadinessGateFailCount > 0
          || voiceReleaseEvidenceGateFailCount > 0
          || voiceCloseoutGateFailCount > 0
        ),
        high: (
          voiceSessionRecoveryExhaustedCount > 0
          || voiceUnexpectedLongSessionGateFailCount > 0
          || voiceUnexpectedCheckpointGateFailCount > 0
          || voiceUnexpectedReleaseReadinessGateFailCount > 0
          || voiceUnexpectedReleaseEvidenceGateFailCount > 0
          || voiceUnexpectedCloseoutGateFailCount > 0
        ),
      });
      const asyncVoiceNoteRiskLevel = getRiskLevel({
        watch: (
          voiceNoteRecordingUnsupportedCount > 0
          || voiceNoteRecordingEmptyCount > 0
        ),
        high: voiceNoteRecordingStartFailedCount > 0,
      });
      const deleteConvergenceRiskLevel = getRiskLevel({
        watch: (
          deleteForEveryoneRemoteQueuedCount > 0
          || deleteForEveryoneRejectedCount > 0
        ),
        high: deleteForEveryoneRemoteFailedCount > 0,
      });
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
        summary: {
          selfAuthoredDmContinuity: {
            riskLevel: selfAuthoredDmContinuityRiskLevel,
            latestHydratedOutgoingCount,
            latestMergedOutgoingCount,
            sparseOutgoingEvidence,
            idSplitDetectedCount,
          },
          membershipSendability: {
            riskLevel: membershipSendabilityRiskLevel,
            latestVisibleGroupCount,
            latestChatStateGroupCount,
            roomKeyMissingSendBlockedCount,
            joinedMembershipRoomKeyMismatchCount,
            localProfileScopeRoomKeyMissingCount,
            noLocalRoomKeysCount,
            latestReasonCode: latestRoomKeyMissingSendBlockedReasonCode,
          },
          accountSwitchScopeConvergence: {
            riskLevel: accountSwitchScopeConvergenceRiskLevel,
            backupRestoreProfileScopeMismatchCount,
            runtimeActivationProfileScopeMismatchCount,
            autoUnlockScopeDriftDetectedCount,
            latestBackupRestoreReasonCode: latestBackupRestoreProfileScopeMismatchReasonCode,
            latestRuntimeActivationReasonCode: latestRuntimeActivationProfileScopeMismatchReasonCode,
            latestAutoUnlockReasonCode: latestAutoUnlockScopeDriftReasonCode,
          },
          incomingRequestAntiAbuse: {
            riskLevel: incomingRequestAntiAbuseRiskLevel,
            quarantinedCount: incomingRequestQuarantinedCount,
            peerRateLimitedCount: incomingRequestPeerRateLimitedCount,
            peerCooldownActiveCount: incomingRequestPeerCooldownActiveCount,
            globalRateLimitedCount: incomingRequestGlobalRateLimitedCount,
            uniquePeerPrefixCount: incomingRequestUniquePeerPrefixCount,
            latestReasonCode: latestIncomingRequestReasonCode,
            latestPeerPubkeyPrefix: latestIncomingRequestPeerPubkeyPrefix,
            latestCooldownRemainingMs: latestIncomingRequestCooldownRemainingMs,
          },
          m10TrustControls: {
            riskLevel: m10TrustControlsRiskLevel,
            cp2StabilityGateCount: m10Cp2StabilityGateCount,
            cp2StabilityGatePassCount: m10Cp2StabilityGatePassCount,
            cp2StabilityGateFailCount: m10Cp2StabilityGateFailCount,
            cp2StabilityGateUnexpectedFailCount: m10Cp2StabilityGateUnexpectedFailCount,
            latestExpectedStable: latestM10Cp2StabilityGateExpectedStable,
            latestPass: latestM10Cp2StabilityGatePass,
            latestFailedCheckSample: latestM10Cp2StabilityGateFailedCheckSample,
          },
          communityLifecycleConvergence: {
            riskLevel: communityLifecycleConvergenceRiskLevel,
            latestPersistedGroupCount,
            latestPersistedDuplicateMergeCount,
            latestHydratedFromPersistedWithLedgerCount,
            latestHydratedFromPersistedFallbackCount,
            latestHydratedFromLedgerOnlyCount,
            latestPlaceholderDisplayNameRecoveredCount,
            latestLocalMemberBackfillCount,
            latestMissingLedgerCoverageCount,
            latestHiddenByLedgerStatusCount,
            recoveryRepairSignalCount: membershipRecoveryRepairSignalCount,
          },
          mediaHydrationParity: {
            riskLevel: mediaHydrationParityRiskLevel,
            latestHydratedDmAttachmentCount,
            latestMergedDmAttachmentCount,
            latestAppliedDmAttachmentCount,
            latestHydratedGroupAttachmentCount,
            latestMergedGroupAttachmentCount,
            latestAppliedGroupAttachmentCount,
            attachmentDropRegressionCount,
            criticalHydrationDriftCount,
          },
          searchJumpNavigation: {
            riskLevel: searchJumpNavigationRiskLevel,
            requestedCount: searchJumpRequestedCount,
            resolvedCount: searchJumpResolvedCount,
            unresolvedCount: searchJumpUnresolvedCount,
            timestampFallbackResolvedCount: searchJumpTimestampFallbackResolvedCount,
            domUnresolvedCount: searchJumpDomUnresolvedCount,
            loadExhaustedUnresolvedCount: searchJumpLoadExhaustedUnresolvedCount,
            latestResolutionMode: latestSearchJumpResolutionMode,
            latestUnresolvedReasonCode: latestSearchJumpUnresolvedReasonCode,
          },
          uiResponsiveness: {
            riskLevel: uiResponsivenessRiskLevel,
            routeRequestCount,
            routeSettledCount,
            routeStallHardFallbackCount,
            routeMountProbeSlowCount,
            routeMountProbeSettledWarnCount,
            routeMountPerformanceGuardEnabledCount,
            pageTransitionWatchdogTimeoutCount,
            pageTransitionEffectsDisabledCount,
            startupProfileBootStallTimeoutCount,
            latestRouteSurface: latestUiRouteSurface,
            latestRouteStallElapsedMs,
            latestRouteMountProbeElapsedMs,
            latestPageTransitionWatchdogElapsedMs,
            latestStartupProfileBootPhase,
          },
          realtimeVoiceSession: {
            riskLevel: realtimeVoiceSessionRiskLevel,
            transitionCount: voiceSessionTransitionCount,
            degradedCount: voiceSessionDegradedCount,
            unsupportedCount: voiceSessionUnsupportedCount,
            recoveryExhaustedCount: voiceSessionRecoveryExhaustedCount,
            staleEventIgnoredCount: voiceSessionStaleIgnoredCount,
            longSessionGateCount: voiceLongSessionGateCount,
            longSessionGatePassCount: voiceLongSessionGatePassCount,
            longSessionGateFailCount: voiceLongSessionGateFailCount,
            unexpectedLongSessionGateFailCount: voiceUnexpectedLongSessionGateFailCount,
            checkpointGateCount: voiceCheckpointGateCount,
            checkpointGatePassCount: voiceCheckpointGatePassCount,
            checkpointGateFailCount: voiceCheckpointGateFailCount,
            unexpectedCheckpointGateFailCount: voiceUnexpectedCheckpointGateFailCount,
            releaseReadinessGateCount: voiceReleaseReadinessGateCount,
            releaseReadinessGatePassCount: voiceReleaseReadinessGatePassCount,
            releaseReadinessGateFailCount: voiceReleaseReadinessGateFailCount,
            unexpectedReleaseReadinessGateFailCount: voiceUnexpectedReleaseReadinessGateFailCount,
            releaseEvidenceGateCount: voiceReleaseEvidenceGateCount,
            releaseEvidenceGatePassCount: voiceReleaseEvidenceGatePassCount,
            releaseEvidenceGateFailCount: voiceReleaseEvidenceGateFailCount,
            unexpectedReleaseEvidenceGateFailCount: voiceUnexpectedReleaseEvidenceGateFailCount,
            closeoutGateCount: voiceCloseoutGateCount,
            closeoutGatePassCount: voiceCloseoutGatePassCount,
            closeoutGateFailCount: voiceCloseoutGateFailCount,
            unexpectedCloseoutGateFailCount: voiceUnexpectedCloseoutGateFailCount,
            latestToPhase: latestVoiceSessionToPhase,
            latestReasonCode: latestVoiceSessionReasonCode,
            latestIgnoredReasonCode: latestVoiceSessionIgnoredReasonCode,
            latestLongSessionGatePass: latestVoiceLongSessionGatePass,
            latestLongSessionGateFailedCheckSample: latestVoiceLongSessionFailedCheckSample,
            latestCheckpointGatePass: latestVoiceCheckpointGatePass,
            latestCheckpointGateFailedCheckSample: latestVoiceCheckpointFailedCheckSample,
            latestReleaseReadinessGatePass: latestVoiceReleaseReadinessGatePass,
            latestReleaseReadinessGateFailedCheckSample: latestVoiceReleaseReadinessFailedCheckSample,
            latestReleaseEvidenceGatePass: latestVoiceReleaseEvidenceGatePass,
            latestReleaseEvidenceGateFailedCheckSample: latestVoiceReleaseEvidenceFailedCheckSample,
            latestCloseoutGatePass: latestVoiceCloseoutGatePass,
            latestCloseoutGateFailedCheckSample: latestVoiceCloseoutGateFailedCheckSample,
          },
          asyncVoiceNote: {
            riskLevel: asyncVoiceNoteRiskLevel,
            recordingCompleteCount: voiceNoteRecordingCompleteCount,
            recordingUnsupportedCount: voiceNoteRecordingUnsupportedCount,
            recordingStartFailedCount: voiceNoteRecordingStartFailedCount,
            recordingEmptyCount: voiceNoteRecordingEmptyCount,
            latestReasonCode: latestVoiceNoteReasonCode,
          },
          deleteConvergence: {
            riskLevel: deleteConvergenceRiskLevel,
            requestedCount: deleteForEveryoneRequestedCount,
            localAppliedCount: deleteForEveryoneLocalAppliedCount,
            remoteConfirmedCount: deleteForEveryoneRemoteConfirmedCount,
            remoteQueuedCount: deleteForEveryoneRemoteQueuedCount,
            remoteFailedCount: deleteForEveryoneRemoteFailedCount,
            rejectedCount: deleteForEveryoneRejectedCount,
            latestChannel: latestDeleteForEveryoneChannel,
            latestResultCode: latestDeleteForEveryoneResultCode,
            latestReasonCode: latestDeleteForEveryoneReasonCode,
          },
        },
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
