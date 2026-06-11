import { logAppEvent } from "@/app/shared/log-app-event";
import type { GroupConversation } from "@/app/features/messaging/types";
import {
  loadCommunityMembershipLedger,
  replaceCommunityMembershipLedger,
  toCommunityMembershipLedgerKey,
  upsertCommunityMembershipLedgerEntry,
} from "./community-membership-ledger";
import {
  resolveCommunityMembershipCoordinator,
  resolveCommunityMembershipDisbandMutation,
  resolveCommunityMembershipExplicitLeaveMutation,
  resolveCommunityMembershipRosterSnapshotTerminalMutation,
  type CommunityMembershipLedgerMutation,
  type CommunityMembershipRuntimeEvidence,
} from "./community-membership-coordinator";
import { clearDurableCommunityLeaveIntentOnExplicitRejoin } from "./community-membership-leave-intent";
import {
  isRelayAuthoritativeMembershipEnforced,
  relayMembershipRequiresRelayConfirmation,
} from "./community-relay-authoritative-membership-policy";

export const COMMUNITY_MEMBERSHIP_MUTATION_OWNER_ID = "community-membership-mutation-owner" as const;

/** Allowed live writers: this module (+ restore bulk via `saveCommunityMembershipLedger`). */
export const applyCommunityMembershipLedgerMutations = (
  publicKeyHex: string,
  mutations: ReadonlyArray<CommunityMembershipLedgerMutation>,
  options?: Readonly<{ profileId?: string }>,
): void => {
  for (const mutation of mutations) {
    persistCommunityMembershipLedgerMutation(publicKeyHex, mutation, options);
  }
};

export const persistCommunityMembershipLedgerMutation = (
  publicKeyHex: string,
  mutation: CommunityMembershipLedgerMutation,
  options?: Readonly<{ profileId?: string }>,
): void => {
  if (mutation.reason === "explicit_rejoin") {
    const ledgerKey = toCommunityMembershipLedgerKey(mutation.entry);
    const current = loadCommunityMembershipLedger(publicKeyHex, options);
    const withoutKey = ledgerKey
      ? current.filter((entry) => toCommunityMembershipLedgerKey(entry) !== ledgerKey)
      : current;
    replaceCommunityMembershipLedger(publicKeyHex, [...withoutKey, mutation.entry], options);
  } else {
    upsertCommunityMembershipLedgerEntry(publicKeyHex, mutation.entry, options);
  }
  logAppEvent({
    name: "groups.membership_mutation_owner_committed",
    level: "info",
    scope: { feature: "groups", action: "membership_mutation_owner" },
    context: {
      owner: COMMUNITY_MEMBERSHIP_MUTATION_OWNER_ID,
      reason: mutation.reason,
      groupId: mutation.entry.groupId,
      relayUrl: mutation.entry.relayUrl ?? null,
      status: mutation.entry.status,
      profileId: options?.profileId ?? null,
    },
  });
};

export const persistExplicitCommunityMembershipLeave = (params: Readonly<{
  publicKeyHex: string;
  group: GroupConversation;
  profileId?: string;
  updatedAtUnixMs?: number;
  lastEvidenceEventId?: string;
  relayConfirmed?: boolean;
}>): CommunityMembershipLedgerMutation | null => {
  if (!relayMembershipRequiresRelayConfirmation(params.relayConfirmed)) {
    logAppEvent({
      name: "groups.membership_local_leave_suppressed",
      level: "info",
      scope: { feature: "groups", action: "membership_mutation_owner" },
      context: {
        owner: COMMUNITY_MEMBERSHIP_MUTATION_OWNER_ID,
        groupId: params.group.groupId,
        relayUrl: params.group.relayUrl ?? null,
        reason: "relay_authoritative",
      },
    });
    return null;
  }
  const mutation = resolveCommunityMembershipExplicitLeaveMutation({
    publicKeyHex: params.publicKeyHex,
    group: params.group,
    updatedAtUnixMs: params.updatedAtUnixMs,
  });
  persistCommunityMembershipLedgerMutation(params.publicKeyHex, {
    reason: mutation.reason,
    entry: {
      ...mutation.entry,
      ...(params.lastEvidenceEventId !== undefined
        ? { lastEvidenceEventId: params.lastEvidenceEventId }
        : {}),
      ...(params.updatedAtUnixMs !== undefined
        ? { updatedAtUnixMs: params.updatedAtUnixMs }
        : {}),
    },
  }, { profileId: params.profileId });
  return mutation;
};

export const persistCommunityMembershipRosterTerminal = (params: Readonly<{
  publicKeyHex: string;
  group: GroupConversation;
  leftMemberPubkeys: ReadonlyArray<string>;
  expelledMemberPubkeys: ReadonlyArray<string>;
  updatedAtUnixMs?: number;
  profileId?: string;
}>): CommunityMembershipLedgerMutation | null => {
  const mutation = resolveCommunityMembershipRosterSnapshotTerminalMutation(params);
  if (!mutation) {
    return null;
  }
  persistCommunityMembershipLedgerMutation(params.publicKeyHex, mutation, { profileId: params.profileId });
  return mutation;
};

export const persistCommunityMembershipDisband = (params: Readonly<{
  publicKeyHex: string;
  group: GroupConversation;
  disbandedAtUnixMs: number;
  profileId?: string;
}>): CommunityMembershipLedgerMutation => {
  const mutation = resolveCommunityMembershipDisbandMutation(params);
  persistCommunityMembershipLedgerMutation(params.publicKeyHex, mutation, { profileId: params.profileId });
  return mutation;
};

export const applyCommunityMembershipRuntimeEvidence = (params: Readonly<{
  publicKeyHex: string;
  profileId: string;
  evidence: CommunityMembershipRuntimeEvidence;
  membershipLedger: ReadonlyArray<import("./community-membership-ledger").CommunityMembershipLedgerEntry>;
  tombstones: ReadonlySet<string>;
  relayConfirmed?: boolean;
}>): ReturnType<typeof resolveCommunityMembershipCoordinator> => {
  const isExplicitJoinEvidence = params.evidence.kind === "user_explicit_join"
    || params.evidence.kind === "user_explicit_rejoin";
  if (isExplicitJoinEvidence && !relayMembershipRequiresRelayConfirmation(params.relayConfirmed)) {
    logAppEvent({
      name: "groups.membership_local_join_suppressed",
      level: "info",
      scope: { feature: "groups", action: "membership_mutation_owner" },
      context: {
        owner: COMMUNITY_MEMBERSHIP_MUTATION_OWNER_ID,
        groupId: params.evidence.group.groupId,
        relayUrl: params.evidence.group.relayUrl ?? null,
        kind: params.evidence.kind,
        reason: "relay_authoritative",
      },
    });
    return resolveCommunityMembershipCoordinator({
      publicKeyHex: params.publicKeyHex,
      profileId: params.profileId,
      persistedGroups: [],
      membershipLedger: params.membershipLedger,
      tombstones: params.tombstones,
    });
  }
  const coordinator = resolveCommunityMembershipCoordinator({
    publicKeyHex: params.publicKeyHex,
    profileId: params.profileId,
    persistedGroups: [],
    membershipLedger: params.membershipLedger,
    tombstones: params.tombstones,
    runtimeEvidence: [params.evidence],
  });
  applyCommunityMembershipLedgerMutations(
    params.publicKeyHex,
    coordinator.ledgerMutations,
    { profileId: params.profileId },
  );
  for (const mutation of coordinator.ledgerMutations) {
    if (mutation.reason !== "explicit_rejoin") {
      continue;
    }
    const groupId = mutation.entry.groupId?.trim() ?? "";
    const relayUrl = mutation.entry.relayUrl?.trim() ?? "";
    if (groupId.length === 0 || relayUrl.length === 0) {
      continue;
    }
    clearDurableCommunityLeaveIntentOnExplicitRejoin({
      publicKeyHex: params.publicKeyHex,
      groupId,
      relayUrl,
      profileId: params.profileId,
    });
  }
  return coordinator;
};
