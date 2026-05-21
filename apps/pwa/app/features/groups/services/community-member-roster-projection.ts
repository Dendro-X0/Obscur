import type { GroupConversation } from "@/app/features/messaging/types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

export type CommunityMemberRosterProjection = Readonly<{
  allKnownMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  activeMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  leftMemberPubkeys: ReadonlySet<PublicKeyHex>;
  expelledMemberPubkeys: ReadonlySet<PublicKeyHex>;
}>;

export type CommunityMemberSnapshotApplication = Readonly<{
  shouldApply: boolean;
  reasonCode: "equivalent" | "apply_snapshot" | "apply_snapshot_guard_relaxed" | "missing_removal_evidence";
  nextMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  removedWithoutEvidence: ReadonlyArray<PublicKeyHex>;
}>;

export type CommunityRosterProjection = Readonly<{
  conversationId: string;
  groupId: string;
  relayUrl: string;
  communityId?: string;
  activeMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  memberCount: number;
}>;

export type RelayEvidenceConfidence = "seed_only" | "warming_up" | "partial_eose" | "steady_state" | "unknown";

export type StabilizeCommunityMemberPubkeysParams = Readonly<{
  currentMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  incomingActiveMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  leftMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  expelledMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  relayEvidenceConfidence?: RelayEvidenceConfidence;
}>;

export type StabilizeCommunityMemberPubkeysResult = Readonly<{
  shouldApply: boolean;
  reasonCode: "equivalent" | "apply_snapshot" | "apply_snapshot_guard_relaxed" | "missing_removal_evidence";
  nextMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  removedWithoutEvidence: ReadonlyArray<PublicKeyHex>;
  confidence: RelayEvidenceConfidence;
  guardRelaxed: boolean;
}>;

/** Union current ∪ incoming; never drops current members unless excluded (leave/expel). */
export const mergeMonotonicActiveCommunityMembers = (
  current: ReadonlyArray<PublicKeyHex>,
  incoming: ReadonlyArray<PublicKeyHex>,
  options?: Readonly<{
    excludePubkeys?: ReadonlyArray<PublicKeyHex>;
    additionalPubkeys?: ReadonlyArray<PublicKeyHex>;
  }>,
): ReadonlyArray<PublicKeyHex> => {
  const exclude = new Set(
    (options?.excludePubkeys ?? []).map((pubkey) => pubkey.trim()).filter((pubkey) => pubkey.length > 0),
  );
  return dedupeCommunityMemberPubkeys([
    ...current,
    ...incoming,
    ...(options?.additionalPubkeys ?? []),
  ]).filter((pubkey) => !exclude.has(pubkey.trim()));
};

export type ResolveCommunityRosterSnapshotNextMembersParams = Readonly<{
  currentMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  snapshotNextMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  leftMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  expelledMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  protectRemovalPubkeys?: ReadonlyArray<PublicKeyHex>;
  guardRelaxed?: boolean;
}>;

/**
 * Materialize roster projection updates from relay snapshots.
 * Widens monotonically when the snapshot would drop members without leave/expel evidence.
 */
export const resolveCommunityRosterSnapshotNextMembers = (
  params: ResolveCommunityRosterSnapshotNextMembersParams,
): ReadonlyArray<PublicKeyHex> => {
  const leftMemberPubkeys = params.leftMemberPubkeys ?? [];
  const expelledMemberPubkeys = params.expelledMemberPubkeys ?? [];
  const leftSet = new Set(leftMemberPubkeys.map((pubkey) => pubkey.trim()).filter((pubkey) => pubkey.length > 0));
  const expelledSet = new Set(expelledMemberPubkeys.map((pubkey) => pubkey.trim()).filter((pubkey) => pubkey.length > 0));
  const excludePubkeys = [...leftMemberPubkeys, ...expelledMemberPubkeys];
  const currentMemberPubkeys = dedupeCommunityMemberPubkeys(params.currentMemberPubkeys);
  const snapshotNextMemberPubkeys = dedupeCommunityMemberPubkeys(params.snapshotNextMemberPubkeys)
    .filter((pubkey) => !leftSet.has(pubkey.trim()) && !expelledSet.has(pubkey.trim()));
  const removedWithoutEvidence = currentMemberPubkeys.filter((pubkey) => (
    !snapshotNextMemberPubkeys.includes(pubkey)
    && !leftSet.has(pubkey.trim())
    && !expelledSet.has(pubkey.trim())
  ));
  if (removedWithoutEvidence.length > 0 || params.guardRelaxed) {
    return mergeMonotonicActiveCommunityMembers(
      currentMemberPubkeys,
      snapshotNextMemberPubkeys,
      {
        excludePubkeys,
        additionalPubkeys: params.protectRemovalPubkeys,
      },
    );
  }
  return snapshotNextMemberPubkeys;
};

export const dedupeCommunityMemberPubkeys = (
  values: ReadonlyArray<PublicKeyHex>,
): ReadonlyArray<PublicKeyHex> => (
  Array.from(new Set(
    values
      .map((value) => value.trim() as PublicKeyHex)
      .filter((value) => value.length > 0)
  ))
);

export const projectCommunityMemberRoster = (params: Readonly<{
  seededMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  liveMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  authorEvidencePubkeys?: ReadonlyArray<PublicKeyHex>;
  localMemberPubkey?: PublicKeyHex | null;
  leftMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  expelledMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
}>): CommunityMemberRosterProjection => {
  const allKnownMemberPubkeys = dedupeCommunityMemberPubkeys([
    ...(params.seededMemberPubkeys ?? []),
    ...(params.liveMemberPubkeys ?? []),
    ...(params.authorEvidencePubkeys ?? []),
    ...(params.localMemberPubkey ? [params.localMemberPubkey] : []),
  ]);
  const normalizePk = (pubkey: PublicKeyHex): string => pubkey.trim().toLowerCase();
  const leftMemberPubkeys = new Set((params.leftMemberPubkeys ?? []).map(normalizePk));
  const expelledMemberPubkeys = new Set((params.expelledMemberPubkeys ?? []).map(normalizePk));
  return {
    allKnownMemberPubkeys,
    /** Terminal lists are pre-filtered upstream when chat participation disproves stale relay leave. */
    activeMemberPubkeys: allKnownMemberPubkeys.filter((pubkey) => (
      !leftMemberPubkeys.has(normalizePk(pubkey)) && !expelledMemberPubkeys.has(normalizePk(pubkey))
    )),
    leftMemberPubkeys,
    expelledMemberPubkeys,
  };
};

export const seedCommunityMemberLedgerMembers = (params: Readonly<{
  initialMembers?: ReadonlyArray<PublicKeyHex>;
  localMemberPubkey?: PublicKeyHex | null;
  hasLocalMembershipEvidence: boolean;
}>): ReadonlyArray<PublicKeyHex> => (
  dedupeCommunityMemberPubkeys([
    ...(params.initialMembers ?? []),
    ...(params.hasLocalMembershipEvidence && params.localMemberPubkey ? [params.localMemberPubkey] : []),
  ])
);

export const resolveCommunityMemberSnapshotApplication = (params: Readonly<{
  currentMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  incomingActiveMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  leftMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  expelledMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
}>): CommunityMemberSnapshotApplication => {
  const nextMemberPubkeys = dedupeCommunityMemberPubkeys(params.incomingActiveMemberPubkeys);
  const currentMemberPubkeys = dedupeCommunityMemberPubkeys(params.currentMemberPubkeys);
  const leftMemberPubkeys = new Set(params.leftMemberPubkeys ?? []);
  const expelledMemberPubkeys = new Set(params.expelledMemberPubkeys ?? []);
  const removedWithoutEvidence = currentMemberPubkeys.filter((pubkey) => (
    !nextMemberPubkeys.includes(pubkey)
    && !leftMemberPubkeys.has(pubkey)
    && !expelledMemberPubkeys.has(pubkey)
  ));
  if (removedWithoutEvidence.length > 0) {
    return {
      shouldApply: false,
      reasonCode: "missing_removal_evidence",
      nextMemberPubkeys: currentMemberPubkeys,
      removedWithoutEvidence,
    };
  }
  if (currentMemberPubkeys.join(",") === nextMemberPubkeys.join(",")) {
    return {
      shouldApply: false,
      reasonCode: "equivalent",
      nextMemberPubkeys: currentMemberPubkeys,
      removedWithoutEvidence: [],
    };
  }
  return {
    shouldApply: true,
    reasonCode: "apply_snapshot",
    nextMemberPubkeys,
    removedWithoutEvidence: [],
  };
};

/**
 * Thinner-snapshot guard: reject apparent member drops without leave/expel evidence,
 * except during relay warm-up (`seed_only`, or `warming_up` with a tiny current roster).
 *
 * Canonical implementation; `community-visible-members` exposes a `previous`/`next` adapter.
 */
export const stabilizeCommunityMemberPubkeys = (
  params: StabilizeCommunityMemberPubkeysParams,
): StabilizeCommunityMemberPubkeysResult => {
  const nextMemberPubkeys = dedupeCommunityMemberPubkeys(params.incomingActiveMemberPubkeys);
  const currentMemberPubkeys = dedupeCommunityMemberPubkeys(params.currentMemberPubkeys);
  const leftMemberPubkeys = new Set(params.leftMemberPubkeys ?? []);
  const expelledMemberPubkeys = new Set(params.expelledMemberPubkeys ?? []);

  const removedWithoutEvidence = currentMemberPubkeys.filter((pubkey) => (
    !nextMemberPubkeys.includes(pubkey)
    && !leftMemberPubkeys.has(pubkey)
    && !expelledMemberPubkeys.has(pubkey)
  ));

  const isRelayWarmUp = params.relayEvidenceConfidence === "seed_only" ||
    (params.relayEvidenceConfidence === "warming_up" && currentMemberPubkeys.length <= 2);

  if (removedWithoutEvidence.length > 0 && !isRelayWarmUp) {
    return {
      shouldApply: false,
      reasonCode: "missing_removal_evidence",
      nextMemberPubkeys: currentMemberPubkeys,
      removedWithoutEvidence,
      confidence: params.relayEvidenceConfidence ?? "unknown",
      guardRelaxed: false,
    };
  }

  if (currentMemberPubkeys.join(",") === nextMemberPubkeys.join(",")) {
    return {
      shouldApply: false,
      reasonCode: "equivalent",
      nextMemberPubkeys: currentMemberPubkeys,
      removedWithoutEvidence: [],
      confidence: params.relayEvidenceConfidence ?? "unknown",
      guardRelaxed: isRelayWarmUp && removedWithoutEvidence.length > 0,
    };
  }

  const monotonicNextMemberPubkeys = removedWithoutEvidence.length > 0 && isRelayWarmUp
    ? mergeMonotonicActiveCommunityMembers(currentMemberPubkeys, nextMemberPubkeys, {
      excludePubkeys: [
        ...(params.leftMemberPubkeys ?? []),
        ...(params.expelledMemberPubkeys ?? []),
      ],
    })
    : nextMemberPubkeys;

  return {
    shouldApply: true,
    reasonCode: removedWithoutEvidence.length > 0 && isRelayWarmUp
      ? "apply_snapshot_guard_relaxed"
      : "apply_snapshot",
    nextMemberPubkeys: monotonicNextMemberPubkeys,
    removedWithoutEvidence: [],
    confidence: params.relayEvidenceConfidence ?? "unknown",
    guardRelaxed: isRelayWarmUp && removedWithoutEvidence.length > 0,
  };
};

export const buildCommunityRosterProjection = (
  group: GroupConversation,
): CommunityRosterProjection => {
  const activeMemberPubkeys = dedupeCommunityMemberPubkeys(
    group.memberPubkeys as ReadonlyArray<PublicKeyHex>,
  );
  return {
    conversationId: group.id,
    groupId: group.groupId,
    relayUrl: group.relayUrl,
    communityId: group.communityId,
    activeMemberPubkeys,
    memberCount: Math.max(activeMemberPubkeys.length, 1),
  };
};

export const buildCommunityRosterProjectionByConversationId = (
  groups: ReadonlyArray<GroupConversation>,
): Readonly<Record<string, CommunityRosterProjection>> => (
  Object.fromEntries(
    groups.map((group) => [group.id, buildCommunityRosterProjection(group)])
  )
);
