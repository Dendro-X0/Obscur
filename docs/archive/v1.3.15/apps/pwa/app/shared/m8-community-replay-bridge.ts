import { logAppEvent } from "@/app/shared/log-app-event";
import type { M8CommunityCaptureBundle } from "@/app/shared/m8-community-capture";

export type M8CommunityReplayResult = Readonly<{
  generatedAtUnixMs: number;
  replayBaseUnixMs: number;
  emittedEvents: Readonly<{
    membershipLedgerLoadCount: number;
    membershipRecoveryHydrateCount: number;
    chatStateGroupsUpdateCount: number;
    roomKeyMissingSendBlockedCount: number;
  }>;
  latestDigestSummary: Readonly<{
    communityLifecycleConvergence: M8CommunityCaptureBundle["community"]["communityLifecycleConvergence"];
    membershipSendability: M8CommunityCaptureBundle["community"]["membershipSendability"];
    accountSwitchScopeConvergence: M8CommunityCaptureBundle["community"]["accountSwitchScopeConvergence"];
  }> | null;
  replayReadiness: M8CommunityCaptureBundle["community"]["replayReadiness"] | null;
}>;

export type M8CommunityCp3EvidenceGate = Readonly<{
  pass: boolean;
  failedChecks: ReadonlyArray<string>;
  checks: Readonly<{
    hasReplayResult: boolean;
    hasCaptureBundle: boolean;
    hasMembershipRecoveryHydrateEvent: boolean;
    hasMembershipLedgerLoadEvent: boolean;
    hasRoomKeyMissingSendBlockedEvent: boolean;
    hasRecoveryRepairSignal: boolean;
    hasJoinedMembershipMismatchSignal: boolean;
    hasAccountSwitchScopeSummary: boolean;
    replayReadyForCp2: boolean;
    replayReadyForCp3: boolean;
    captureReadyForCp2: boolean;
    captureReadyForCp3: boolean;
  }>;
}>;

export type M8CommunityReplayCaptureBundle = Readonly<{
  replay: M8CommunityReplayResult | null;
  capture: M8CommunityCaptureBundle | null;
  cp3EvidenceGate: M8CommunityCp3EvidenceGate;
}>;

type M8CommunityReplayApi = Readonly<{
  reset: (params?: Readonly<{ clearAppEvents?: boolean }>) => void;
  getLastReplay: () => M8CommunityReplayResult | null;
  runConvergenceReplay: (params?: Readonly<{
    baseUnixMs?: number;
    captureWindowSize?: number;
    clearAppEvents?: boolean;
  }>) => M8CommunityReplayResult;
  runConvergenceReplayCapture: (params?: Readonly<{
    baseUnixMs?: number;
    captureWindowSize?: number;
    clearAppEvents?: boolean;
  }>) => M8CommunityReplayCaptureBundle;
  runConvergenceReplayCaptureJson: (params?: Readonly<{
    baseUnixMs?: number;
    captureWindowSize?: number;
    clearAppEvents?: boolean;
  }>) => string;
}>;

type M8CommunityReplayWindow = Window & {
  obscurM8CommunityReplay?: M8CommunityReplayApi;
  obscurM8CommunityCapture?: Readonly<{
    capture?: (eventWindowSize?: number) => M8CommunityCaptureBundle;
  }>;
  obscurAppEvents?: Readonly<{
    clear?: () => void;
    getCrossDeviceSyncDigest?: (count?: number) => Readonly<{
      summary?: Readonly<{
        communityLifecycleConvergence?: M8CommunityReplayResult["latestDigestSummary"] extends infer T
          ? T extends Readonly<{ communityLifecycleConvergence: infer V }>
            ? V
            : never
          : never;
        membershipSendability?: M8CommunityReplayResult["latestDigestSummary"] extends infer T
          ? T extends Readonly<{ membershipSendability: infer V }>
            ? V
            : never
          : never;
        accountSwitchScopeConvergence?: M8CommunityReplayResult["latestDigestSummary"] extends infer T
          ? T extends Readonly<{ accountSwitchScopeConvergence: infer V }>
            ? V
            : never
          : never;
      }>;
    }>;
  }>;
};

declare global {
  interface Window {
    obscurM8CommunityReplay?: M8CommunityReplayApi;
  }
}

const toPositiveInteger = (value: unknown, fallback: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.floor(value));
  }
  return fallback;
};

const emitDeterministicConvergenceEvents = (baseUnixMs: number): Readonly<{
  membershipLedgerLoadCount: number;
  membershipRecoveryHydrateCount: number;
  chatStateGroupsUpdateCount: number;
  roomKeyMissingSendBlockedCount: number;
}> => {
  logAppEvent({
    name: "groups.membership_ledger_load",
    level: "info",
    scope: { feature: "groups", action: "membership_ledger" },
    context: {
      publicKeySuffix: "aaaaaaaa",
      profileId: "default",
      scopedEntryCount: 1,
      legacyEntryCount: 1,
      mergedEntryCount: 1,
      replayBaseUnixMs: baseUnixMs,
    },
  });
  logAppEvent({
    name: "groups.membership_recovery_hydrate",
    level: "info",
    scope: { feature: "groups", action: "membership_recovery" },
    context: {
      publicKeySuffix: "aaaaaaaa",
      profileId: "default",
      persistedGroupCount: 2,
      persistedDuplicateMergeCount: 1,
      ledgerEntryCount: 1,
      visibleGroupCount: 1,
      hydratedFromPersistedWithLedgerCount: 1,
      hydratedFromPersistedFallbackCount: 0,
      hydratedFromLedgerOnlyCount: 0,
      placeholderDisplayNameRecoveredCount: 1,
      localMemberBackfillCount: 1,
      hiddenByTombstoneCount: 0,
      hiddenByLedgerStatusCount: 0,
      missingLedgerCoverageCount: 0,
      replayBaseUnixMs: baseUnixMs,
    },
  });
  logAppEvent({
    name: "messaging.chat_state_groups_update",
    level: "info",
    scope: { feature: "messaging", action: "chat_state_store" },
    context: {
      publicKeySuffix: "aaaaaaaa",
      profileId: "default",
      groupCount: 1,
      replayBaseUnixMs: baseUnixMs,
    },
  });
  logAppEvent({
    name: "groups.room_key_missing_send_blocked",
    level: "warn",
    scope: { feature: "groups", action: "send_message" },
    context: {
      groupIdHint: "m8replay...group",
      reasonCode: "target_room_key_missing_after_membership_joined",
      localRoomKeyCount: 1,
      hasTargetGroupRecord: false,
      hasTargetJoinedMembership: true,
      joinedMembershipCount: 1,
      activeProfileId: "default",
      senderPubkeySuffix: "aaaaaaaa",
      knownGroupHintSample: "m8-replay-group",
      replayBaseUnixMs: baseUnixMs,
    },
  });
  return {
    membershipLedgerLoadCount: 1,
    membershipRecoveryHydrateCount: 1,
    chatStateGroupsUpdateCount: 1,
    roomKeyMissingSendBlockedCount: 1,
  };
};

const buildCp3EvidenceGate = (
  replay: M8CommunityReplayResult | null,
  capture: M8CommunityCaptureBundle | null,
): M8CommunityCp3EvidenceGate => {
  const checks = {
    hasReplayResult: replay !== null,
    hasCaptureBundle: capture !== null,
    hasMembershipRecoveryHydrateEvent: (replay?.emittedEvents.membershipRecoveryHydrateCount ?? 0) >= 1,
    hasMembershipLedgerLoadEvent: (replay?.emittedEvents.membershipLedgerLoadCount ?? 0) >= 1,
    hasRoomKeyMissingSendBlockedEvent: (replay?.emittedEvents.roomKeyMissingSendBlockedCount ?? 0) >= 1,
    hasRecoveryRepairSignal: (
      typeof replay?.latestDigestSummary?.communityLifecycleConvergence?.recoveryRepairSignalCount === "number"
      && replay.latestDigestSummary.communityLifecycleConvergence.recoveryRepairSignalCount >= 1
    ),
    hasJoinedMembershipMismatchSignal: (
      typeof replay?.latestDigestSummary?.membershipSendability?.joinedMembershipRoomKeyMismatchCount === "number"
      && replay.latestDigestSummary.membershipSendability.joinedMembershipRoomKeyMismatchCount >= 1
      && replay.latestDigestSummary.membershipSendability.latestReasonCode
      === "target_room_key_missing_after_membership_joined"
    ),
    hasAccountSwitchScopeSummary: replay?.latestDigestSummary?.accountSwitchScopeConvergence !== null,
    replayReadyForCp2: replay?.replayReadiness?.readyForCp2Evidence === true,
    replayReadyForCp3: replay?.replayReadiness?.readyForCp3Evidence === true,
    captureReadyForCp2: capture?.community?.replayReadiness?.readyForCp2Evidence === true,
    captureReadyForCp3: capture?.community?.replayReadiness?.readyForCp3Evidence === true,
  } as const;

  const failedChecks = Object.entries(checks)
    .filter(([, passed]) => passed !== true)
    .map(([name]) => name);

  return {
    pass: failedChecks.length === 0,
    failedChecks,
    checks,
  };
};

export const installM8CommunityReplayBridge = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  const root = window as M8CommunityReplayWindow;
  if (root.obscurM8CommunityReplay) {
    return;
  }

  let lastReplay: M8CommunityReplayResult | null = null;

  root.obscurM8CommunityReplay = {
    reset: (params) => {
      if (params?.clearAppEvents) {
        root.obscurAppEvents?.clear?.();
      }
      lastReplay = null;
    },
    getLastReplay: () => lastReplay,
    runConvergenceReplay: (params) => {
      if (params?.clearAppEvents) {
        root.obscurAppEvents?.clear?.();
      }
      const baseUnixMs = typeof params?.baseUnixMs === "number" && Number.isFinite(params.baseUnixMs)
        ? Math.floor(params.baseUnixMs)
        : Date.now();
      const captureWindowSize = toPositiveInteger(params?.captureWindowSize, 400);
      const emittedEvents = emitDeterministicConvergenceEvents(baseUnixMs);
      const digestSummary = root.obscurAppEvents?.getCrossDeviceSyncDigest?.(captureWindowSize)?.summary;
      const capture = root.obscurM8CommunityCapture?.capture?.(captureWindowSize) ?? null;
      lastReplay = {
        generatedAtUnixMs: Date.now(),
        replayBaseUnixMs: baseUnixMs,
        emittedEvents,
        latestDigestSummary: digestSummary
          ? {
            communityLifecycleConvergence: digestSummary.communityLifecycleConvergence ?? null,
            membershipSendability: digestSummary.membershipSendability ?? null,
            accountSwitchScopeConvergence: digestSummary.accountSwitchScopeConvergence ?? null,
          }
          : null,
        replayReadiness: capture?.community?.replayReadiness ?? null,
      };
      return lastReplay;
    },
    runConvergenceReplayCapture: (params) => {
      const replay = root.obscurM8CommunityReplay?.runConvergenceReplay(params) ?? null;
      const capture = root.obscurM8CommunityCapture?.capture?.(
        toPositiveInteger(params?.captureWindowSize, 400),
      ) ?? null;
      return {
        replay,
        capture,
        cp3EvidenceGate: buildCp3EvidenceGate(replay, capture),
      };
    },
    runConvergenceReplayCaptureJson: (params) => (
      JSON.stringify(
        root.obscurM8CommunityReplay?.runConvergenceReplayCapture(params) ?? null,
        null,
        2,
      )
    ),
  };
};

export const m8CommunityReplayBridgeInternals = {
  buildCp3EvidenceGate,
};
