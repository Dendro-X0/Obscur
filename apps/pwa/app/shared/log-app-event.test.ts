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
        reasonCode: "target_room_key_missing_local_profile_scope",
        localRoomKeyCount: 2,
        hasTargetGroupRecord: false,
        activeProfileId: "profile-a",
        senderPubkeySuffix: "1234abcd",
        knownGroupHintSample: "group:one|group:two",
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
            latestToPhase: string | null;
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
      reasonCode: "target_room_key_missing_local_profile_scope",
      localRoomKeyCount: 2,
      hasTargetGroupRecord: false,
      activeProfileId: "profile-a",
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
      latestToPhase: "ended",
      latestReasonCode: "recovery_exhausted",
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
            latestToPhase: string | null;
            latestReasonCode: string | null;
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
      latestToPhase: "connecting",
      latestReasonCode: "none",
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
      latestToPhase: "unsupported",
      latestReasonCode: "webrtc_unavailable",
    }));
  });
});
