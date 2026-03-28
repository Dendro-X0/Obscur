import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./dev-runtime-issue-reporter", () => ({
  reportDevRuntimeIssue: vi.fn(),
}));

import { logAppEvent } from "./log-app-event";
import { reportDevRuntimeIssue } from "./dev-runtime-issue-reporter";

describe("logAppEvent", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (globalThis as Record<string, unknown>).__obscur_log_hygiene_registry__ = new Map();
    (globalThis as Record<string, unknown>).__obscur_app_event_buffer__ = [];
    delete (globalThis as Record<string, unknown>).obscurAppEvents;
    vi.mocked(reportDevRuntimeIssue).mockClear();
  });

  it("rate-limits repeated warn events with the same name", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    for (let index = 0; index < 20; index += 1) {
      logAppEvent({
        name: "messaging.native_session.identity_mismatch_receive",
        level: "warn",
        context: { index },
      });
    }

    expect(warnSpy.mock.calls.length).toBeLessThan(20);
    expect(warnSpy.mock.calls.length).toBeGreaterThan(0);
  });

  it("rate-limits repeated info events with the same name", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    for (let index = 0; index < 100; index += 1) {
      logAppEvent({
        name: "messaging.transport.incoming_event_seen",
        level: "info",
        context: { index },
      });
    }

    expect(infoSpy.mock.calls.length).toBeLessThan(100);
    expect(infoSpy.mock.calls.length).toBeGreaterThan(0);
    expect(vi.mocked(reportDevRuntimeIssue)).not.toHaveBeenCalled();
  });

  it("escalates error events into the dev runtime issue feed", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.transport.publish_failed",
      level: "error",
      scope: { feature: "messaging", action: "send_dm" },
      context: { reasonCode: "quorum_not_met", message: "Publish quorum failed" },
    });

    expect(vi.mocked(reportDevRuntimeIssue)).toHaveBeenCalledWith(expect.objectContaining({
      domain: "messaging",
      operation: "send_dm",
      severity: "error",
      reasonCode: "quorum_not_met",
    }));
  });

  it("does not duplicate delivery troubleshooting events already handled by dedicated reporter", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.delivery.sender_delivery_failed",
      level: "error",
      scope: { feature: "messaging", action: "send_dm" },
      context: { reasonCode: "quorum_not_met" },
    });

    expect(vi.mocked(reportDevRuntimeIssue)).not.toHaveBeenCalled();
  });

  it("downgrades delivery-failed console emission to warn in non-production", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.delivery.sender_delivery_failed",
      level: "error",
      scope: { feature: "messaging", action: "send_dm" },
      context: { reasonCode: "relay_degraded" },
    });

    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("exposes recent app events through obscurAppEvents diagnostics API", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    logAppEvent({
      name: "runtime.activation.health_probe",
      level: "info",
      context: { probe: 1 },
    });
    logAppEvent({
      name: "runtime.activation.health_probe",
      level: "info",
      context: { probe: 2 },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getRecent: (count?: number) => ReadonlyArray<{ name: string; context?: Record<string, unknown> }>;
      findByName: (name: string, count?: number) => ReadonlyArray<{ name: string; context?: Record<string, unknown> }>;
      clear: () => void;
    };
    expect(diagnosticsApi).toBeTruthy();

    const recent = diagnosticsApi.getRecent(2);
    expect(recent).toHaveLength(2);
    expect(recent[0]?.name).toBe("runtime.activation.health_probe");
    expect(diagnosticsApi.findByName("runtime.activation.health_probe", 10)).toHaveLength(2);

    diagnosticsApi.clear();
    expect(diagnosticsApi.getRecent(10)).toHaveLength(0);
  });

  it("returns compact digest for long event streams", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    logAppEvent({
      name: "warmup.phase_transition",
      level: "error",
      context: {
        toPhase: "fatal",
        toReasonCode: "identity_resolution_timeout",
      },
    });
    logAppEvent({
      name: "warmup.rollout_gate_result",
      level: "error",
      context: {
        terminalPhase: "fatal",
        primaryReasonCode: "fatal_startup",
      },
    });
    logAppEvent({
      name: "messaging.conversation_hydration_diagnostics",
      level: "warn",
      context: { indexedOutgoingCount: 0 },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getDigest: (count?: number) => {
        total: number;
        windowSize: number;
        byLevel: Record<string, number>;
        topNames: Array<{ name: string; count: number }>;
        recentErrors: Array<{ name: string; reasonCode: string | null }>;
        warmUpSummary: Array<{ name: string; toPhase: string | null; reasonCode: string | null }>;
      };
    };
    const digest = diagnosticsApi.getDigest(50);
    expect(digest.total).toBeGreaterThanOrEqual(3);
    expect(digest.windowSize).toBeGreaterThanOrEqual(3);
    expect(digest.byLevel.error).toBeGreaterThanOrEqual(2);
    expect(digest.topNames.some((entry) => entry.name === "warmup.phase_transition")).toBe(true);
    expect(digest.recentErrors.some((entry) => entry.reasonCode === "identity_resolution_timeout")).toBe(true);
    expect(digest.warmUpSummary.some((entry) => entry.toPhase === "fatal")).toBe(true);
  });

  it("returns compact cross-device sync digest for repro sharing", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "account_sync.backup_restore_apply_diagnostics",
      level: "info",
      context: {
        publicKeySuffix: "abc12345",
        restorePath: "non_v1_domains",
        restoreChatStateDomains: true,
        appliedDmOutgoingCount: 0,
        appliedGroupConversationCount: 0,
        extraFieldShouldBeDropped: 99,
      },
    });
    logAppEvent({
      name: "account_sync.backup_payload_projection_fallback",
      level: "info",
      context: {
        profileId: "default",
        reasonNoOutgoingHistory: false,
        reasonSparseOutgoingEvidence: true,
        sparseOutgoingEvidenceThreshold: 5,
        outgoingCountBeforeFallback: 1,
        outgoingCountAfterFallback: 12,
        sourceRecordCount: 174,
        sourceOutgoingRecordCount: 1,
        sourceIncomingRecordCount: 173,
        extraFieldShouldBeDropped: 77,
      },
    });
    logAppEvent({
      name: "account_sync.backup_payload_hydration_diagnostics",
      level: "info",
      context: {
        publicKeySuffix: "abc12345",
        sourceRecordCount: 174,
        sourceOutgoingRecordCount: 1,
        sourceIncomingRecordCount: 173,
        hydratedDmMessageCount: 87,
        hydratedDmOutgoingCount: 1,
        hydratedDmIncomingCount: 86,
        hydratedDmIncomingOnlyConversationCount: 1,
        hydratedDmAttachmentCount: 12,
        hydratedGroupAttachmentCount: 4,
        extraFieldShouldBeDropped: 42,
      },
    });
    logAppEvent({
      name: "account_sync.backup_restore_merge_diagnostics",
      level: "info",
      context: {
        publicKeySuffix: "abc12345",
        mergedDmOutgoingCount: 0,
        mergedDmIncomingCount: 86,
        mergedDmAttachmentCount: 5,
        mergedGroupAttachmentCount: 1,
      },
    });
    logAppEvent({
      name: "account_sync.backup_restore_history_regression",
      level: "warn",
      context: {
        publicKeySuffix: "abc12345",
        stage: "incoming_to_merged",
        dmAttachmentDropped: true,
        groupAttachmentDropped: false,
        dmAttachmentDelta: -7,
        groupAttachmentDelta: 0,
        fromDmAttachmentCount: 12,
        toDmAttachmentCount: 5,
        fromGroupAttachmentCount: 4,
        toGroupAttachmentCount: 1,
      },
    });
    logAppEvent({
      name: "groups.membership_recovery_hydrate",
      level: "info",
      context: {
        publicKeySuffix: "abc12345",
        profileId: "default",
        persistedGroupCount: 2,
        persistedDuplicateMergeCount: 1,
        ledgerEntryCount: 2,
        visibleGroupCount: 1,
        hydratedFromPersistedWithLedgerCount: 1,
        hydratedFromPersistedFallbackCount: 0,
        hydratedFromLedgerOnlyCount: 0,
        placeholderDisplayNameRecoveredCount: 1,
        localMemberBackfillCount: 1,
        hiddenByTombstoneCount: 0,
        hiddenByLedgerStatusCount: 0,
        missingLedgerCoverageCount: 0,
      },
    });
    logAppEvent({
      name: "messaging.chat_state_groups_update",
      level: "info",
      context: {
        publicKeySuffix: "abc12345",
        profileId: "default",
        groupCount: 0,
      },
    });
    logAppEvent({
      name: "messaging.conversation_hydration_id_split_detected",
      level: "warn",
      context: {
        conversationIdHint: "conversation:abc",
        siblingOutgoingCount: 3,
      },
    });
    logAppEvent({
      name: "groups.room_key_missing_send_blocked",
      level: "warn",
      context: {
        groupIdHint: "group:abc",
        reasonCode: "target_room_key_missing_after_membership_joined",
        localRoomKeyCount: 1,
        hasTargetGroupRecord: false,
        activeProfileId: "profile-a",
        senderPubkeySuffix: "1234abcd",
        knownGroupHintSample: "group:one|group:two",
      },
    });
    logAppEvent({
      name: "messaging.request.incoming_quarantined",
      level: "warn",
      context: {
        reasonCode: "incoming_connection_request_peer_rate_limited",
        peerPubkeyPrefix: "aaaaaaaaaaaaaaaa",
        peerWindowCount: 4,
        globalWindowCount: 9,
        peerLimit: 3,
        globalLimit: 20,
        windowMs: 120000,
        peerCooldownMs: 120000,
        cooldownRemainingMs: 120000,
      },
    });
    logAppEvent({
      name: "messaging.request.incoming_quarantined",
      level: "warn",
      context: {
        reasonCode: "incoming_connection_request_peer_cooldown_active",
        peerPubkeyPrefix: "aaaaaaaaaaaaaaaa",
        peerWindowCount: 3,
        globalWindowCount: 9,
        peerLimit: 3,
        globalLimit: 20,
        windowMs: 120000,
        peerCooldownMs: 120000,
        cooldownRemainingMs: 60000,
      },
    });
    logAppEvent({
      name: "messaging.request.incoming_quarantined",
      level: "warn",
      context: {
        reasonCode: "incoming_connection_request_global_rate_limited",
        peerPubkeyPrefix: "bbbbbbbbbbbbbbbb",
        peerWindowCount: 2,
        globalWindowCount: 21,
        peerLimit: 3,
        globalLimit: 20,
        windowMs: 120000,
        peerCooldownMs: 120000,
        cooldownRemainingMs: null,
      },
    });
    logAppEvent({
      name: "account_sync.backup_restore_profile_scope_mismatch",
      level: "warn",
      context: {
        reasonCode: "requested_profile_not_active",
        publicKeySuffix: "abc12345",
        backupEventId: "backup-event-scope",
        requestedProfileId: "requested-profile",
        effectiveProfileId: "requested-profile",
        activeProfileIdAtRestoreStart: "bound-profile",
        activeProfileIdBeforeApply: "bound-profile",
        activeProfileIdAfterApply: "bound-profile",
        hasCanonicalAppender: false,
        extraFieldShouldBeDropped: 123,
      },
    });
    logAppEvent({
      name: "runtime.activation.profile_scope_mismatch",
      level: "warn",
      context: {
        reasonCode: "projection_profile_mismatch_bound_profile",
        runtimePhase: "activating_runtime",
        boundProfileId: "profile-a",
        projectionProfileId: "profile-b",
        identityPubkeySuffix: "1234abcd",
        projectionPubkeySuffix: "5678efab",
        accountSyncPubkeySuffix: "1234abcd",
        runtimeSessionPubkeySuffix: "1234abcd",
        accountProjectionPhase: "ready",
        accountSyncPhase: "ready",
        extraFieldShouldBeDropped: 321,
      },
    });
    logAppEvent({
      name: "runtime.activation.timeout",
      level: "warn",
      context: {
        projectionStatus: "ready",
        relayOpenCount: 1,
        relayTotalCount: 3,
        reasonCode: "relay_timeout",
      },
    });
    logAppEvent({
      name: "messaging.search_jump_requested",
      level: "info",
      context: {
        conversationIdHint: "conv:abc",
        targetMessageIdHint: "message:123",
      },
    });
    logAppEvent({
      name: "messaging.search_jump_resolved",
      level: "info",
      context: {
        resolutionMode: "timestamp_fallback",
        targetMessageIdHint: "message:123",
        resolvedMessageIdHint: "message:130",
      },
    });
    logAppEvent({
      name: "messaging.search_jump_unresolved",
      level: "warn",
      context: {
        reasonCode: "timestamp_fallback_dom_not_resolved",
        targetMessageIdHint: "message:123",
      },
    });
    logAppEvent({
      name: "messaging.realtime_voice.session_transition",
      level: "warn",
      context: {
        roomIdHint: "room:voice",
        mode: "join",
        fromPhase: "degraded",
        toPhase: "ended",
        reasonCode: "recovery_exhausted",
        participantCount: 1,
        hasPeerSessionEvidence: false,
        recoveryAttemptCount: 3,
        maxRecoveryAttempts: 3,
        isRecoverable: false,
      },
    });
    logAppEvent({
      name: "messaging.realtime_voice.long_session_gate",
      level: "warn",
      context: {
        cp4Pass: false,
        failedCheckCount: 2,
        failedCheckSample: "endedTransitionsZero|digestRecoveryExhaustedZero",
        cycleCount: 3,
        injectRecoveryExhausted: false,
        finalPhase: "ended",
        finalReasonCode: "recovery_exhausted",
        transitionEventCount: 11,
        degradedTransitionCount: 3,
        recoveredActiveTransitionCount: 2,
        endedTransitionCount: 1,
        digestRecoveryExhaustedCount: 1,
        digestRiskLevel: "high",
        replayReadinessReadyForCp2: false,
        extraFieldShouldBeDropped: "drop",
      },
    });
    logAppEvent({
      name: "messaging.voice_note.recording_unsupported",
      level: "warn",
      context: {
        reasonCode: "media_recorder_unavailable",
        isSecureContext: true,
        supportsMediaDevices: true,
        supportsMediaRecorder: false,
      },
    });
    logAppEvent({
      name: "messaging.voice_note.recording_start_failed",
      level: "warn",
      context: {
        reasonCode: "not_allowed_error",
        errorName: "NotAllowedError",
      },
    });
    logAppEvent({
      name: "messaging.voice_note.recording_complete",
      level: "info",
      context: {
        durationSeconds: 7,
        mimeType: "audio/webm",
        byteLength: 2048,
      },
    });
    logAppEvent({
      name: "messaging.delete_for_everyone_requested",
      level: "info",
      context: {
        conversationIdHint: "conv:abc",
        messageIdHint: "message:delete",
        conversationKind: "dm",
        isOutgoing: true,
      },
    });
    logAppEvent({
      name: "messaging.delete_for_everyone_local_applied",
      level: "info",
      context: {
        conversationIdHint: "conv:abc",
        messageIdHint: "message:delete",
        conversationKind: "dm",
        isOutgoing: true,
      },
    });
    logAppEvent({
      name: "messaging.delete_for_everyone_remote_result",
      level: "warn",
      context: {
        channel: "dm",
        resultCode: "queued_retrying",
        reasonCode: "dm_delete_command_queued_retrying",
        conversationIdHint: "conv:abc",
        messageIdHint: "message:delete",
      },
    });
    logAppEvent({
      name: "messaging.delete_for_everyone_remote_result",
      level: "warn",
      context: {
        channel: "group",
        resultCode: "failed",
        reasonCode: "group_publish_failed",
        conversationIdHint: "group:abc",
        messageIdHint: "message:group-delete",
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        totalBufferedEvents: number;
        windowSize: number;
        generatedAtUnixMs: number;
        events: Record<string, Array<{ context: Record<string, unknown> }>>;
        summary: {
          selfAuthoredDmContinuity: {
            riskLevel: "none" | "watch" | "high";
            latestHydratedOutgoingCount: number | null;
            latestMergedOutgoingCount: number | null;
            sparseOutgoingEvidence: boolean | null;
            idSplitDetectedCount: number;
          };
          membershipSendability: {
            riskLevel: "none" | "watch" | "high";
            latestVisibleGroupCount: number | null;
            latestChatStateGroupCount: number | null;
            roomKeyMissingSendBlockedCount: number;
            joinedMembershipRoomKeyMismatchCount: number;
            localProfileScopeRoomKeyMissingCount: number;
            noLocalRoomKeysCount: number;
            latestReasonCode: string | null;
          };
          accountSwitchScopeConvergence: {
            riskLevel: "none" | "watch" | "high";
            backupRestoreProfileScopeMismatchCount: number;
            runtimeActivationProfileScopeMismatchCount: number;
            autoUnlockScopeDriftDetectedCount: number;
            latestBackupRestoreReasonCode: string | null;
            latestRuntimeActivationReasonCode: string | null;
            latestAutoUnlockReasonCode: string | null;
          };
          incomingRequestAntiAbuse: {
            riskLevel: "none" | "watch" | "high";
            quarantinedCount: number;
            peerRateLimitedCount: number;
            peerCooldownActiveCount: number;
            globalRateLimitedCount: number;
            uniquePeerPrefixCount: number;
            latestReasonCode: string | null;
            latestPeerPubkeyPrefix: string | null;
            latestCooldownRemainingMs: number | null;
          };
          communityLifecycleConvergence: {
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
          };
          mediaHydrationParity: {
            riskLevel: "none" | "watch" | "high";
            latestHydratedDmAttachmentCount: number | null;
            latestMergedDmAttachmentCount: number | null;
            latestAppliedDmAttachmentCount: number | null;
            latestHydratedGroupAttachmentCount: number | null;
            latestMergedGroupAttachmentCount: number | null;
            latestAppliedGroupAttachmentCount: number | null;
            attachmentDropRegressionCount: number;
            criticalHydrationDriftCount: number;
          };
          searchJumpNavigation: {
            riskLevel: "none" | "watch" | "high";
            requestedCount: number;
            resolvedCount: number;
            unresolvedCount: number;
            timestampFallbackResolvedCount: number;
            domUnresolvedCount: number;
            loadExhaustedUnresolvedCount: number;
            latestResolutionMode: string | null;
            latestUnresolvedReasonCode: string | null;
          };
          realtimeVoiceSession: {
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
            latestToPhase: string | null;
            latestReasonCode: string | null;
            latestIgnoredReasonCode: string | null;
            latestLongSessionGatePass: boolean | null;
            latestLongSessionGateFailedCheckSample: string | null;
          };
          asyncVoiceNote: {
            riskLevel: "none" | "watch" | "high";
            recordingCompleteCount: number;
            recordingUnsupportedCount: number;
            recordingStartFailedCount: number;
            recordingEmptyCount: number;
            latestReasonCode: string | null;
          };
          deleteConvergence: {
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
          };
        };
        recentWarnOrError: Array<{ name: string; level: string; reasonCode: string | null }>;
      };
    };
    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);

    expect(digest.totalBufferedEvents).toBeGreaterThanOrEqual(3);
    expect(digest.windowSize).toBeGreaterThanOrEqual(3);
    expect(digest.generatedAtUnixMs).toBeGreaterThan(0);
    expect(digest.events["account_sync.backup_restore_apply_diagnostics"]).toHaveLength(1);
    expect(digest.events["account_sync.backup_restore_apply_diagnostics"]?.[0]?.context).toEqual(expect.objectContaining({
      publicKeySuffix: "abc12345",
      restorePath: "non_v1_domains",
      restoreChatStateDomains: true,
      appliedDmOutgoingCount: 0,
      appliedGroupConversationCount: 0,
    }));
    expect(digest.events["account_sync.backup_restore_apply_diagnostics"]?.[0]?.context).not.toHaveProperty("extraFieldShouldBeDropped");
    expect(digest.events["account_sync.backup_payload_projection_fallback"]?.[0]?.context).toEqual(expect.objectContaining({
      profileId: "default",
      reasonSparseOutgoingEvidence: true,
      outgoingCountBeforeFallback: 1,
      outgoingCountAfterFallback: 12,
      sourceRecordCount: 174,
      sourceOutgoingRecordCount: 1,
      sourceIncomingRecordCount: 173,
    }));
    expect(digest.events["account_sync.backup_payload_projection_fallback"]?.[0]?.context).not.toHaveProperty("extraFieldShouldBeDropped");
    expect(digest.events["account_sync.backup_payload_hydration_diagnostics"]?.[0]?.context).toEqual(expect.objectContaining({
      publicKeySuffix: "abc12345",
      sourceRecordCount: 174,
      sourceOutgoingRecordCount: 1,
      sourceIncomingRecordCount: 173,
      hydratedDmMessageCount: 87,
      hydratedDmOutgoingCount: 1,
      hydratedDmIncomingCount: 86,
      hydratedDmIncomingOnlyConversationCount: 1,
      hydratedDmAttachmentCount: 12,
      hydratedGroupAttachmentCount: 4,
    }));
    expect(digest.events["account_sync.backup_payload_hydration_diagnostics"]?.[0]?.context).not.toHaveProperty("extraFieldShouldBeDropped");
    expect(digest.events["account_sync.backup_restore_history_regression"]?.[0]?.context).toEqual(expect.objectContaining({
      stage: "incoming_to_merged",
      dmAttachmentDropped: true,
      dmAttachmentDelta: -7,
      fromDmAttachmentCount: 12,
      toDmAttachmentCount: 5,
    }));
    expect(digest.events["groups.membership_recovery_hydrate"]?.[0]?.context).toEqual(expect.objectContaining({
      persistedGroupCount: 2,
      persistedDuplicateMergeCount: 1,
      ledgerEntryCount: 2,
      visibleGroupCount: 1,
      hydratedFromPersistedWithLedgerCount: 1,
      hydratedFromPersistedFallbackCount: 0,
      hydratedFromLedgerOnlyCount: 0,
      placeholderDisplayNameRecoveredCount: 1,
      localMemberBackfillCount: 1,
      hiddenByTombstoneCount: 0,
      hiddenByLedgerStatusCount: 0,
      missingLedgerCoverageCount: 0,
    }));
    expect(digest.events["messaging.chat_state_groups_update"]?.[0]?.context).toEqual(expect.objectContaining({
      profileId: "default",
      groupCount: 0,
    }));
    expect(digest.events["groups.room_key_missing_send_blocked"]?.[0]?.context).toEqual(expect.objectContaining({
      groupIdHint: "group:abc",
      reasonCode: "target_room_key_missing_after_membership_joined",
      localRoomKeyCount: 1,
      hasTargetGroupRecord: false,
      activeProfileId: "profile-a",
    }));
    expect(digest.events["messaging.request.incoming_quarantined"]?.[0]?.context).toEqual(expect.objectContaining({
      reasonCode: "incoming_connection_request_peer_rate_limited",
      peerPubkeyPrefix: "aaaaaaaaaaaaaaaa",
      peerWindowCount: 4,
      globalWindowCount: 9,
      peerCooldownMs: 120000,
      cooldownRemainingMs: 120000,
    }));
    expect(digest.events["account_sync.backup_restore_profile_scope_mismatch"]?.[0]?.context).toEqual(expect.objectContaining({
      reasonCode: "requested_profile_not_active",
      publicKeySuffix: "abc12345",
      backupEventId: "backup-event-scope",
      requestedProfileId: "requested-profile",
      effectiveProfileId: "requested-profile",
      activeProfileIdBeforeApply: "bound-profile",
      hasCanonicalAppender: false,
    }));
    expect(digest.events["account_sync.backup_restore_profile_scope_mismatch"]?.[0]?.context).not.toHaveProperty("extraFieldShouldBeDropped");
    expect(digest.events["runtime.activation.profile_scope_mismatch"]?.[0]?.context).toEqual(expect.objectContaining({
      reasonCode: "projection_profile_mismatch_bound_profile",
      runtimePhase: "activating_runtime",
      boundProfileId: "profile-a",
      projectionProfileId: "profile-b",
      accountProjectionPhase: "ready",
      accountSyncPhase: "ready",
    }));
    expect(digest.events["runtime.activation.profile_scope_mismatch"]?.[0]?.context).not.toHaveProperty("extraFieldShouldBeDropped");
    expect(digest.summary.selfAuthoredDmContinuity).toEqual(expect.objectContaining({
      riskLevel: "high",
      latestHydratedOutgoingCount: 1,
      latestMergedOutgoingCount: 0,
      sparseOutgoingEvidence: true,
      idSplitDetectedCount: 1,
    }));
    expect(digest.summary.membershipSendability).toEqual(expect.objectContaining({
      riskLevel: "high",
      latestVisibleGroupCount: 1,
      latestChatStateGroupCount: 0,
      roomKeyMissingSendBlockedCount: 1,
      joinedMembershipRoomKeyMismatchCount: 1,
      localProfileScopeRoomKeyMissingCount: 0,
      noLocalRoomKeysCount: 0,
      latestReasonCode: "target_room_key_missing_after_membership_joined",
    }));
    expect(digest.summary.accountSwitchScopeConvergence).toEqual(expect.objectContaining({
      riskLevel: "high",
      backupRestoreProfileScopeMismatchCount: 1,
      runtimeActivationProfileScopeMismatchCount: 1,
      autoUnlockScopeDriftDetectedCount: 0,
      latestBackupRestoreReasonCode: "requested_profile_not_active",
      latestRuntimeActivationReasonCode: "projection_profile_mismatch_bound_profile",
      latestAutoUnlockReasonCode: null,
    }));
    expect(digest.summary.incomingRequestAntiAbuse).toEqual(expect.objectContaining({
      riskLevel: "high",
      quarantinedCount: 3,
      peerRateLimitedCount: 1,
      peerCooldownActiveCount: 1,
      globalRateLimitedCount: 1,
      uniquePeerPrefixCount: 2,
      latestReasonCode: "incoming_connection_request_global_rate_limited",
      latestPeerPubkeyPrefix: "bbbbbbbbbbbbbbbb",
      latestCooldownRemainingMs: null,
    }));
    expect(digest.summary.communityLifecycleConvergence).toEqual(expect.objectContaining({
      riskLevel: "high",
      latestPersistedGroupCount: 2,
      latestPersistedDuplicateMergeCount: 1,
      latestHydratedFromPersistedWithLedgerCount: 1,
      latestHydratedFromPersistedFallbackCount: 0,
      latestHydratedFromLedgerOnlyCount: 0,
      latestPlaceholderDisplayNameRecoveredCount: 1,
      latestLocalMemberBackfillCount: 1,
      latestMissingLedgerCoverageCount: 0,
      latestHiddenByLedgerStatusCount: 0,
      recoveryRepairSignalCount: 1,
    }));
    expect(digest.summary.mediaHydrationParity).toEqual(expect.objectContaining({
      riskLevel: "high",
      latestHydratedDmAttachmentCount: 12,
      latestMergedDmAttachmentCount: 5,
      latestAppliedDmAttachmentCount: null,
      latestHydratedGroupAttachmentCount: 4,
      latestMergedGroupAttachmentCount: 1,
      latestAppliedGroupAttachmentCount: null,
      attachmentDropRegressionCount: 1,
    }));
    expect(digest.summary.searchJumpNavigation).toEqual(expect.objectContaining({
      riskLevel: "high",
      requestedCount: 1,
      resolvedCount: 1,
      unresolvedCount: 1,
      timestampFallbackResolvedCount: 1,
      domUnresolvedCount: 1,
      loadExhaustedUnresolvedCount: 0,
      latestResolutionMode: "timestamp_fallback",
      latestUnresolvedReasonCode: "timestamp_fallback_dom_not_resolved",
    }));
    expect(digest.summary.realtimeVoiceSession).toEqual(expect.objectContaining({
      riskLevel: "high",
      transitionCount: 1,
      degradedCount: 0,
      unsupportedCount: 0,
      recoveryExhaustedCount: 1,
      staleEventIgnoredCount: 0,
      longSessionGateCount: 1,
      longSessionGatePassCount: 0,
      longSessionGateFailCount: 1,
      unexpectedLongSessionGateFailCount: 1,
      latestToPhase: "ended",
      latestReasonCode: "recovery_exhausted",
      latestIgnoredReasonCode: null,
      latestLongSessionGatePass: false,
      latestLongSessionGateFailedCheckSample: "endedTransitionsZero|digestRecoveryExhaustedZero",
    }));
    expect(digest.events["messaging.realtime_voice.long_session_gate"]?.[0]?.context).toEqual(expect.objectContaining({
      cp4Pass: false,
      failedCheckCount: 2,
      failedCheckSample: "endedTransitionsZero|digestRecoveryExhaustedZero",
      cycleCount: 3,
      injectRecoveryExhausted: false,
      finalPhase: "ended",
      finalReasonCode: "recovery_exhausted",
      transitionEventCount: 11,
      degradedTransitionCount: 3,
      recoveredActiveTransitionCount: 2,
      endedTransitionCount: 1,
      digestRecoveryExhaustedCount: 1,
      digestRiskLevel: "high",
      replayReadinessReadyForCp2: false,
    }));
    expect(digest.events["messaging.realtime_voice.long_session_gate"]?.[0]?.context).not.toHaveProperty("extraFieldShouldBeDropped");
    expect(digest.summary.asyncVoiceNote).toEqual(expect.objectContaining({
      riskLevel: "high",
      recordingCompleteCount: 1,
      recordingUnsupportedCount: 1,
      recordingStartFailedCount: 1,
      recordingEmptyCount: 0,
      latestReasonCode: "not_allowed_error",
    }));
    expect(digest.summary.deleteConvergence).toEqual(expect.objectContaining({
      riskLevel: "high",
      requestedCount: 1,
      localAppliedCount: 1,
      remoteConfirmedCount: 0,
      remoteQueuedCount: 1,
      remoteFailedCount: 1,
      rejectedCount: 0,
      latestChannel: "group",
      latestResultCode: "failed",
      latestReasonCode: "group_publish_failed",
    }));
    expect(digest.recentWarnOrError.some((entry) => (
      entry.name === "runtime.activation.timeout"
      && entry.level === "warn"
      && entry.reasonCode === "relay_timeout"
    ))).toBe(true);
  });

  it("marks media hydration parity as watch when attachment counts drop across hydrate->merge/apply without explicit regression event", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    logAppEvent({
      name: "account_sync.backup_payload_hydration_diagnostics",
      level: "info",
      context: {
        hydratedDmAttachmentCount: 10,
        hydratedGroupAttachmentCount: 3,
      },
    });
    logAppEvent({
      name: "account_sync.backup_restore_merge_diagnostics",
      level: "info",
      context: {
        mergedDmAttachmentCount: 7,
        mergedGroupAttachmentCount: 3,
      },
    });
    logAppEvent({
      name: "account_sync.backup_restore_apply_diagnostics",
      level: "info",
      context: {
        appliedDmAttachmentCount: 7,
        appliedGroupAttachmentCount: 2,
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        summary: {
          mediaHydrationParity: {
            riskLevel: "none" | "watch" | "high";
            latestHydratedDmAttachmentCount: number | null;
            latestMergedDmAttachmentCount: number | null;
            latestAppliedDmAttachmentCount: number | null;
            latestHydratedGroupAttachmentCount: number | null;
            latestMergedGroupAttachmentCount: number | null;
            latestAppliedGroupAttachmentCount: number | null;
            attachmentDropRegressionCount: number;
            criticalHydrationDriftCount: number;
          };
        };
      };
    };
    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.mediaHydrationParity).toEqual(expect.objectContaining({
      riskLevel: "watch",
      latestHydratedDmAttachmentCount: 10,
      latestMergedDmAttachmentCount: 7,
      latestAppliedDmAttachmentCount: 7,
      latestHydratedGroupAttachmentCount: 3,
      latestMergedGroupAttachmentCount: 3,
      latestAppliedGroupAttachmentCount: 2,
      attachmentDropRegressionCount: 0,
    }));
  });

  it("marks community lifecycle convergence as watch when recovery repair/missing-coverage signals are present without send blocks", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    logAppEvent({
      name: "groups.membership_recovery_hydrate",
      level: "info",
      context: {
        persistedGroupCount: 3,
        persistedDuplicateMergeCount: 1,
        ledgerEntryCount: 2,
        visibleGroupCount: 2,
        hydratedFromPersistedWithLedgerCount: 1,
        hydratedFromPersistedFallbackCount: 1,
        hydratedFromLedgerOnlyCount: 0,
        placeholderDisplayNameRecoveredCount: 1,
        localMemberBackfillCount: 0,
        hiddenByLedgerStatusCount: 0,
        missingLedgerCoverageCount: 1,
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        summary: {
          communityLifecycleConvergence: {
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
          };
        };
      };
    };
    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.communityLifecycleConvergence).toEqual(expect.objectContaining({
      riskLevel: "watch",
      latestPersistedGroupCount: 3,
      latestPersistedDuplicateMergeCount: 1,
      latestHydratedFromPersistedWithLedgerCount: 1,
      latestHydratedFromPersistedFallbackCount: 1,
      latestHydratedFromLedgerOnlyCount: 0,
      latestPlaceholderDisplayNameRecoveredCount: 1,
      latestLocalMemberBackfillCount: 0,
      latestMissingLedgerCoverageCount: 1,
      latestHiddenByLedgerStatusCount: 0,
      recoveryRepairSignalCount: 1,
    }));
  });

  it("marks community lifecycle convergence as none when no recovery-drift signal is present", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    logAppEvent({
      name: "groups.membership_recovery_hydrate",
      level: "info",
      context: {
        persistedGroupCount: 1,
        persistedDuplicateMergeCount: 0,
        ledgerEntryCount: 1,
        visibleGroupCount: 1,
        hydratedFromPersistedWithLedgerCount: 1,
        hydratedFromPersistedFallbackCount: 0,
        hydratedFromLedgerOnlyCount: 0,
        placeholderDisplayNameRecoveredCount: 0,
        localMemberBackfillCount: 0,
        hiddenByLedgerStatusCount: 0,
        missingLedgerCoverageCount: 0,
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        summary: {
          communityLifecycleConvergence: {
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
          };
        };
      };
    };
    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.communityLifecycleConvergence).toEqual(expect.objectContaining({
      riskLevel: "none",
      latestPersistedGroupCount: 1,
      latestPersistedDuplicateMergeCount: 0,
      latestHydratedFromPersistedWithLedgerCount: 1,
      latestHydratedFromPersistedFallbackCount: 0,
      latestHydratedFromLedgerOnlyCount: 0,
      latestPlaceholderDisplayNameRecoveredCount: 0,
      latestLocalMemberBackfillCount: 0,
      latestMissingLedgerCoverageCount: 0,
      latestHiddenByLedgerStatusCount: 0,
      recoveryRepairSignalCount: 0,
    }));
  });

  it("marks membership sendability as watch for non-joined room-key blocks and none after clear", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "groups.room_key_missing_send_blocked",
      level: "warn",
      context: {
        groupIdHint: "group:watch",
        reasonCode: "target_room_key_missing_local_profile_scope",
        localRoomKeyCount: 1,
        hasTargetGroupRecord: false,
        activeProfileId: "profile-watch",
      },
    });

    let diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        summary: {
          membershipSendability: {
            riskLevel: "none" | "watch" | "high";
            latestVisibleGroupCount: number | null;
            latestChatStateGroupCount: number | null;
            roomKeyMissingSendBlockedCount: number;
            joinedMembershipRoomKeyMismatchCount: number;
            localProfileScopeRoomKeyMissingCount: number;
            noLocalRoomKeysCount: number;
            latestReasonCode: string | null;
          };
        };
      };
      clear: () => void;
    };

    let digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.membershipSendability).toEqual(expect.objectContaining({
      riskLevel: "watch",
      roomKeyMissingSendBlockedCount: 1,
      joinedMembershipRoomKeyMismatchCount: 0,
      localProfileScopeRoomKeyMissingCount: 1,
      noLocalRoomKeysCount: 0,
      latestReasonCode: "target_room_key_missing_local_profile_scope",
    }));

    diagnosticsApi.clear();
    diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as typeof diagnosticsApi;
    digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.membershipSendability).toEqual(expect.objectContaining({
      riskLevel: "none",
      roomKeyMissingSendBlockedCount: 0,
      joinedMembershipRoomKeyMismatchCount: 0,
      localProfileScopeRoomKeyMissingCount: 0,
      noLocalRoomKeysCount: 0,
      latestReasonCode: null,
    }));
  });

  it("marks account-switch scope convergence as watch for auto-unlock drift and high for runtime/restore mismatches", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "auth.auto_unlock_scope_drift_detected",
      level: "warn",
      context: {
        reasonCode: "remember_token_profile_mismatch",
      },
    });

    let diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        summary: {
          accountSwitchScopeConvergence: {
            riskLevel: "none" | "watch" | "high";
            backupRestoreProfileScopeMismatchCount: number;
            runtimeActivationProfileScopeMismatchCount: number;
            autoUnlockScopeDriftDetectedCount: number;
            latestBackupRestoreReasonCode: string | null;
            latestRuntimeActivationReasonCode: string | null;
            latestAutoUnlockReasonCode: string | null;
          };
        };
      };
      clear: () => void;
    };

    let digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.accountSwitchScopeConvergence).toEqual(expect.objectContaining({
      riskLevel: "watch",
      backupRestoreProfileScopeMismatchCount: 0,
      runtimeActivationProfileScopeMismatchCount: 0,
      autoUnlockScopeDriftDetectedCount: 1,
      latestBackupRestoreReasonCode: null,
      latestRuntimeActivationReasonCode: null,
      latestAutoUnlockReasonCode: "remember_token_profile_mismatch",
    }));

    diagnosticsApi.clear();
    logAppEvent({
      name: "runtime.activation.profile_scope_mismatch",
      level: "warn",
      context: {
        reasonCode: "projection_public_key_mismatch",
      },
    });
    logAppEvent({
      name: "account_sync.backup_restore_profile_scope_mismatch",
      level: "warn",
      context: {
        reasonCode: "restore_profile_scope_drift_detected",
      },
    });

    diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as typeof diagnosticsApi;
    digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.accountSwitchScopeConvergence).toEqual(expect.objectContaining({
      riskLevel: "high",
      backupRestoreProfileScopeMismatchCount: 1,
      runtimeActivationProfileScopeMismatchCount: 1,
      autoUnlockScopeDriftDetectedCount: 0,
      latestBackupRestoreReasonCode: "restore_profile_scope_drift_detected",
      latestRuntimeActivationReasonCode: "projection_public_key_mismatch",
      latestAutoUnlockReasonCode: null,
    }));

    diagnosticsApi.clear();
    diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as typeof diagnosticsApi;
    digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.accountSwitchScopeConvergence).toEqual(expect.objectContaining({
      riskLevel: "none",
      backupRestoreProfileScopeMismatchCount: 0,
      runtimeActivationProfileScopeMismatchCount: 0,
      autoUnlockScopeDriftDetectedCount: 0,
      latestBackupRestoreReasonCode: null,
      latestRuntimeActivationReasonCode: null,
      latestAutoUnlockReasonCode: null,
    }));
  });

  it("marks media hydration parity as none when attachment counts are stable and no critical drift is observed", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    logAppEvent({
      name: "account_sync.backup_payload_hydration_diagnostics",
      level: "info",
      context: {
        hydratedDmAttachmentCount: 6,
        hydratedGroupAttachmentCount: 2,
      },
    });
    logAppEvent({
      name: "account_sync.backup_restore_merge_diagnostics",
      level: "info",
      context: {
        mergedDmAttachmentCount: 6,
        mergedGroupAttachmentCount: 2,
      },
    });
    logAppEvent({
      name: "account_sync.backup_restore_apply_diagnostics",
      level: "info",
      context: {
        appliedDmAttachmentCount: 6,
        appliedGroupAttachmentCount: 2,
      },
    });
    logAppEvent({
      name: "messaging.conversation_hydration_diagnostics",
      level: "info",
      context: {
        criticalDriftCount: 0,
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        summary: {
          mediaHydrationParity: {
            riskLevel: "none" | "watch" | "high";
            latestHydratedDmAttachmentCount: number | null;
            latestMergedDmAttachmentCount: number | null;
            latestAppliedDmAttachmentCount: number | null;
            latestHydratedGroupAttachmentCount: number | null;
            latestMergedGroupAttachmentCount: number | null;
            latestAppliedGroupAttachmentCount: number | null;
            attachmentDropRegressionCount: number;
            criticalHydrationDriftCount: number;
          };
        };
      };
    };
    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.mediaHydrationParity).toEqual(expect.objectContaining({
      riskLevel: "none",
      latestHydratedDmAttachmentCount: 6,
      latestMergedDmAttachmentCount: 6,
      latestAppliedDmAttachmentCount: 6,
      latestHydratedGroupAttachmentCount: 2,
      latestMergedGroupAttachmentCount: 2,
      latestAppliedGroupAttachmentCount: 2,
      attachmentDropRegressionCount: 0,
      criticalHydrationDriftCount: 0,
    }));
  });

  it("marks search-jump navigation as watch when unresolved load attempts are observed without dom drift", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.search_jump_requested",
      level: "info",
      context: {
        targetMessageIdHint: "message:watch",
      },
    });
    logAppEvent({
      name: "messaging.search_jump_unresolved",
      level: "warn",
      context: {
        reasonCode: "target_not_found_after_load_attempts",
        targetMessageIdHint: "message:watch",
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        summary: {
          searchJumpNavigation: {
            riskLevel: "none" | "watch" | "high";
            requestedCount: number;
            resolvedCount: number;
            unresolvedCount: number;
            timestampFallbackResolvedCount: number;
            domUnresolvedCount: number;
            loadExhaustedUnresolvedCount: number;
            latestResolutionMode: string | null;
            latestUnresolvedReasonCode: string | null;
          };
        };
      };
    };

    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.searchJumpNavigation).toEqual(expect.objectContaining({
      riskLevel: "watch",
      requestedCount: 1,
      resolvedCount: 0,
      unresolvedCount: 1,
      timestampFallbackResolvedCount: 0,
      domUnresolvedCount: 0,
      loadExhaustedUnresolvedCount: 1,
      latestResolutionMode: null,
      latestUnresolvedReasonCode: "target_not_found_after_load_attempts",
    }));
  });

  it("marks search-jump navigation as none when jumps resolve without unresolved evidence", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.search_jump_requested",
      level: "info",
      context: {
        targetMessageIdHint: "message:ok",
      },
    });
    logAppEvent({
      name: "messaging.search_jump_resolved",
      level: "info",
      context: {
        resolutionMode: "id",
        targetMessageIdHint: "message:ok",
        resolvedMessageIdHint: "message:ok",
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        summary: {
          searchJumpNavigation: {
            riskLevel: "none" | "watch" | "high";
            requestedCount: number;
            resolvedCount: number;
            unresolvedCount: number;
            timestampFallbackResolvedCount: number;
            domUnresolvedCount: number;
            loadExhaustedUnresolvedCount: number;
            latestResolutionMode: string | null;
            latestUnresolvedReasonCode: string | null;
          };
        };
      };
    };

    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.searchJumpNavigation).toEqual(expect.objectContaining({
      riskLevel: "none",
      requestedCount: 1,
      resolvedCount: 1,
      unresolvedCount: 0,
      timestampFallbackResolvedCount: 0,
      domUnresolvedCount: 0,
      loadExhaustedUnresolvedCount: 0,
      latestResolutionMode: "id",
      latestUnresolvedReasonCode: null,
    }));
  });

  it("marks incoming request anti-abuse summary as watch for peer-limited quarantines and none when no quarantines are present", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.request.incoming_quarantined",
      level: "warn",
      context: {
        reasonCode: "incoming_connection_request_peer_rate_limited",
        peerPubkeyPrefix: "cccccccccccccccc",
        peerWindowCount: 4,
        globalWindowCount: 8,
        peerLimit: 3,
        globalLimit: 20,
        windowMs: 120000,
        peerCooldownMs: 120000,
        cooldownRemainingMs: 120000,
      },
    });

    let diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        summary: {
          incomingRequestAntiAbuse: {
            riskLevel: "none" | "watch" | "high";
            quarantinedCount: number;
            peerRateLimitedCount: number;
            peerCooldownActiveCount: number;
            globalRateLimitedCount: number;
            uniquePeerPrefixCount: number;
            latestReasonCode: string | null;
            latestPeerPubkeyPrefix: string | null;
            latestCooldownRemainingMs: number | null;
          };
        };
      };
      clear: () => void;
    };
    let digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.incomingRequestAntiAbuse).toEqual(expect.objectContaining({
      riskLevel: "watch",
      quarantinedCount: 1,
      peerRateLimitedCount: 1,
      peerCooldownActiveCount: 0,
      globalRateLimitedCount: 0,
      uniquePeerPrefixCount: 1,
      latestReasonCode: "incoming_connection_request_peer_rate_limited",
      latestPeerPubkeyPrefix: "cccccccccccccccc",
      latestCooldownRemainingMs: 120000,
    }));

    diagnosticsApi.clear();
    diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as typeof diagnosticsApi;
    digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.incomingRequestAntiAbuse).toEqual(expect.objectContaining({
      riskLevel: "none",
      quarantinedCount: 0,
      peerRateLimitedCount: 0,
      peerCooldownActiveCount: 0,
      globalRateLimitedCount: 0,
      uniquePeerPrefixCount: 0,
      latestReasonCode: null,
      latestPeerPubkeyPrefix: null,
      latestCooldownRemainingMs: null,
    }));
  });

  it("marks realtime voice session summary as watch for degraded/unsupported and none when clean", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.realtime_voice.session_transition",
      level: "info",
      context: {
        toPhase: "connecting",
        reasonCode: "none",
      },
    });
    let diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        summary: {
          realtimeVoiceSession: {
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
            latestToPhase: string | null;
            latestReasonCode: string | null;
            latestIgnoredReasonCode: string | null;
            latestLongSessionGatePass: boolean | null;
            latestLongSessionGateFailedCheckSample: string | null;
          };
        };
      };
      clear: () => void;
    };
    let digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.realtimeVoiceSession).toEqual(expect.objectContaining({
      riskLevel: "none",
      transitionCount: 1,
      degradedCount: 0,
      unsupportedCount: 0,
      recoveryExhaustedCount: 0,
      staleEventIgnoredCount: 0,
      longSessionGateCount: 0,
      longSessionGatePassCount: 0,
      longSessionGateFailCount: 0,
      unexpectedLongSessionGateFailCount: 0,
      latestToPhase: "connecting",
      latestReasonCode: "none",
      latestIgnoredReasonCode: null,
      latestLongSessionGatePass: null,
      latestLongSessionGateFailedCheckSample: null,
    }));

    diagnosticsApi.clear();
    logAppEvent({
      name: "messaging.realtime_voice.session_transition",
      level: "warn",
      context: {
        toPhase: "degraded",
        reasonCode: "network_degraded",
      },
    });
    logAppEvent({
      name: "messaging.realtime_voice.session_transition",
      level: "warn",
      context: {
        toPhase: "unsupported",
        reasonCode: "webrtc_unavailable",
      },
    });
    diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as typeof diagnosticsApi;
    digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.realtimeVoiceSession).toEqual(expect.objectContaining({
      riskLevel: "watch",
      transitionCount: 2,
      degradedCount: 1,
      unsupportedCount: 1,
      recoveryExhaustedCount: 0,
      staleEventIgnoredCount: 0,
      longSessionGateCount: 0,
      longSessionGatePassCount: 0,
      longSessionGateFailCount: 0,
      unexpectedLongSessionGateFailCount: 0,
      latestToPhase: "unsupported",
      latestReasonCode: "webrtc_unavailable",
      latestIgnoredReasonCode: null,
      latestLongSessionGatePass: null,
      latestLongSessionGateFailedCheckSample: null,
    }));
  });

  it("marks realtime voice session summary as watch when stale events are ignored", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.realtime_voice.session_event_ignored",
      level: "info",
      context: {
        reasonCode: "stale_event",
        phase: "degraded",
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        summary: {
          realtimeVoiceSession: {
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
            latestToPhase: string | null;
            latestReasonCode: string | null;
            latestIgnoredReasonCode: string | null;
            latestLongSessionGatePass: boolean | null;
            latestLongSessionGateFailedCheckSample: string | null;
          };
        };
      };
    };
    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.realtimeVoiceSession).toEqual(expect.objectContaining({
      riskLevel: "watch",
      transitionCount: 0,
      degradedCount: 0,
      unsupportedCount: 0,
      recoveryExhaustedCount: 0,
      staleEventIgnoredCount: 1,
      longSessionGateCount: 0,
      longSessionGatePassCount: 0,
      longSessionGateFailCount: 0,
      unexpectedLongSessionGateFailCount: 0,
      latestToPhase: null,
      latestReasonCode: null,
      latestIgnoredReasonCode: "stale_event",
      latestLongSessionGatePass: null,
      latestLongSessionGateFailedCheckSample: null,
    }));
  });

  it("marks realtime voice session long-session gate failures as watch for injected failures and high for unexpected failures", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.realtime_voice.long_session_gate",
      level: "warn",
      context: {
        cp4Pass: false,
        failedCheckCount: 2,
        failedCheckSample: "endedTransitionsZero|digestRecoveryExhaustedZero",
        injectRecoveryExhausted: true,
      },
    });

    let diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        summary: {
          realtimeVoiceSession: {
            riskLevel: "none" | "watch" | "high";
            longSessionGateCount: number;
            longSessionGatePassCount: number;
            longSessionGateFailCount: number;
            unexpectedLongSessionGateFailCount: number;
            latestLongSessionGatePass: boolean | null;
            latestLongSessionGateFailedCheckSample: string | null;
          };
        };
      };
      clear: () => void;
    };
    let digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.realtimeVoiceSession).toEqual(expect.objectContaining({
      riskLevel: "watch",
      longSessionGateCount: 1,
      longSessionGatePassCount: 0,
      longSessionGateFailCount: 1,
      unexpectedLongSessionGateFailCount: 0,
      latestLongSessionGatePass: false,
      latestLongSessionGateFailedCheckSample: "endedTransitionsZero|digestRecoveryExhaustedZero",
    }));

    diagnosticsApi.clear();
    logAppEvent({
      name: "messaging.realtime_voice.long_session_gate",
      level: "warn",
      context: {
        cp4Pass: false,
        failedCheckCount: 1,
        failedCheckSample: "finalPhaseActive",
        injectRecoveryExhausted: false,
      },
    });
    diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as typeof diagnosticsApi;
    digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.realtimeVoiceSession).toEqual(expect.objectContaining({
      riskLevel: "high",
      longSessionGateCount: 1,
      longSessionGatePassCount: 0,
      longSessionGateFailCount: 1,
      unexpectedLongSessionGateFailCount: 1,
      latestLongSessionGatePass: false,
      latestLongSessionGateFailedCheckSample: "finalPhaseActive",
    }));
  });

  it("captures realtime voice long-session gate diagnostics in compact digest events", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.realtime_voice.long_session_gate",
      level: "warn",
      context: {
        cp4Pass: false,
        failedCheckCount: 1,
        failedCheckSample: "transitionVolumeSufficient",
        cycleCount: 4,
        injectRecoveryExhausted: false,
        finalPhase: "degraded",
        finalReasonCode: "network_degraded",
        transitionEventCount: 8,
        degradedTransitionCount: 4,
        recoveredActiveTransitionCount: 3,
        endedTransitionCount: 0,
        digestRecoveryExhaustedCount: 0,
        digestRiskLevel: "watch",
        replayReadinessReadyForCp2: true,
        extraFieldShouldBeDropped: "yes",
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        events: Record<string, Array<{ context: Record<string, unknown> }>>;
      };
    };
    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.events["messaging.realtime_voice.long_session_gate"]).toHaveLength(1);
    expect(digest.events["messaging.realtime_voice.long_session_gate"]?.[0]?.context).toEqual(expect.objectContaining({
      cp4Pass: false,
      failedCheckCount: 1,
      failedCheckSample: "transitionVolumeSufficient",
      cycleCount: 4,
      injectRecoveryExhausted: false,
      finalPhase: "degraded",
      finalReasonCode: "network_degraded",
      transitionEventCount: 8,
      degradedTransitionCount: 4,
      recoveredActiveTransitionCount: 3,
      endedTransitionCount: 0,
      digestRecoveryExhaustedCount: 0,
      digestRiskLevel: "watch",
      replayReadinessReadyForCp2: true,
    }));
    expect(digest.events["messaging.realtime_voice.long_session_gate"]?.[0]?.context).not.toHaveProperty("extraFieldShouldBeDropped");
  });

  it("marks realtime voice checkpoint gate failures as watch for expected failures and high for unexpected failures", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.realtime_voice.cp4_checkpoint_gate",
      level: "warn",
      context: {
        cp4CheckpointPass: false,
        expectedPass: false,
        failedCheckCount: 1,
        failedCheckSample: "longSessionGatePass",
      },
    });

    let diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        summary: {
          realtimeVoiceSession: {
            riskLevel: "none" | "watch" | "high";
            checkpointGateCount: number;
            checkpointGatePassCount: number;
            checkpointGateFailCount: number;
            unexpectedCheckpointGateFailCount: number;
            latestCheckpointGatePass: boolean | null;
            latestCheckpointGateFailedCheckSample: string | null;
          };
        };
      };
      clear: () => void;
    };
    let digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.realtimeVoiceSession).toEqual(expect.objectContaining({
      riskLevel: "watch",
      checkpointGateCount: 1,
      checkpointGatePassCount: 0,
      checkpointGateFailCount: 1,
      unexpectedCheckpointGateFailCount: 0,
      latestCheckpointGatePass: false,
      latestCheckpointGateFailedCheckSample: "longSessionGatePass",
    }));

    diagnosticsApi.clear();
    logAppEvent({
      name: "messaging.realtime_voice.cp4_checkpoint_gate",
      level: "warn",
      context: {
        cp4CheckpointPass: false,
        expectedPass: true,
        failedCheckCount: 1,
        failedCheckSample: "selfTestGatePass",
      },
    });
    diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as typeof diagnosticsApi;
    digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.realtimeVoiceSession).toEqual(expect.objectContaining({
      riskLevel: "high",
      checkpointGateCount: 1,
      checkpointGatePassCount: 0,
      checkpointGateFailCount: 1,
      unexpectedCheckpointGateFailCount: 1,
      latestCheckpointGatePass: false,
      latestCheckpointGateFailedCheckSample: "selfTestGatePass",
    }));
  });

  it("captures realtime voice checkpoint gate diagnostics in compact digest events", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.realtime_voice.cp4_checkpoint_gate",
      level: "warn",
      context: {
        cp4CheckpointPass: false,
        expectedPass: true,
        failedCheckCount: 2,
        failedCheckSample: "selfTestGatePass|digestRiskNotHigh",
        longSessionGatePass: true,
        gateProbePass: true,
        selfTestGatePass: false,
        digestRiskNotHigh: false,
        digestUnexpectedGateFailZero: true,
        digestRiskLevel: "high",
        digestUnexpectedLongSessionGateFailCount: 0,
        cycleCount: 6,
        injectRecoveryExhausted: false,
        extraFieldShouldBeDropped: "yes",
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        events: Record<string, Array<{ context: Record<string, unknown> }>>;
      };
    };
    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.events["messaging.realtime_voice.cp4_checkpoint_gate"]).toHaveLength(1);
    expect(digest.events["messaging.realtime_voice.cp4_checkpoint_gate"]?.[0]?.context).toEqual(expect.objectContaining({
      cp4CheckpointPass: false,
      expectedPass: true,
      failedCheckCount: 2,
      failedCheckSample: "selfTestGatePass|digestRiskNotHigh",
      longSessionGatePass: true,
      gateProbePass: true,
      selfTestGatePass: false,
      digestRiskNotHigh: false,
      digestUnexpectedGateFailZero: true,
      digestRiskLevel: "high",
      digestUnexpectedLongSessionGateFailCount: 0,
      cycleCount: 6,
      injectRecoveryExhausted: false,
    }));
    expect(digest.events["messaging.realtime_voice.cp4_checkpoint_gate"]?.[0]?.context).not.toHaveProperty("extraFieldShouldBeDropped");
  });

  it("marks realtime voice release-readiness gate failures as watch for expected failures and high for unexpected failures", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.realtime_voice.cp4_release_readiness_gate",
      level: "warn",
      context: {
        cp4ReleaseReadinessPass: false,
        expectedPass: false,
        failedCheckCount: 1,
        failedCheckSample: "checkpointGateMatchesExpected",
      },
    });

    let diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        summary: {
          realtimeVoiceSession: {
            riskLevel: "none" | "watch" | "high";
            releaseReadinessGateCount: number;
            releaseReadinessGatePassCount: number;
            releaseReadinessGateFailCount: number;
            unexpectedReleaseReadinessGateFailCount: number;
            latestReleaseReadinessGatePass: boolean | null;
            latestReleaseReadinessGateFailedCheckSample: string | null;
          };
        };
      };
      clear: () => void;
    };
    let digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.realtimeVoiceSession).toEqual(expect.objectContaining({
      riskLevel: "watch",
      releaseReadinessGateCount: 1,
      releaseReadinessGatePassCount: 0,
      releaseReadinessGateFailCount: 1,
      unexpectedReleaseReadinessGateFailCount: 0,
      latestReleaseReadinessGatePass: false,
      latestReleaseReadinessGateFailedCheckSample: "checkpointGateMatchesExpected",
    }));

    diagnosticsApi.clear();
    logAppEvent({
      name: "messaging.realtime_voice.cp4_release_readiness_gate",
      level: "warn",
      context: {
        cp4ReleaseReadinessPass: false,
        expectedPass: true,
        failedCheckCount: 1,
        failedCheckSample: "digestCheckpointGateCountObserved",
      },
    });
    diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as typeof diagnosticsApi;
    digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.realtimeVoiceSession).toEqual(expect.objectContaining({
      riskLevel: "high",
      releaseReadinessGateCount: 1,
      releaseReadinessGatePassCount: 0,
      releaseReadinessGateFailCount: 1,
      unexpectedReleaseReadinessGateFailCount: 1,
      latestReleaseReadinessGatePass: false,
      latestReleaseReadinessGateFailedCheckSample: "digestCheckpointGateCountObserved",
    }));
  });

  it("captures realtime voice release-readiness gate diagnostics in compact digest events", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.realtime_voice.cp4_release_readiness_gate",
      level: "warn",
      context: {
        cp4ReleaseReadinessPass: false,
        expectedPass: true,
        failedCheckCount: 2,
        failedCheckSample: "checkpointEventMatchesGatePass|digestLatestCheckpointAligned",
        checkpointGatePass: true,
        checkpointEventObserved: true,
        digestSummaryPresent: true,
        digestCheckpointGateCountObserved: false,
        digestLatestCheckpointAligned: false,
        digestUnexpectedCheckpointFailZeroWhenExpectedPass: true,
        digestRiskNotHighWhenExpectedPass: true,
        digestRiskLevel: "watch",
        digestCheckpointGateCount: 0,
        digestLatestCheckpointGatePass: true,
        digestUnexpectedCheckpointGateFailCount: 0,
        cycleCount: 6,
        injectRecoveryExhausted: false,
        extraFieldShouldBeDropped: "yes",
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        events: Record<string, Array<{ context: Record<string, unknown> }>>;
      };
    };
    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.events["messaging.realtime_voice.cp4_release_readiness_gate"]).toHaveLength(1);
    expect(digest.events["messaging.realtime_voice.cp4_release_readiness_gate"]?.[0]?.context).toEqual(expect.objectContaining({
      cp4ReleaseReadinessPass: false,
      expectedPass: true,
      failedCheckCount: 2,
      failedCheckSample: "checkpointEventMatchesGatePass|digestLatestCheckpointAligned",
      checkpointGatePass: true,
      checkpointEventObserved: true,
      digestSummaryPresent: true,
      digestCheckpointGateCountObserved: false,
      digestLatestCheckpointAligned: false,
      digestUnexpectedCheckpointFailZeroWhenExpectedPass: true,
      digestRiskNotHighWhenExpectedPass: true,
      digestRiskLevel: "watch",
      digestCheckpointGateCount: 0,
      digestLatestCheckpointGatePass: true,
      digestUnexpectedCheckpointGateFailCount: 0,
      cycleCount: 6,
      injectRecoveryExhausted: false,
    }));
    expect(digest.events["messaging.realtime_voice.cp4_release_readiness_gate"]?.[0]?.context).not.toHaveProperty("extraFieldShouldBeDropped");
  });

  it("marks realtime voice release-evidence gate failures as watch for expected failures and high for unexpected failures", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.realtime_voice.cp4_release_evidence_gate",
      level: "warn",
      context: {
        cp4ReleaseEvidencePass: false,
        expectedPass: false,
        failedCheckCount: 1,
        failedCheckSample: "releaseReadinessGateMatchesExpected",
      },
    });

    let diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        summary: {
          realtimeVoiceSession: {
            riskLevel: "none" | "watch" | "high";
            releaseEvidenceGateCount: number;
            releaseEvidenceGatePassCount: number;
            releaseEvidenceGateFailCount: number;
            unexpectedReleaseEvidenceGateFailCount: number;
            latestReleaseEvidenceGatePass: boolean | null;
            latestReleaseEvidenceGateFailedCheckSample: string | null;
          };
        };
      };
      clear: () => void;
    };
    let digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.realtimeVoiceSession).toEqual(expect.objectContaining({
      riskLevel: "watch",
      releaseEvidenceGateCount: 1,
      releaseEvidenceGatePassCount: 0,
      releaseEvidenceGateFailCount: 1,
      unexpectedReleaseEvidenceGateFailCount: 0,
      latestReleaseEvidenceGatePass: false,
      latestReleaseEvidenceGateFailedCheckSample: "releaseReadinessGateMatchesExpected",
    }));

    diagnosticsApi.clear();
    logAppEvent({
      name: "messaging.realtime_voice.cp4_release_evidence_gate",
      level: "warn",
      context: {
        cp4ReleaseEvidencePass: false,
        expectedPass: true,
        failedCheckCount: 1,
        failedCheckSample: "releaseReadinessEventObserved",
      },
    });
    diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as typeof diagnosticsApi;
    digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.realtimeVoiceSession).toEqual(expect.objectContaining({
      riskLevel: "high",
      releaseEvidenceGateCount: 1,
      releaseEvidenceGatePassCount: 0,
      releaseEvidenceGateFailCount: 1,
      unexpectedReleaseEvidenceGateFailCount: 1,
      latestReleaseEvidenceGatePass: false,
      latestReleaseEvidenceGateFailedCheckSample: "releaseReadinessEventObserved",
    }));
  });

  it("captures realtime voice release-evidence gate diagnostics in compact digest events", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.realtime_voice.cp4_release_evidence_gate",
      level: "warn",
      context: {
        cp4ReleaseEvidencePass: false,
        expectedPass: true,
        failedCheckCount: 2,
        failedCheckSample: "releaseReadinessEventObserved|digestSummaryPresent",
        releaseReadinessGatePass: true,
        longSessionEventObserved: true,
        checkpointEventObserved: true,
        releaseReadinessEventObserved: false,
        latestReleaseReadinessEventMatchesGate: false,
        digestSummaryPresent: true,
        digestRiskNotHighWhenExpectedPass: true,
        digestUnexpectedReleaseReadinessFailZeroWhenExpectedPass: true,
        digestRiskLevel: "watch",
        digestUnexpectedReleaseReadinessGateFailCount: 0,
        eventSliceLimit: 3,
        cycleCount: 6,
        injectRecoveryExhausted: false,
        extraFieldShouldBeDropped: "yes",
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        events: Record<string, Array<{ context: Record<string, unknown> }>>;
      };
    };
    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.events["messaging.realtime_voice.cp4_release_evidence_gate"]).toHaveLength(1);
    expect(digest.events["messaging.realtime_voice.cp4_release_evidence_gate"]?.[0]?.context).toEqual(expect.objectContaining({
      cp4ReleaseEvidencePass: false,
      expectedPass: true,
      failedCheckCount: 2,
      failedCheckSample: "releaseReadinessEventObserved|digestSummaryPresent",
      releaseReadinessGatePass: true,
      longSessionEventObserved: true,
      checkpointEventObserved: true,
      releaseReadinessEventObserved: false,
      latestReleaseReadinessEventMatchesGate: false,
      digestSummaryPresent: true,
      digestRiskNotHighWhenExpectedPass: true,
      digestUnexpectedReleaseReadinessFailZeroWhenExpectedPass: true,
      digestRiskLevel: "watch",
      digestUnexpectedReleaseReadinessGateFailCount: 0,
      eventSliceLimit: 3,
      cycleCount: 6,
      injectRecoveryExhausted: false,
    }));
    expect(digest.events["messaging.realtime_voice.cp4_release_evidence_gate"]?.[0]?.context).not.toHaveProperty("extraFieldShouldBeDropped");
  });

  it("marks realtime voice v1.2.0 closeout gate failures as watch for expected failures and high for unexpected failures", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.realtime_voice.v120_closeout_gate",
      level: "warn",
      context: {
        closeoutPass: false,
        expectedPass: false,
        failedCheckCount: 1,
        failedCheckSample: "cp4ReleaseEvidenceGateMatchesExpected",
      },
    });

    let diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        summary: {
          realtimeVoiceSession: {
            riskLevel: "none" | "watch" | "high";
            closeoutGateCount: number;
            closeoutGatePassCount: number;
            closeoutGateFailCount: number;
            unexpectedCloseoutGateFailCount: number;
            latestCloseoutGatePass: boolean | null;
            latestCloseoutGateFailedCheckSample: string | null;
          };
        };
      };
      clear: () => void;
    };
    let digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.realtimeVoiceSession).toEqual(expect.objectContaining({
      riskLevel: "watch",
      closeoutGateCount: 1,
      closeoutGatePassCount: 0,
      closeoutGateFailCount: 1,
      unexpectedCloseoutGateFailCount: 0,
      latestCloseoutGatePass: false,
      latestCloseoutGateFailedCheckSample: "cp4ReleaseEvidenceGateMatchesExpected",
    }));

    diagnosticsApi.clear();
    logAppEvent({
      name: "messaging.realtime_voice.v120_closeout_gate",
      level: "warn",
      context: {
        closeoutPass: false,
        expectedPass: true,
        failedCheckCount: 1,
        failedCheckSample: "digestSummaryPresent",
      },
    });
    diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as typeof diagnosticsApi;
    digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.realtimeVoiceSession).toEqual(expect.objectContaining({
      riskLevel: "high",
      closeoutGateCount: 1,
      closeoutGatePassCount: 0,
      closeoutGateFailCount: 1,
      unexpectedCloseoutGateFailCount: 1,
      latestCloseoutGatePass: false,
      latestCloseoutGateFailedCheckSample: "digestSummaryPresent",
    }));
  });

  it("captures realtime voice v1.2.0 closeout gate diagnostics in compact digest events", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.realtime_voice.v120_closeout_gate",
      level: "warn",
      context: {
        closeoutPass: false,
        expectedPass: true,
        failedCheckCount: 2,
        failedCheckSample: "cp3SuiteGatePass|digestSummaryPresent",
        cp3SuitePass: true,
        weakNetworkCp2Pass: true,
        accountSwitchCp2Pass: true,
        cp4ReleaseEvidencePass: false,
        cp4ReleaseReadinessPass: false,
        cp4CheckpointPass: false,
        weakDeleteRemoteFailureCount: 0,
        accountDeleteRemoteFailureCount: 0,
        longSessionDeleteRemoteFailureCount: 0,
        digestRiskLevel: "watch",
        digestUnexpectedReleaseEvidenceGateFailCount: 0,
        eventSliceLimit: 3,
        extraFieldShouldBeDropped: "yes",
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        events: Record<string, Array<{ context: Record<string, unknown> }>>;
      };
    };
    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.events["messaging.realtime_voice.v120_closeout_gate"]).toHaveLength(1);
    expect(digest.events["messaging.realtime_voice.v120_closeout_gate"]?.[0]?.context).toEqual(expect.objectContaining({
      closeoutPass: false,
      expectedPass: true,
      failedCheckCount: 2,
      failedCheckSample: "cp3SuiteGatePass|digestSummaryPresent",
      cp3SuitePass: true,
      weakNetworkCp2Pass: true,
      accountSwitchCp2Pass: true,
      cp4ReleaseEvidencePass: false,
      cp4ReleaseReadinessPass: false,
      cp4CheckpointPass: false,
      weakDeleteRemoteFailureCount: 0,
      accountDeleteRemoteFailureCount: 0,
      longSessionDeleteRemoteFailureCount: 0,
      digestRiskLevel: "watch",
      digestUnexpectedReleaseEvidenceGateFailCount: 0,
      eventSliceLimit: 3,
    }));
    expect(digest.events["messaging.realtime_voice.v120_closeout_gate"]?.[0]?.context).not.toHaveProperty("extraFieldShouldBeDropped");
  });

  it("captures realtime voice ignored-event diagnostics in compact digest events", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.realtime_voice.session_event_ignored",
      level: "info",
      context: {
        reasonCode: "stale_event",
        roomIdHint: "room:ignored",
        phase: "degraded",
        mode: "join",
        eventUnixMs: 2400,
        lastTransitionAtUnixMs: 2500,
        extraFieldShouldBeDropped: "yes",
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        events: Record<string, Array<{ context: Record<string, unknown> }>>;
      };
    };
    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.events["messaging.realtime_voice.session_event_ignored"]).toHaveLength(1);
    expect(digest.events["messaging.realtime_voice.session_event_ignored"]?.[0]?.context).toEqual(expect.objectContaining({
      reasonCode: "stale_event",
      roomIdHint: "room:ignored",
      phase: "degraded",
      mode: "join",
      eventUnixMs: 2400,
      lastTransitionAtUnixMs: 2500,
    }));
    expect(digest.events["messaging.realtime_voice.session_event_ignored"]?.[0]?.context).not.toHaveProperty("extraFieldShouldBeDropped");
  });

  it("marks realtime voice session summary as watch when connect-timeout diagnostics are present", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.realtime_voice.connect_timeout_diagnostics",
      level: "warn",
      context: {
        roomIdHint: "room:timeout",
        openRelayCount: 0,
        rtcConnectionState: "connecting",
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        summary: {
          realtimeVoiceSession: {
            riskLevel: "none" | "watch" | "high";
            connectTimeoutDiagnosticsCount: number;
            connectTimeoutNoOpenRelayCount: number;
            latestConnectTimeoutRtcConnectionState: string | null;
            latestConnectTimeoutOpenRelayCount: number | null;
          };
        };
      };
    };
    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.realtimeVoiceSession).toEqual(expect.objectContaining({
      riskLevel: "watch",
      connectTimeoutDiagnosticsCount: 1,
      connectTimeoutNoOpenRelayCount: 1,
      latestConnectTimeoutRtcConnectionState: "connecting",
      latestConnectTimeoutOpenRelayCount: 0,
    }));
  });

  it("captures realtime voice connect-timeout diagnostics in compact digest events", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.realtime_voice.connect_timeout_diagnostics",
      level: "warn",
      context: {
        roomIdHint: "room:timeout",
        peerPubkeySuffix: "deadbeef",
        role: "joiner",
        phase: "connecting",
        openRelayCount: 1,
        configuredRelayCount: 2,
        joinRequestRetryAttempts: 2,
        offerRetryAttempts: 0,
        hasActiveSession: true,
        activeSessionRole: "joiner",
        rtcConnectionState: "connecting",
        hasLocalDescription: true,
        hasRemoteDescription: false,
        extraFieldShouldBeDropped: "yes",
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        events: Record<string, Array<{ context: Record<string, unknown> }>>;
      };
    };
    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.events["messaging.realtime_voice.connect_timeout_diagnostics"]).toHaveLength(1);
    expect(digest.events["messaging.realtime_voice.connect_timeout_diagnostics"]?.[0]?.context).toEqual(expect.objectContaining({
      roomIdHint: "room:timeout",
      peerPubkeySuffix: "deadbeef",
      role: "joiner",
      phase: "connecting",
      openRelayCount: 1,
      configuredRelayCount: 2,
      joinRequestRetryAttempts: 2,
      offerRetryAttempts: 0,
      hasActiveSession: true,
      activeSessionRole: "joiner",
      rtcConnectionState: "connecting",
      hasLocalDescription: true,
      hasRemoteDescription: false,
    }));
    expect(digest.events["messaging.realtime_voice.connect_timeout_diagnostics"]?.[0]?.context).not.toHaveProperty("extraFieldShouldBeDropped");
  });

  it("captures realtime voice connecting-watchdog gate diagnostics in compact digest events", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.realtime_voice.connecting_watchdog_gate",
      level: "warn",
      context: {
        watchdogPass: false,
        expectedNoOpenRelay: true,
        failedCheckCount: 2,
        failedCheckSample: "noOpenRelayEvidenceObserved|latestTimeoutOpenRelayAligned",
        connectTimeoutEventCount: 1,
        digestConnectTimeoutDiagnosticsCount: 1,
        digestConnectTimeoutNoOpenRelayCount: 0,
        latestTimeoutOpenRelayCount: 1,
        latestTimeoutRtcConnectionState: "new",
        latestEventOpenRelayCount: 0,
        latestEventRtcConnectionState: "connecting",
        extraFieldShouldBeDropped: "yes",
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        events: Record<string, Array<{ context: Record<string, unknown> }>>;
      };
    };
    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.events["messaging.realtime_voice.connecting_watchdog_gate"]).toHaveLength(1);
    expect(digest.events["messaging.realtime_voice.connecting_watchdog_gate"]?.[0]?.context).toEqual(expect.objectContaining({
      watchdogPass: false,
      expectedNoOpenRelay: true,
      failedCheckCount: 2,
      failedCheckSample: "noOpenRelayEvidenceObserved|latestTimeoutOpenRelayAligned",
      connectTimeoutEventCount: 1,
      digestConnectTimeoutDiagnosticsCount: 1,
      digestConnectTimeoutNoOpenRelayCount: 0,
      latestTimeoutOpenRelayCount: 1,
      latestTimeoutRtcConnectionState: "new",
      latestEventOpenRelayCount: 0,
      latestEventRtcConnectionState: "connecting",
    }));
    expect(digest.events["messaging.realtime_voice.connecting_watchdog_gate"]?.[0]?.context).not.toHaveProperty("extraFieldShouldBeDropped");
  });

  it("tracks realtime voice connecting-watchdog gate summary counters", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.realtime_voice.connecting_watchdog_gate",
      level: "warn",
      context: {
        watchdogPass: false,
        expectedNoOpenRelay: true,
        failedCheckSample: "noOpenRelayEvidenceObserved",
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        summary: {
          realtimeVoiceSession: {
            riskLevel: "none" | "watch" | "high";
            connectingWatchdogGateCount: number;
            connectingWatchdogGatePassCount: number;
            connectingWatchdogGateFailCount: number;
            unexpectedConnectingWatchdogGateFailCount: number;
            latestConnectingWatchdogGatePass: boolean | null;
            latestConnectingWatchdogGateFailedCheckSample: string | null;
          };
        };
      };
    };
    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.realtimeVoiceSession).toEqual(expect.objectContaining({
      riskLevel: "high",
      connectingWatchdogGateCount: 1,
      connectingWatchdogGatePassCount: 0,
      connectingWatchdogGateFailCount: 1,
      unexpectedConnectingWatchdogGateFailCount: 1,
      latestConnectingWatchdogGatePass: false,
      latestConnectingWatchdogGateFailedCheckSample: "noOpenRelayEvidenceObserved",
    }));
  });

  it("captures realtime voice connecting-watchdog self-test diagnostics in compact digest events", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.realtime_voice.connecting_watchdog_self_test",
      level: "warn",
      context: {
        selfTestPass: false,
        failedCheckCount: 1,
        failedCheckSample: "failureRejected",
        nominalPass: true,
        nominalNoOpenRelayEvidenceObserved: true,
        failureRejected: false,
        failureFlagsNoOpenRelayEvidence: false,
        timeoutEventsObservedInBothScenarios: true,
        nominalWatchdogGatePass: true,
        failureWatchdogGatePass: true,
        extraFieldShouldBeDropped: "yes",
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        events: Record<string, Array<{ context: Record<string, unknown> }>>;
      };
    };
    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.events["messaging.realtime_voice.connecting_watchdog_self_test"]).toHaveLength(1);
    expect(digest.events["messaging.realtime_voice.connecting_watchdog_self_test"]?.[0]?.context).toEqual(expect.objectContaining({
      selfTestPass: false,
      failedCheckCount: 1,
      failedCheckSample: "failureRejected",
      nominalPass: true,
      nominalNoOpenRelayEvidenceObserved: true,
      failureRejected: false,
      failureFlagsNoOpenRelayEvidence: false,
      timeoutEventsObservedInBothScenarios: true,
      nominalWatchdogGatePass: true,
      failureWatchdogGatePass: true,
    }));
    expect(digest.events["messaging.realtime_voice.connecting_watchdog_self_test"]?.[0]?.context).not.toHaveProperty("extraFieldShouldBeDropped");
  });

  it("tracks realtime voice connecting-watchdog self-test summary counters", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.realtime_voice.connecting_watchdog_self_test",
      level: "warn",
      context: {
        selfTestPass: false,
        failedCheckSample: "failureRejected",
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        summary: {
          realtimeVoiceSession: {
            riskLevel: "none" | "watch" | "high";
            connectingWatchdogSelfTestCount: number;
            connectingWatchdogSelfTestPassCount: number;
            connectingWatchdogSelfTestFailCount: number;
            unexpectedConnectingWatchdogSelfTestFailCount: number;
            latestConnectingWatchdogSelfTestPass: boolean | null;
            latestConnectingWatchdogSelfTestFailedCheckSample: string | null;
          };
        };
      };
    };
    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.realtimeVoiceSession).toEqual(expect.objectContaining({
      riskLevel: "high",
      connectingWatchdogSelfTestCount: 1,
      connectingWatchdogSelfTestPassCount: 0,
      connectingWatchdogSelfTestFailCount: 1,
      unexpectedConnectingWatchdogSelfTestFailCount: 1,
      latestConnectingWatchdogSelfTestPass: false,
      latestConnectingWatchdogSelfTestFailedCheckSample: "failureRejected",
    }));
  });

  it("captures realtime voice connecting-watchdog incident-bundle diagnostics in compact digest events", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.realtime_voice.connecting_watchdog_incident_bundle",
      level: "warn",
      context: {
        incidentPass: false,
        failedCheckCount: 2,
        failedCheckSample: "selfTestPass|captureAndSelfTestAligned",
        watchdogCapturePass: true,
        selfTestPass: false,
        captureAndSelfTestAligned: false,
        connectTimeoutEventsObserved: true,
        selfTestTimeoutEvidenceObserved: true,
        m0TriageCapturedWhenRequested: true,
        expectedNoOpenRelay: true,
        includeM0Triage: true,
        extraFieldShouldBeDropped: "yes",
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        events: Record<string, Array<{ context: Record<string, unknown> }>>;
      };
    };
    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.events["messaging.realtime_voice.connecting_watchdog_incident_bundle"]).toHaveLength(1);
    expect(digest.events["messaging.realtime_voice.connecting_watchdog_incident_bundle"]?.[0]?.context).toEqual(expect.objectContaining({
      incidentPass: false,
      failedCheckCount: 2,
      failedCheckSample: "selfTestPass|captureAndSelfTestAligned",
      watchdogCapturePass: true,
      selfTestPass: false,
      captureAndSelfTestAligned: false,
      connectTimeoutEventsObserved: true,
      selfTestTimeoutEvidenceObserved: true,
      m0TriageCapturedWhenRequested: true,
      expectedNoOpenRelay: true,
      includeM0Triage: true,
    }));
    expect(digest.events["messaging.realtime_voice.connecting_watchdog_incident_bundle"]?.[0]?.context).not.toHaveProperty("extraFieldShouldBeDropped");
  });

  it("tracks realtime voice connecting-watchdog incident-bundle summary counters", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.realtime_voice.connecting_watchdog_incident_bundle",
      level: "warn",
      context: {
        incidentPass: false,
        failedCheckSample: "selfTestPass",
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        summary: {
          realtimeVoiceSession: {
            riskLevel: "none" | "watch" | "high";
            connectingWatchdogIncidentBundleCount: number;
            connectingWatchdogIncidentBundlePassCount: number;
            connectingWatchdogIncidentBundleFailCount: number;
            unexpectedConnectingWatchdogIncidentBundleFailCount: number;
            latestConnectingWatchdogIncidentBundlePass: boolean | null;
            latestConnectingWatchdogIncidentBundleFailedCheckSample: string | null;
          };
        };
      };
    };
    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.realtimeVoiceSession).toEqual(expect.objectContaining({
      riskLevel: "high",
      connectingWatchdogIncidentBundleCount: 1,
      connectingWatchdogIncidentBundlePassCount: 0,
      connectingWatchdogIncidentBundleFailCount: 1,
      unexpectedConnectingWatchdogIncidentBundleFailCount: 1,
      latestConnectingWatchdogIncidentBundlePass: false,
      latestConnectingWatchdogIncidentBundleFailedCheckSample: "selfTestPass",
    }));
  });

  it("captures realtime voice connecting-watchdog incident-gate diagnostics in compact digest events", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.realtime_voice.connecting_watchdog_incident_gate",
      level: "warn",
      context: {
        incidentGatePass: false,
        failedCheckCount: 2,
        failedCheckSample: "selfTestPass|captureAndSelfTestAligned",
        watchdogCapturePass: true,
        selfTestPass: false,
        captureAndSelfTestAligned: false,
        connectTimeoutEventsObserved: true,
        selfTestTimeoutEvidenceObserved: true,
        m0TriageCapturedWhenRequested: true,
        expectedNoOpenRelay: true,
        includeM0Triage: true,
        extraFieldShouldBeDropped: "yes",
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        events: Record<string, Array<{ context: Record<string, unknown> }>>;
      };
    };
    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.events["messaging.realtime_voice.connecting_watchdog_incident_gate"]).toHaveLength(1);
    expect(digest.events["messaging.realtime_voice.connecting_watchdog_incident_gate"]?.[0]?.context).toEqual(expect.objectContaining({
      incidentGatePass: false,
      failedCheckCount: 2,
      failedCheckSample: "selfTestPass|captureAndSelfTestAligned",
      watchdogCapturePass: true,
      selfTestPass: false,
      captureAndSelfTestAligned: false,
      connectTimeoutEventsObserved: true,
      selfTestTimeoutEvidenceObserved: true,
      m0TriageCapturedWhenRequested: true,
      expectedNoOpenRelay: true,
      includeM0Triage: true,
    }));
    expect(digest.events["messaging.realtime_voice.connecting_watchdog_incident_gate"]?.[0]?.context).not.toHaveProperty("extraFieldShouldBeDropped");
  });

  it("tracks realtime voice connecting-watchdog incident-gate summary counters", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.realtime_voice.connecting_watchdog_incident_gate",
      level: "warn",
      context: {
        incidentGatePass: false,
        failedCheckSample: "selfTestPass",
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        summary: {
          realtimeVoiceSession: {
            riskLevel: "none" | "watch" | "high";
            connectingWatchdogIncidentGateCount: number;
            connectingWatchdogIncidentGatePassCount: number;
            connectingWatchdogIncidentGateFailCount: number;
            unexpectedConnectingWatchdogIncidentGateFailCount: number;
            latestConnectingWatchdogIncidentGatePass: boolean | null;
            latestConnectingWatchdogIncidentGateFailedCheckSample: string | null;
          };
        };
      };
    };
    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.realtimeVoiceSession).toEqual(expect.objectContaining({
      riskLevel: "high",
      connectingWatchdogIncidentGateCount: 1,
      connectingWatchdogIncidentGatePassCount: 0,
      connectingWatchdogIncidentGateFailCount: 1,
      unexpectedConnectingWatchdogIncidentGateFailCount: 1,
      latestConnectingWatchdogIncidentGatePass: false,
      latestConnectingWatchdogIncidentGateFailedCheckSample: "selfTestPass",
    }));
  });

  it("captures realtime voice connecting-watchdog incident-gate-evidence diagnostics in compact digest events", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.realtime_voice.connecting_watchdog_incident_gate_evidence",
      level: "warn",
      context: {
        expectedPass: true,
        incidentGateEvidencePass: false,
        failedCheckCount: 2,
        failedCheckSample: "incidentGateMatchesExpected|digestRiskNotHighWhenExpectedPass",
        incidentGatePass: false,
        incidentGateMatchesExpected: false,
        incidentGateEventObserved: true,
        latestIncidentGateEventMatchesGate: true,
        digestSummaryPresent: true,
        digestIncidentGateCountObserved: true,
        digestLatestIncidentGateAligned: true,
        digestUnexpectedIncidentGateFailZeroWhenExpectedPass: false,
        digestRiskNotHighWhenExpectedPass: false,
        incidentGateEventCount: 1,
        expectedNoOpenRelay: true,
        m0TriageCapturedWhenRequested: true,
        extraFieldShouldBeDropped: "yes",
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        events: Record<string, Array<{ context: Record<string, unknown> }>>;
      };
    };
    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.events["messaging.realtime_voice.connecting_watchdog_incident_gate_evidence"]).toHaveLength(1);
    expect(digest.events["messaging.realtime_voice.connecting_watchdog_incident_gate_evidence"]?.[0]?.context).toEqual(expect.objectContaining({
      expectedPass: true,
      incidentGateEvidencePass: false,
      failedCheckCount: 2,
      failedCheckSample: "incidentGateMatchesExpected|digestRiskNotHighWhenExpectedPass",
      incidentGatePass: false,
      incidentGateMatchesExpected: false,
      incidentGateEventObserved: true,
      latestIncidentGateEventMatchesGate: true,
      digestSummaryPresent: true,
      digestIncidentGateCountObserved: true,
      digestLatestIncidentGateAligned: true,
      digestUnexpectedIncidentGateFailZeroWhenExpectedPass: false,
      digestRiskNotHighWhenExpectedPass: false,
      incidentGateEventCount: 1,
      expectedNoOpenRelay: true,
      m0TriageCapturedWhenRequested: true,
    }));
    expect(digest.events["messaging.realtime_voice.connecting_watchdog_incident_gate_evidence"]?.[0]?.context).not.toHaveProperty("extraFieldShouldBeDropped");
  });

  it("tracks realtime voice connecting-watchdog incident-gate-evidence summary counters", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.realtime_voice.connecting_watchdog_incident_gate_evidence",
      level: "warn",
      context: {
        expectedPass: true,
        incidentGateEvidencePass: false,
        failedCheckSample: "incidentGateMatchesExpected",
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        summary: {
          realtimeVoiceSession: {
            riskLevel: "none" | "watch" | "high";
            connectingWatchdogIncidentGateEvidenceCount: number;
            connectingWatchdogIncidentGateEvidencePassCount: number;
            connectingWatchdogIncidentGateEvidenceFailCount: number;
            unexpectedConnectingWatchdogIncidentGateEvidenceFailCount: number;
            latestConnectingWatchdogIncidentGateEvidencePass: boolean | null;
            latestConnectingWatchdogIncidentGateEvidenceFailedCheckSample: string | null;
          };
        };
      };
    };
    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.realtimeVoiceSession).toEqual(expect.objectContaining({
      riskLevel: "high",
      connectingWatchdogIncidentGateEvidenceCount: 1,
      connectingWatchdogIncidentGateEvidencePassCount: 0,
      connectingWatchdogIncidentGateEvidenceFailCount: 1,
      unexpectedConnectingWatchdogIncidentGateEvidenceFailCount: 1,
      latestConnectingWatchdogIncidentGateEvidencePass: false,
      latestConnectingWatchdogIncidentGateEvidenceFailedCheckSample: "incidentGateMatchesExpected",
    }));
  });

  it("captures realtime voice connecting-watchdog incident-gate-self-test diagnostics in compact digest events", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.realtime_voice.connecting_watchdog_incident_gate_self_test",
      level: "warn",
      context: {
        selfTestPass: false,
        failedCheckCount: 1,
        failedCheckSample: "failureRejected",
        nominalPass: true,
        nominalMatchesExpected: true,
        failureRejected: false,
        failureFlagsExpectedMismatch: false,
        incidentGateEvidenceObservedInBoth: true,
        nominalEvidenceGatePass: true,
        failureEvidenceGatePass: true,
        extraFieldShouldBeDropped: "yes",
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        events: Record<string, Array<{ context: Record<string, unknown> }>>;
      };
    };
    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.events["messaging.realtime_voice.connecting_watchdog_incident_gate_self_test"]).toHaveLength(1);
    expect(digest.events["messaging.realtime_voice.connecting_watchdog_incident_gate_self_test"]?.[0]?.context).toEqual(expect.objectContaining({
      selfTestPass: false,
      failedCheckCount: 1,
      failedCheckSample: "failureRejected",
      nominalPass: true,
      nominalMatchesExpected: true,
      failureRejected: false,
      failureFlagsExpectedMismatch: false,
      incidentGateEvidenceObservedInBoth: true,
      nominalEvidenceGatePass: true,
      failureEvidenceGatePass: true,
    }));
    expect(digest.events["messaging.realtime_voice.connecting_watchdog_incident_gate_self_test"]?.[0]?.context).not.toHaveProperty("extraFieldShouldBeDropped");
  });

  it("tracks realtime voice connecting-watchdog incident-gate-self-test summary counters", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.realtime_voice.connecting_watchdog_incident_gate_self_test",
      level: "warn",
      context: {
        selfTestPass: false,
        failedCheckSample: "failureRejected",
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        summary: {
          realtimeVoiceSession: {
            riskLevel: "none" | "watch" | "high";
            connectingWatchdogIncidentGateSelfTestCount: number;
            connectingWatchdogIncidentGateSelfTestPassCount: number;
            connectingWatchdogIncidentGateSelfTestFailCount: number;
            unexpectedConnectingWatchdogIncidentGateSelfTestFailCount: number;
            latestConnectingWatchdogIncidentGateSelfTestPass: boolean | null;
            latestConnectingWatchdogIncidentGateSelfTestFailedCheckSample: string | null;
          };
        };
      };
    };
    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.realtimeVoiceSession).toEqual(expect.objectContaining({
      riskLevel: "high",
      connectingWatchdogIncidentGateSelfTestCount: 1,
      connectingWatchdogIncidentGateSelfTestPassCount: 0,
      connectingWatchdogIncidentGateSelfTestFailCount: 1,
      unexpectedConnectingWatchdogIncidentGateSelfTestFailCount: 1,
      latestConnectingWatchdogIncidentGateSelfTestPass: false,
      latestConnectingWatchdogIncidentGateSelfTestFailedCheckSample: "failureRejected",
    }));
  });

  it("captures realtime voice connecting-watchdog incident-gate-closeout diagnostics in compact digest events", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.realtime_voice.connecting_watchdog_incident_gate_closeout",
      level: "warn",
      context: {
        expectedPass: true,
        closeoutPass: false,
        failedCheckCount: 2,
        failedCheckSample: "incidentGateEvidenceMatchesExpected|digestSummaryPresent",
        incidentGateEvidencePass: false,
        incidentGateEvidenceMatchesExpected: false,
        selfTestPass: true,
        selfTestNominalPass: true,
        selfTestFailureRejected: true,
        digestSummaryPresent: true,
        digestRiskNotHighWhenExpectedPass: false,
        digestUnexpectedIncidentGateEvidenceFailZeroWhenExpectedPass: false,
        digestUnexpectedIncidentGateSelfTestFailZero: true,
        expectedNoOpenRelay: true,
        recentWarnOrErrorCount: 1,
        extraFieldShouldBeDropped: "yes",
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        events: Record<string, Array<{ context: Record<string, unknown> }>>;
      };
    };
    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.events["messaging.realtime_voice.connecting_watchdog_incident_gate_closeout"]).toHaveLength(1);
    expect(digest.events["messaging.realtime_voice.connecting_watchdog_incident_gate_closeout"]?.[0]?.context).toEqual(expect.objectContaining({
      expectedPass: true,
      closeoutPass: false,
      failedCheckCount: 2,
      failedCheckSample: "incidentGateEvidenceMatchesExpected|digestSummaryPresent",
      incidentGateEvidencePass: false,
      incidentGateEvidenceMatchesExpected: false,
      selfTestPass: true,
      selfTestNominalPass: true,
      selfTestFailureRejected: true,
      digestSummaryPresent: true,
      digestRiskNotHighWhenExpectedPass: false,
      digestUnexpectedIncidentGateEvidenceFailZeroWhenExpectedPass: false,
      digestUnexpectedIncidentGateSelfTestFailZero: true,
      expectedNoOpenRelay: true,
      recentWarnOrErrorCount: 1,
    }));
    expect(digest.events["messaging.realtime_voice.connecting_watchdog_incident_gate_closeout"]?.[0]?.context).not.toHaveProperty("extraFieldShouldBeDropped");
  });

  it("tracks realtime voice connecting-watchdog incident-gate-closeout summary counters", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.realtime_voice.connecting_watchdog_incident_gate_closeout",
      level: "warn",
      context: {
        expectedPass: false,
        closeoutPass: false,
        failedCheckSample: "incidentGateEvidenceMatchesExpected",
      },
    });

    let diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        summary: {
          realtimeVoiceSession: {
            riskLevel: "none" | "watch" | "high";
            connectingWatchdogIncidentGateCloseoutCount: number;
            connectingWatchdogIncidentGateCloseoutPassCount: number;
            connectingWatchdogIncidentGateCloseoutFailCount: number;
            unexpectedConnectingWatchdogIncidentGateCloseoutFailCount: number;
            latestConnectingWatchdogIncidentGateCloseoutPass: boolean | null;
            latestConnectingWatchdogIncidentGateCloseoutFailedCheckSample: string | null;
          };
        };
      };
      clear: () => void;
    };
    let digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.realtimeVoiceSession).toEqual(expect.objectContaining({
      riskLevel: "watch",
      connectingWatchdogIncidentGateCloseoutCount: 1,
      connectingWatchdogIncidentGateCloseoutPassCount: 0,
      connectingWatchdogIncidentGateCloseoutFailCount: 1,
      unexpectedConnectingWatchdogIncidentGateCloseoutFailCount: 0,
      latestConnectingWatchdogIncidentGateCloseoutPass: false,
      latestConnectingWatchdogIncidentGateCloseoutFailedCheckSample: "incidentGateEvidenceMatchesExpected",
    }));

    diagnosticsApi.clear();
    logAppEvent({
      name: "messaging.realtime_voice.connecting_watchdog_incident_gate_closeout",
      level: "warn",
      context: {
        expectedPass: true,
        closeoutPass: false,
        failedCheckSample: "digestSummaryPresent",
      },
    });
    diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as typeof diagnosticsApi;
    digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.realtimeVoiceSession).toEqual(expect.objectContaining({
      riskLevel: "high",
      connectingWatchdogIncidentGateCloseoutCount: 1,
      connectingWatchdogIncidentGateCloseoutPassCount: 0,
      connectingWatchdogIncidentGateCloseoutFailCount: 1,
      unexpectedConnectingWatchdogIncidentGateCloseoutFailCount: 1,
      latestConnectingWatchdogIncidentGateCloseoutPass: false,
      latestConnectingWatchdogIncidentGateCloseoutFailedCheckSample: "digestSummaryPresent",
    }));
  });

  it("marks ui responsiveness as watch when navigation/startup probes degrade without hard fallback", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "navigation.route_request",
      level: "info",
      context: {
        guardSource: "app_shell",
        targetHref: "/network",
      },
    });
    logAppEvent({
      name: "navigation.route_settled",
      level: "info",
      context: {
        guardSource: "app_shell",
        pathname: "/network",
        routeSurface: "network",
        elapsedMs: 400,
      },
    });
    logAppEvent({
      name: "navigation.route_mount_probe_slow",
      level: "warn",
      context: {
        pathname: "/network",
        routeSurface: "network",
        elapsedMs: 1600,
        warnThresholdMs: 1500,
      },
    });
    logAppEvent({
      name: "navigation.route_mount_probe_settled",
      level: "warn",
      context: {
        pathname: "/network",
        routeSurface: "network",
        elapsedMs: 1600,
        warnThresholdMs: 1500,
      },
    });
    logAppEvent({
      name: "navigation.page_transition_watchdog_timeout",
      level: "warn",
      context: {
        pathname: "/network",
        routeSurface: "network",
        elapsedMs: 900,
      },
    });
    logAppEvent({
      name: "runtime.profile_boot_stall_timeout",
      level: "warn",
      context: {
        phase: "binding_profile",
        timeoutMs: 12000,
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        summary: {
          uiResponsiveness: {
            riskLevel: "none" | "watch" | "high";
            routeRequestCount: number;
            routeSettledCount: number;
            routeStallHardFallbackCount: number;
            routeMountProbeSlowCount: number;
            routeMountProbeSettledWarnCount: number;
            pageTransitionWatchdogTimeoutCount: number;
            pageTransitionEffectsDisabledCount: number;
            startupProfileBootStallTimeoutCount: number;
            latestRouteSurface: string | null;
            latestRouteStallElapsedMs: number | null;
            latestRouteMountProbeElapsedMs: number | null;
            latestPageTransitionWatchdogElapsedMs: number | null;
            latestStartupProfileBootPhase: string | null;
          };
        };
      };
    };
    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.uiResponsiveness).toEqual(expect.objectContaining({
      riskLevel: "watch",
      routeRequestCount: 1,
      routeSettledCount: 1,
      routeStallHardFallbackCount: 0,
      routeMountProbeSlowCount: 1,
      routeMountProbeSettledWarnCount: 1,
      pageTransitionWatchdogTimeoutCount: 1,
      pageTransitionEffectsDisabledCount: 0,
      startupProfileBootStallTimeoutCount: 1,
      latestRouteSurface: "network",
      latestRouteStallElapsedMs: null,
      latestRouteMountProbeElapsedMs: 1600,
      latestPageTransitionWatchdogElapsedMs: 900,
      latestStartupProfileBootPhase: "binding_profile",
    }));
  });

  it("marks ui responsiveness as high when hard fallback or transition disablement occurs", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "navigation.route_stall_hard_fallback",
      level: "warn",
      context: {
        guardSource: "app_shell",
        targetRouteSurface: "chats",
        elapsedMs: 1300,
      },
    });
    logAppEvent({
      name: "navigation.route_mount_performance_guard_enabled",
      level: "warn",
      context: {
        pathname: "/",
        routeSurface: "chats",
        elapsedMs: 1550,
        slowSampleCount: 3,
        consecutiveSlowSampleCount: 3,
        disableThreshold: 3,
        warnThresholdMs: 1500,
      },
    });
    logAppEvent({
      name: "navigation.page_transition_effects_disabled",
      level: "warn",
      context: {
        pathname: "/",
        routeSurface: "chats",
        timeoutCount: 3,
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        summary: {
          uiResponsiveness: {
            riskLevel: "none" | "watch" | "high";
            routeStallHardFallbackCount: number;
            routeMountPerformanceGuardEnabledCount: number;
            pageTransitionEffectsDisabledCount: number;
            latestRouteSurface: string | null;
            latestRouteStallElapsedMs: number | null;
          };
        };
      };
    };
    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.summary.uiResponsiveness).toEqual(expect.objectContaining({
      riskLevel: "high",
      routeStallHardFallbackCount: 1,
      routeMountPerformanceGuardEnabledCount: 1,
      pageTransitionEffectsDisabledCount: 1,
      latestRouteSurface: "chats",
      latestRouteStallElapsedMs: 1300,
    }));
  });

  it("tracks m10 cp2 stability gate pass/fail counters in digest summary", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.m10.cp2_stability_gate",
      level: "warn",
      context: {
        expectedStable: true,
        cp2Pass: false,
        failedCheckCount: 2,
        failedCheckSample: "uiResponsivenessRiskNotHigh",
        uiResponsivenessRiskLevel: "high",
        uiRouteStallHardFallbackCount: 1,
        extraFieldShouldBeDropped: "yes",
      },
    });
    logAppEvent({
      name: "messaging.m10.cp2_stability_gate",
      level: "info",
      context: {
        expectedStable: false,
        cp2Pass: true,
        failedCheckCount: 0,
        failedCheckSample: null,
        uiResponsivenessRiskLevel: "watch",
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        events: Record<string, Array<{ context: Record<string, unknown> }>>;
        summary: {
          m10TrustControls: {
            riskLevel: "none" | "watch" | "high";
            cp2StabilityGateCount: number;
            cp2StabilityGatePassCount: number;
            cp2StabilityGateFailCount: number;
            cp2StabilityGateUnexpectedFailCount: number;
            cp3ReadinessGateCount: number;
            cp3ReadinessGatePassCount: number;
            cp3ReadinessGateFailCount: number;
            cp3ReadinessGateUnexpectedFailCount: number;
            cp3SuiteGateCount: number;
            cp3SuiteGatePassCount: number;
            cp3SuiteGateFailCount: number;
            cp3SuiteGateUnexpectedFailCount: number;
            cp4CloseoutGateCount: number;
            cp4CloseoutGatePassCount: number;
            cp4CloseoutGateFailCount: number;
            cp4CloseoutGateUnexpectedFailCount: number;
            latestExpectedStable: boolean | null;
            latestPass: boolean | null;
            latestFailedCheckSample: string | null;
            latestCp3ExpectedStable: boolean | null;
            latestCp3Pass: boolean | null;
            latestCp3FailedCheckSample: string | null;
            latestCp3SuiteExpectedStable: boolean | null;
            latestCp3SuitePass: boolean | null;
            latestCp3SuiteFailedCheckSample: string | null;
            latestCp4CloseoutExpectedStable: boolean | null;
            latestCp4CloseoutPass: boolean | null;
            latestCp4CloseoutFailedCheckSample: string | null;
          };
        };
      };
    };
    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.events["messaging.m10.cp2_stability_gate"]?.[0]?.context).toEqual(expect.objectContaining({
      expectedStable: true,
      cp2Pass: false,
      failedCheckCount: 2,
      failedCheckSample: "uiResponsivenessRiskNotHigh",
      uiResponsivenessRiskLevel: "high",
      uiRouteStallHardFallbackCount: 1,
    }));
    expect(digest.events["messaging.m10.cp2_stability_gate"]?.[0]?.context).not.toHaveProperty("extraFieldShouldBeDropped");
    expect(digest.summary.m10TrustControls).toEqual(expect.objectContaining({
      riskLevel: "high",
      cp2StabilityGateCount: 2,
      cp2StabilityGatePassCount: 1,
      cp2StabilityGateFailCount: 1,
      cp2StabilityGateUnexpectedFailCount: 1,
      cp3ReadinessGateCount: 0,
      cp3ReadinessGatePassCount: 0,
      cp3ReadinessGateFailCount: 0,
      cp3ReadinessGateUnexpectedFailCount: 0,
      cp3SuiteGateCount: 0,
      cp3SuiteGatePassCount: 0,
      cp3SuiteGateFailCount: 0,
      cp3SuiteGateUnexpectedFailCount: 0,
      cp4CloseoutGateCount: 0,
      cp4CloseoutGatePassCount: 0,
      cp4CloseoutGateFailCount: 0,
      cp4CloseoutGateUnexpectedFailCount: 0,
      latestExpectedStable: false,
      latestPass: true,
      latestFailedCheckSample: null,
      latestCp3ExpectedStable: null,
      latestCp3Pass: null,
      latestCp3FailedCheckSample: null,
      latestCp3SuiteExpectedStable: null,
      latestCp3SuitePass: null,
      latestCp3SuiteFailedCheckSample: null,
      latestCp4CloseoutExpectedStable: null,
      latestCp4CloseoutPass: null,
      latestCp4CloseoutFailedCheckSample: null,
    }));
  });

  it("tracks m10 cp3 readiness gate pass/fail counters in digest summary", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.m10.cp3_readiness_gate",
      level: "warn",
      context: {
        expectedStable: true,
        cp3Pass: false,
        failedCheckCount: 1,
        failedCheckSample: "cp2UnexpectedFailCountZero",
        cp2TriagePass: true,
        m10TrustControlsRiskLevel: "high",
        cp2StabilityGateUnexpectedFailCount: 1,
        extraFieldShouldBeDropped: "yes",
      },
    });
    logAppEvent({
      name: "messaging.m10.cp3_readiness_gate",
      level: "info",
      context: {
        expectedStable: false,
        cp3Pass: true,
        failedCheckCount: 0,
        failedCheckSample: null,
        cp2TriagePass: true,
        m10TrustControlsRiskLevel: "watch",
        cp2StabilityGateUnexpectedFailCount: 0,
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        events: Record<string, Array<{ context: Record<string, unknown> }>>;
        summary: {
          m10TrustControls: {
            riskLevel: "none" | "watch" | "high";
            cp2StabilityGateCount: number;
            cp2StabilityGatePassCount: number;
            cp2StabilityGateFailCount: number;
            cp2StabilityGateUnexpectedFailCount: number;
            cp3ReadinessGateCount: number;
            cp3ReadinessGatePassCount: number;
            cp3ReadinessGateFailCount: number;
            cp3ReadinessGateUnexpectedFailCount: number;
            cp3SuiteGateCount: number;
            cp3SuiteGatePassCount: number;
            cp3SuiteGateFailCount: number;
            cp3SuiteGateUnexpectedFailCount: number;
            cp4CloseoutGateCount: number;
            cp4CloseoutGatePassCount: number;
            cp4CloseoutGateFailCount: number;
            cp4CloseoutGateUnexpectedFailCount: number;
            latestExpectedStable: boolean | null;
            latestPass: boolean | null;
            latestFailedCheckSample: string | null;
            latestCp3ExpectedStable: boolean | null;
            latestCp3Pass: boolean | null;
            latestCp3FailedCheckSample: string | null;
            latestCp3SuiteExpectedStable: boolean | null;
            latestCp3SuitePass: boolean | null;
            latestCp3SuiteFailedCheckSample: string | null;
            latestCp4CloseoutExpectedStable: boolean | null;
            latestCp4CloseoutPass: boolean | null;
            latestCp4CloseoutFailedCheckSample: string | null;
          };
        };
      };
    };
    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.events["messaging.m10.cp3_readiness_gate"]?.[0]?.context).toEqual(expect.objectContaining({
      expectedStable: true,
      cp3Pass: false,
      failedCheckCount: 1,
      failedCheckSample: "cp2UnexpectedFailCountZero",
      cp2TriagePass: true,
      m10TrustControlsRiskLevel: "high",
      cp2StabilityGateUnexpectedFailCount: 1,
    }));
    expect(digest.events["messaging.m10.cp3_readiness_gate"]?.[0]?.context).not.toHaveProperty("extraFieldShouldBeDropped");
    expect(digest.summary.m10TrustControls).toEqual(expect.objectContaining({
      riskLevel: "high",
      cp3ReadinessGateCount: 2,
      cp3ReadinessGatePassCount: 1,
      cp3ReadinessGateFailCount: 1,
      cp3ReadinessGateUnexpectedFailCount: 1,
      cp3SuiteGateCount: 0,
      cp3SuiteGatePassCount: 0,
      cp3SuiteGateFailCount: 0,
      cp3SuiteGateUnexpectedFailCount: 0,
      cp4CloseoutGateCount: 0,
      cp4CloseoutGatePassCount: 0,
      cp4CloseoutGateFailCount: 0,
      cp4CloseoutGateUnexpectedFailCount: 0,
      latestCp3ExpectedStable: false,
      latestCp3Pass: true,
      latestCp3FailedCheckSample: null,
      latestCp3SuiteExpectedStable: null,
      latestCp3SuitePass: null,
      latestCp3SuiteFailedCheckSample: null,
      latestCp4CloseoutExpectedStable: null,
      latestCp4CloseoutPass: null,
      latestCp4CloseoutFailedCheckSample: null,
    }));
  });

  it("tracks m10 cp3 suite gate pass/fail counters in digest summary", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.m10.cp3_suite_gate",
      level: "warn",
      context: {
        expectedStable: true,
        cp3SuitePass: false,
        failedCheckCount: 1,
        failedCheckSample: "cp3ReadinessUnexpectedFailCountZero",
        cp3ReadinessPass: true,
        m10TrustControlsRiskLevel: "high",
        cp3ReadinessUnexpectedFailCount: 1,
        extraFieldShouldBeDropped: "yes",
      },
    });
    logAppEvent({
      name: "messaging.m10.cp3_suite_gate",
      level: "info",
      context: {
        expectedStable: false,
        cp3SuitePass: true,
        failedCheckCount: 0,
        failedCheckSample: null,
        cp3ReadinessPass: true,
        m10TrustControlsRiskLevel: "watch",
        cp3ReadinessUnexpectedFailCount: 0,
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        events: Record<string, Array<{ context: Record<string, unknown> }>>;
        summary: {
          m10TrustControls: {
            riskLevel: "none" | "watch" | "high";
            cp3SuiteGateCount: number;
            cp3SuiteGatePassCount: number;
            cp3SuiteGateFailCount: number;
            cp3SuiteGateUnexpectedFailCount: number;
            latestCp3SuiteExpectedStable: boolean | null;
            latestCp3SuitePass: boolean | null;
            latestCp3SuiteFailedCheckSample: string | null;
          };
        };
      };
    };
    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.events["messaging.m10.cp3_suite_gate"]?.[0]?.context).toEqual(expect.objectContaining({
      expectedStable: true,
      cp3SuitePass: false,
      failedCheckCount: 1,
      failedCheckSample: "cp3ReadinessUnexpectedFailCountZero",
      cp3ReadinessPass: true,
      m10TrustControlsRiskLevel: "high",
      cp3ReadinessUnexpectedFailCount: 1,
    }));
    expect(digest.events["messaging.m10.cp3_suite_gate"]?.[0]?.context).not.toHaveProperty("extraFieldShouldBeDropped");
    expect(digest.summary.m10TrustControls).toEqual(expect.objectContaining({
      riskLevel: "high",
      cp3SuiteGateCount: 2,
      cp3SuiteGatePassCount: 1,
      cp3SuiteGateFailCount: 1,
      cp3SuiteGateUnexpectedFailCount: 1,
      latestCp3SuiteExpectedStable: false,
      latestCp3SuitePass: true,
      latestCp3SuiteFailedCheckSample: null,
    }));
  });

  it("tracks m10 cp4 closeout gate pass/fail counters in digest summary", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.m10.cp4_closeout_gate",
      level: "warn",
      context: {
        expectedStable: true,
        cp4CloseoutPass: false,
        failedCheckCount: 1,
        failedCheckSample: "cp3SuiteUnexpectedFailCountZero",
        cp3SuitePass: false,
        m10TrustControlsRiskLevel: "high",
        cp3SuiteUnexpectedFailCount: 1,
        extraFieldShouldBeDropped: "yes",
      },
    });
    logAppEvent({
      name: "messaging.m10.cp4_closeout_gate",
      level: "info",
      context: {
        expectedStable: false,
        cp4CloseoutPass: true,
        failedCheckCount: 0,
        failedCheckSample: null,
        cp3SuitePass: true,
        m10TrustControlsRiskLevel: "watch",
        cp3SuiteUnexpectedFailCount: 0,
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        events: Record<string, Array<{ context: Record<string, unknown> }>>;
        summary: {
          m10TrustControls: {
            riskLevel: "none" | "watch" | "high";
            cp4CloseoutGateCount: number;
            cp4CloseoutGatePassCount: number;
            cp4CloseoutGateFailCount: number;
            cp4CloseoutGateUnexpectedFailCount: number;
            latestCp4CloseoutExpectedStable: boolean | null;
            latestCp4CloseoutPass: boolean | null;
            latestCp4CloseoutFailedCheckSample: string | null;
          };
        };
      };
    };
    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.events["messaging.m10.cp4_closeout_gate"]?.[0]?.context).toEqual(expect.objectContaining({
      expectedStable: true,
      cp4CloseoutPass: false,
      failedCheckCount: 1,
      failedCheckSample: "cp3SuiteUnexpectedFailCountZero",
      cp3SuitePass: false,
      m10TrustControlsRiskLevel: "high",
      cp3SuiteUnexpectedFailCount: 1,
    }));
    expect(digest.events["messaging.m10.cp4_closeout_gate"]?.[0]?.context).not.toHaveProperty("extraFieldShouldBeDropped");
    expect(digest.summary.m10TrustControls).toEqual(expect.objectContaining({
      riskLevel: "high",
      cp4CloseoutGateCount: 2,
      cp4CloseoutGatePassCount: 1,
      cp4CloseoutGateFailCount: 1,
      cp4CloseoutGateUnexpectedFailCount: 1,
      latestCp4CloseoutExpectedStable: false,
      latestCp4CloseoutPass: true,
      latestCp4CloseoutFailedCheckSample: null,
    }));
  });

  it("tracks m10 v130 closeout gate pass/fail counters in digest summary", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.m10.v130_closeout_gate",
      level: "warn",
      context: {
        expectedStable: true,
        v130CloseoutPass: false,
        failedCheckCount: 1,
        failedCheckSample: "cp4CloseoutUnexpectedFailCountZero",
        cp4CloseoutPass: false,
        m10TrustControlsRiskLevel: "high",
        cp4CloseoutGateCount: 1,
        cp4CloseoutUnexpectedFailCount: 1,
        extraFieldShouldBeDropped: "yes",
      },
    });
    logAppEvent({
      name: "messaging.m10.v130_closeout_gate",
      level: "info",
      context: {
        expectedStable: false,
        v130CloseoutPass: true,
        failedCheckCount: 0,
        failedCheckSample: null,
        cp4CloseoutPass: true,
        m10TrustControlsRiskLevel: "watch",
        cp4CloseoutGateCount: 2,
        cp4CloseoutUnexpectedFailCount: 0,
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        events: Record<string, Array<{ context: Record<string, unknown> }>>;
        summary: {
          m10TrustControls: {
            riskLevel: "none" | "watch" | "high";
            v130CloseoutGateCount: number;
            v130CloseoutGatePassCount: number;
            v130CloseoutGateFailCount: number;
            v130CloseoutGateUnexpectedFailCount: number;
            latestV130CloseoutExpectedStable: boolean | null;
            latestV130CloseoutPass: boolean | null;
            latestV130CloseoutFailedCheckSample: string | null;
          };
        };
      };
    };
    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.events["messaging.m10.v130_closeout_gate"]?.[0]?.context).toEqual(expect.objectContaining({
      expectedStable: true,
      v130CloseoutPass: false,
      failedCheckCount: 1,
      failedCheckSample: "cp4CloseoutUnexpectedFailCountZero",
      cp4CloseoutPass: false,
      m10TrustControlsRiskLevel: "high",
      cp4CloseoutGateCount: 1,
      cp4CloseoutUnexpectedFailCount: 1,
    }));
    expect(digest.events["messaging.m10.v130_closeout_gate"]?.[0]?.context).not.toHaveProperty("extraFieldShouldBeDropped");
    expect(digest.summary.m10TrustControls).toEqual(expect.objectContaining({
      riskLevel: "high",
      v130CloseoutGateCount: 2,
      v130CloseoutGatePassCount: 1,
      v130CloseoutGateFailCount: 1,
      v130CloseoutGateUnexpectedFailCount: 1,
      latestV130CloseoutExpectedStable: false,
      latestV130CloseoutPass: true,
      latestV130CloseoutFailedCheckSample: null,
    }));
  });

  it("tracks m10 v130 evidence gate pass/fail counters in digest summary", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logAppEvent({
      name: "messaging.m10.v130_evidence_gate",
      level: "warn",
      context: {
        expectedStable: true,
        v130EvidencePass: false,
        failedCheckCount: 1,
        failedCheckSample: "v130CloseoutUnexpectedFailCountZero",
        v130CloseoutPass: false,
        cp4CloseoutPass: false,
        m10TrustControlsRiskLevel: "high",
        cp4CloseoutGateCount: 1,
        v130CloseoutGateCount: 1,
        v130CloseoutUnexpectedFailCount: 1,
        v130CloseoutEventCount: 1,
        latestV130EventMatchesGate: false,
        extraFieldShouldBeDropped: "yes",
      },
    });
    logAppEvent({
      name: "messaging.m10.v130_evidence_gate",
      level: "info",
      context: {
        expectedStable: false,
        v130EvidencePass: true,
        failedCheckCount: 0,
        failedCheckSample: null,
        v130CloseoutPass: true,
        cp4CloseoutPass: true,
        m10TrustControlsRiskLevel: "watch",
        cp4CloseoutGateCount: 2,
        v130CloseoutGateCount: 2,
        v130CloseoutUnexpectedFailCount: 0,
        v130CloseoutEventCount: 2,
        latestV130EventMatchesGate: true,
      },
    });

    const diagnosticsApi = (globalThis as Record<string, unknown>).obscurAppEvents as {
      getCrossDeviceSyncDigest: (count?: number) => {
        events: Record<string, Array<{ context: Record<string, unknown> }>>;
        summary: {
          m10TrustControls: {
            riskLevel: "none" | "watch" | "high";
            v130EvidenceGateCount: number;
            v130EvidenceGatePassCount: number;
            v130EvidenceGateFailCount: number;
            v130EvidenceGateUnexpectedFailCount: number;
            latestV130EvidenceExpectedStable: boolean | null;
            latestV130EvidencePass: boolean | null;
            latestV130EvidenceFailedCheckSample: string | null;
          };
        };
      };
    };
    const digest = diagnosticsApi.getCrossDeviceSyncDigest(50);
    expect(digest.events["messaging.m10.v130_evidence_gate"]?.[0]?.context).toEqual(expect.objectContaining({
      expectedStable: true,
      v130EvidencePass: false,
      failedCheckCount: 1,
      failedCheckSample: "v130CloseoutUnexpectedFailCountZero",
      v130CloseoutPass: false,
      cp4CloseoutPass: false,
      m10TrustControlsRiskLevel: "high",
      cp4CloseoutGateCount: 1,
      v130CloseoutGateCount: 1,
      v130CloseoutUnexpectedFailCount: 1,
      v130CloseoutEventCount: 1,
      latestV130EventMatchesGate: false,
    }));
    expect(digest.events["messaging.m10.v130_evidence_gate"]?.[0]?.context).not.toHaveProperty("extraFieldShouldBeDropped");
    expect(digest.summary.m10TrustControls).toEqual(expect.objectContaining({
      riskLevel: "high",
      v130EvidenceGateCount: 2,
      v130EvidenceGatePassCount: 1,
      v130EvidenceGateFailCount: 1,
      v130EvidenceGateUnexpectedFailCount: 1,
      latestV130EvidenceExpectedStable: false,
      latestV130EvidencePass: true,
      latestV130EvidenceFailedCheckSample: null,
    }));
  });
});
