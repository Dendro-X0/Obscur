import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  installM8CommunityCapture,
  m8CommunityCaptureInternals,
} from "./m8-community-capture";

type MutableWindow = Window & Record<string, unknown>;

const getMutableWindow = (): MutableWindow => window as unknown as MutableWindow;

describe("m8-community-capture", () => {
  beforeEach(() => {
    const root = getMutableWindow();
    delete root.obscurM8CommunityCapture;
    delete root.obscurAppEvents;
    delete root.obscurM0Triage;
    vi.restoreAllMocks();
  });

  it("installs helper and captures community lifecycle diagnostics bundle", () => {
    const root = getMutableWindow();
    root.obscurAppEvents = {
      getCrossDeviceSyncDigest: () => ({
        summary: {
          communityLifecycleConvergence: {
            riskLevel: "watch",
            latestPersistedGroupCount: 2,
            latestPersistedDuplicateMergeCount: 1,
            latestHydratedFromPersistedWithLedgerCount: 1,
            latestHydratedFromPersistedFallbackCount: 0,
            latestHydratedFromLedgerOnlyCount: 1,
            latestPlaceholderDisplayNameRecoveredCount: 1,
            latestLocalMemberBackfillCount: 1,
            latestMissingLedgerCoverageCount: 0,
            latestHiddenByLedgerStatusCount: 0,
            recoveryRepairSignalCount: 2,
          },
          membershipSendability: {
            riskLevel: "watch",
            latestVisibleGroupCount: 1,
            latestChatStateGroupCount: 1,
            roomKeyMissingSendBlockedCount: 1,
          },
          accountSwitchScopeConvergence: {
            riskLevel: "watch",
            backupRestoreProfileScopeMismatchCount: 0,
            runtimeActivationProfileScopeMismatchCount: 0,
            autoUnlockScopeDriftDetectedCount: 1,
            latestBackupRestoreReasonCode: null,
            latestRuntimeActivationReasonCode: null,
            latestAutoUnlockReasonCode: "remember_token_profile_mismatch",
          },
        },
        events: {
          "groups.membership_recovery_hydrate": [
            {
              atUnixMs: 21,
              level: "info",
              context: { visibleGroupCount: 1 },
            },
          ],
          "groups.membership_ledger_load": [
            {
              atUnixMs: 22,
              level: "info",
              context: { mergedEntryCount: 1 },
            },
          ],
          "groups.room_key_missing_send_blocked": [
            {
              atUnixMs: 23,
              level: "warn",
              context: { reasonCode: "target_room_key_missing_after_membership_joined" },
            },
          ],
        },
        recentWarnOrError: [
          {
            name: "groups.room_key_missing_send_blocked",
            level: "warn",
            atUnixMs: 23,
            reasonCode: "target_room_key_missing_after_membership_joined",
          },
        ],
      }),
    };
    (root as Record<string, unknown>).obscurM0Triage = {
      capture: () => ({ tag: "m0" }),
    };

    installM8CommunityCapture();

    const api = root.obscurM8CommunityCapture as {
      capture: (eventWindowSize?: number) => unknown;
      captureJson: (eventWindowSize?: number) => string;
    };
    expect(api).toBeTruthy();

    const bundle = api.capture(320) as {
      checks: { requiredApis: Record<string, boolean> };
      community: {
        communityLifecycleConvergence: Record<string, unknown> | null;
        membershipSendability: Record<string, unknown> | null;
        accountSwitchScopeConvergence: Record<string, unknown> | null;
        membershipRecoveryHydrate: Array<{ atUnixMs: number }>;
        membershipLedgerLoad: Array<{ atUnixMs: number }>;
        roomKeyMissingSendBlocked: Array<{ context: Record<string, unknown> }>;
        replayReadiness: {
          hasCommunityLifecycleSummary: boolean;
          hasMembershipSendabilitySummary: boolean;
          hasAccountSwitchScopeSummary: boolean;
          hasRecoveryHydrateEvents: boolean;
          hasLedgerLoadEvents: boolean;
          observedJoinedRoomKeyMismatch: boolean;
          readyForCp2Evidence: boolean;
          readyForCp3Evidence: boolean;
        };
      };
      m0Triage: unknown;
    };

    expect(bundle.checks.requiredApis.appEvents).toBe(true);
    expect(bundle.checks.requiredApis.m0Triage).toBe(true);
    expect(bundle.community.communityLifecycleConvergence).toEqual(expect.objectContaining({
      riskLevel: "watch",
      latestPersistedDuplicateMergeCount: 1,
      recoveryRepairSignalCount: 2,
    }));
    expect(bundle.community.membershipSendability).toEqual(expect.objectContaining({
      riskLevel: "watch",
      roomKeyMissingSendBlockedCount: 1,
    }));
    expect(bundle.community.accountSwitchScopeConvergence).toEqual(expect.objectContaining({
      riskLevel: "watch",
      autoUnlockScopeDriftDetectedCount: 1,
      latestAutoUnlockReasonCode: "remember_token_profile_mismatch",
    }));
    expect(bundle.community.membershipRecoveryHydrate[0]?.atUnixMs).toBe(21);
    expect(bundle.community.membershipLedgerLoad[0]?.atUnixMs).toBe(22);
    expect(bundle.community.roomKeyMissingSendBlocked[0]?.context.reasonCode)
      .toBe("target_room_key_missing_after_membership_joined");
    expect(bundle.community.replayReadiness).toEqual(expect.objectContaining({
      hasCommunityLifecycleSummary: true,
      hasMembershipSendabilitySummary: true,
      hasAccountSwitchScopeSummary: true,
      hasRecoveryHydrateEvents: true,
      hasLedgerLoadEvents: true,
      observedJoinedRoomKeyMismatch: true,
      readyForCp2Evidence: true,
      readyForCp3Evidence: true,
    }));
    expect(bundle.m0Triage).toEqual({ tag: "m0" });
    expect(() => JSON.parse(api.captureJson(320))).not.toThrow();
  });

  it("fails open when APIs are unavailable", () => {
    const root = getMutableWindow();
    installM8CommunityCapture();

    const api = root.obscurM8CommunityCapture as { capture: (eventWindowSize?: number) => unknown };
    const bundle = api.capture() as {
      checks: { requiredApis: Record<string, boolean> };
      community: {
        communityLifecycleConvergence: unknown;
        membershipSendability: unknown;
        accountSwitchScopeConvergence: unknown;
        membershipRecoveryHydrate: unknown[];
        membershipLedgerLoad: unknown[];
        roomKeyMissingSendBlocked: unknown[];
        replayReadiness: {
          readyForCp2Evidence: boolean;
          readyForCp3Evidence: boolean;
        };
      };
      m0Triage: unknown;
    };

    expect(bundle.checks.requiredApis.appEvents).toBe(false);
    expect(bundle.checks.requiredApis.m0Triage).toBe(false);
    expect(bundle.community.communityLifecycleConvergence).toBeNull();
    expect(bundle.community.membershipSendability).toBeNull();
    expect(bundle.community.accountSwitchScopeConvergence).toBeNull();
    expect(bundle.community.membershipRecoveryHydrate).toEqual([]);
    expect(bundle.community.membershipLedgerLoad).toEqual([]);
    expect(bundle.community.roomKeyMissingSendBlocked).toEqual([]);
    expect(bundle.community.replayReadiness.readyForCp2Evidence).toBe(false);
    expect(bundle.community.replayReadiness.readyForCp3Evidence).toBe(false);
    expect(bundle.m0Triage).toBeNull();
  });

  it("normalizes malformed summaries and invalid window values", () => {
    expect(m8CommunityCaptureInternals.parseCommunityLifecycleConvergenceSummary(null)).toBeNull();
    expect(m8CommunityCaptureInternals.parseMembershipSendabilitySummary(null)).toBeNull();
    expect(m8CommunityCaptureInternals.parseCommunityLifecycleConvergenceSummary({
      riskLevel: "high",
      latestPersistedGroupCount: 3,
      recoveryRepairSignalCount: 2,
    })).toEqual(expect.objectContaining({
      riskLevel: "high",
      latestPersistedGroupCount: 3,
      recoveryRepairSignalCount: 2,
    }));
    expect(m8CommunityCaptureInternals.parseMembershipSendabilitySummary({
      riskLevel: "watch",
      latestVisibleGroupCount: 2,
      roomKeyMissingSendBlockedCount: 4,
    })).toEqual(expect.objectContaining({
      riskLevel: "watch",
      latestVisibleGroupCount: 2,
      roomKeyMissingSendBlockedCount: 4,
    }));
    expect(m8CommunityCaptureInternals.parseAccountSwitchScopeConvergenceSummary({
      riskLevel: "high",
      backupRestoreProfileScopeMismatchCount: 1,
      runtimeActivationProfileScopeMismatchCount: 1,
      autoUnlockScopeDriftDetectedCount: 2,
      latestBackupRestoreReasonCode: "restore_profile_scope_drift_detected",
      latestRuntimeActivationReasonCode: "projection_pubkey_mismatch",
      latestAutoUnlockReasonCode: "remember_token_profile_mismatch",
    })).toEqual(expect.objectContaining({
      riskLevel: "high",
      backupRestoreProfileScopeMismatchCount: 1,
      runtimeActivationProfileScopeMismatchCount: 1,
      autoUnlockScopeDriftDetectedCount: 2,
    }));
    expect(m8CommunityCaptureInternals.toNumericWindowSize(410.7)).toBe(410);
    expect(m8CommunityCaptureInternals.toNumericWindowSize(0)).toBe(1);
    expect(m8CommunityCaptureInternals.toNumericWindowSize(Number.NaN)).toBe(400);
  });
});
