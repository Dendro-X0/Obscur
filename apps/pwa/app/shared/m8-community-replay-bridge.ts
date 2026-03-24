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
  }> | null;
  replayReadiness: M8CommunityCaptureBundle["community"]["replayReadiness"] | null;
}>;

type M8CommunityReplayApi = Readonly<{
  reset: (params?: Readonly<{ clearAppEvents?: boolean }>) => void;
  getLastReplay: () => M8CommunityReplayResult | null;
  runConvergenceReplay: (params?: Readonly<{
    baseUnixMs?: number;
    captureWindowSize?: number;
    clearAppEvents?: boolean;
  }>) => M8CommunityReplayResult;
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
          }
          : null,
        replayReadiness: capture?.community?.replayReadiness ?? null,
      };
      return lastReplay;
    },
    runConvergenceReplayCaptureJson: (params) => (
      JSON.stringify(
        {
          replay: root.obscurM8CommunityReplay?.runConvergenceReplay(params) ?? null,
          capture: root.obscurM8CommunityCapture?.capture?.(
            toPositiveInteger(params?.captureWindowSize, 400),
          ) ?? null,
        },
        null,
        2,
      )
    ),
  };
};
