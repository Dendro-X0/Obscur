import type { GroupConversation } from "@/app/features/messaging/types";
import type {
  CommunityDescriptorProjection,
  CommunityMembershipProjection,
} from "@dweb/core/community-projection-contracts";
import type { CommunityMembershipLedgerEntry } from "./community-membership-ledger";
import {
  toCommunityMembershipLedgerEntryFromGroup,
  toCommunityMembershipLedgerKey,
} from "./community-membership-ledger";
import {
  resolveCommunityMembershipRecovery,
  type CommunityMembershipRecoveryDiagnostics,
} from "./community-membership-recovery";
import { hasDurableCommunityLeaveIntent } from "./community-membership-leave-intent";

export type CommunityMembershipEvidenceKind =
  | "user_explicit_leave"
  | "user_explicit_join"
  | "user_explicit_rejoin"
  | "runtime_membership_confirmed"
  | "runtime_invite_accepted"
  | "restore_ledger_snapshot"
  | "restore_chat_state_group"
  | "restore_room_key_invite_accept"
  | "relay_roster_snapshot"
  | "relay_leave_event"
  | "relay_gossip_ingress"
  | "historical_descriptor";

export type CommunityMembershipRuntimeEvidence = Readonly<{
  kind: CommunityMembershipEvidenceKind;
  group: GroupConversation;
  updatedAtUnixMs?: number;
  lastEvidenceEventId?: string;
}>;

export type CommunityMembershipLedgerMutationReason =
  | "persisted_fallback_backfill"
  | "historical_restore_backfill"
  | "explicit_rejoin"
  | "explicit_leave"
  | "relay_roster_terminal"
  | "relay_disbanded"
  | "runtime_join_confirmed";

export type CommunityMembershipLedgerMutation = Readonly<{
  reason: CommunityMembershipLedgerMutationReason;
  entry: CommunityMembershipLedgerEntry;
}>;

export type CommunityMembershipCoordinatorDiagnostics = CommunityMembershipRecoveryDiagnostics & Readonly<{
  explicitTerminalLedgerCount: number;
  runtimeJoinSuppressedByTerminalCount: number;
  explicitRejoinCount: number;
  ledgerMutationCount: number;
}>;

export type CommunityMembershipCoordinatorResult = Readonly<{
  groups: ReadonlyArray<GroupConversation>;
  membershipProjections: ReadonlyArray<CommunityMembershipProjection>;
  descriptorProjections: ReadonlyArray<CommunityDescriptorProjection>;
  ledgerMutations: ReadonlyArray<CommunityMembershipLedgerMutation>;
  diagnostics: CommunityMembershipCoordinatorDiagnostics;
}>;

export type CommunityMembershipRuntimeEvidenceDecision = Readonly<{
  shouldMaterializeGroup: boolean;
  suppressedByTerminalLedger: boolean;
}>;

const TERMINAL_STATUSES = new Set(["left", "expelled"]);

/** Relay-backed or explicit user intent — may commit joined ledger. */
const isAuthoritativeAmbientJoinEvidence = (
  kind: CommunityMembershipEvidenceKind,
): boolean => (
  kind === "runtime_membership_confirmed"
  || kind === "relay_gossip_ingress"
);

/** DM invite-accept observe-only — may widen provisional roster, not authoritative ledger. */
const isProvisionalAmbientJoinEvidence = (
  kind: CommunityMembershipEvidenceKind,
): boolean => kind === "runtime_invite_accepted";

const isTerminalLedgerEntry = (entry: CommunityMembershipLedgerEntry | undefined): boolean => (
  !!entry && TERMINAL_STATUSES.has(entry.status)
);

const toLedgerByKey = (
  entries: ReadonlyArray<CommunityMembershipLedgerEntry>,
): ReadonlyMap<string, CommunityMembershipLedgerEntry> => {
  const byKey = new Map<string, CommunityMembershipLedgerEntry>();
  for (const entry of entries) {
    const key = toCommunityMembershipLedgerKey(entry);
    if (!key) {
      continue;
    }
    const current = byKey.get(key);
    if (!current || (entry.updatedAtUnixMs ?? 0) >= (current.updatedAtUnixMs ?? 0)) {
      byKey.set(key, entry);
    }
  }
  return byKey;
};

const replaceLedgerEntryByKey = (
  entries: ReadonlyArray<CommunityMembershipLedgerEntry>,
  replacement: CommunityMembershipLedgerEntry,
): ReadonlyArray<CommunityMembershipLedgerEntry> => {
  const replacementKey = toCommunityMembershipLedgerKey(replacement);
  if (!replacementKey) {
    return entries;
  }
  return [
    ...entries.filter((entry) => toCommunityMembershipLedgerKey(entry) !== replacementKey),
    replacement,
  ];
};

const toJoinedLedgerEntry = (
  evidence: CommunityMembershipRuntimeEvidence,
  publicKeyHex: string,
): CommunityMembershipLedgerEntry => (
  toCommunityMembershipLedgerEntryFromGroup({
    ...evidence.group,
    creatorPubkey: evidence.group.creatorPubkey ?? publicKeyHex,
  }, {
    status: "joined",
    updatedAtUnixMs: evidence.updatedAtUnixMs,
    lastEvidenceEventId: evidence.lastEvidenceEventId,
  })
);

const bindLedgerEntryToPublicKey = (
  entry: CommunityMembershipLedgerEntry,
  publicKeyHex: string,
): CommunityMembershipLedgerEntry => ({
  ...entry,
  publicKeyHex: entry.publicKeyHex && entry.publicKeyHex.trim().length > 0
    ? entry.publicKeyHex
    : publicKeyHex,
});

export const resolveCommunityMembershipRuntimeEvidenceDecision = (params: Readonly<{
  evidence: CommunityMembershipRuntimeEvidence;
  membershipLedger: ReadonlyArray<CommunityMembershipLedgerEntry>;
}>): CommunityMembershipRuntimeEvidenceDecision => {
  const entry = toJoinedLedgerEntry(params.evidence, "");
  const key = toCommunityMembershipLedgerKey(entry);
  const existingTerminal = key ? toLedgerByKey(params.membershipLedger).get(key) : undefined;
  const isAmbientJoinEvidence = isAuthoritativeAmbientJoinEvidence(params.evidence.kind)
    || isProvisionalAmbientJoinEvidence(params.evidence.kind);
  const suppressedByTerminalLedger = isAmbientJoinEvidence && isTerminalLedgerEntry(existingTerminal);
  return {
    shouldMaterializeGroup: !suppressedByTerminalLedger,
    suppressedByTerminalLedger,
  };
};

export { persistExplicitCommunityMembershipLeave } from "./community-membership-mutation-owner";

export const resolveCommunityMembershipExplicitLeaveMutation = (params: Readonly<{
  publicKeyHex: string;
  group: GroupConversation;
  updatedAtUnixMs?: number;
}>): CommunityMembershipLedgerMutation => ({
  reason: "explicit_leave",
  entry: bindLedgerEntryToPublicKey(toCommunityMembershipLedgerEntryFromGroup({
    ...params.group,
    creatorPubkey: params.group.creatorPubkey ?? params.publicKeyHex,
  }, {
    status: "left",
    updatedAtUnixMs: params.updatedAtUnixMs,
  }), params.publicKeyHex),
});

export const resolveCommunityMembershipRosterSnapshotTerminalMutation = (params: Readonly<{
  publicKeyHex: string;
  group: GroupConversation;
  leftMemberPubkeys: ReadonlyArray<string>;
  expelledMemberPubkeys: ReadonlyArray<string>;
  updatedAtUnixMs?: number;
}>): CommunityMembershipLedgerMutation | null => {
  const publicKeyHex = params.publicKeyHex.trim();
  const expelled = params.expelledMemberPubkeys.map((pubkey) => pubkey.trim()).includes(publicKeyHex);
  const left = params.leftMemberPubkeys.map((pubkey) => pubkey.trim()).includes(publicKeyHex);
  if (!expelled && !left) {
    return null;
  }
  return {
    reason: "relay_roster_terminal",
    entry: bindLedgerEntryToPublicKey(toCommunityMembershipLedgerEntryFromGroup({
      ...params.group,
      creatorPubkey: params.group.creatorPubkey ?? publicKeyHex,
    }, {
      status: expelled ? "expelled" : "left",
      updatedAtUnixMs: params.updatedAtUnixMs,
    }), publicKeyHex),
  };
};

export const resolveCommunityMembershipDisbandMutation = (params: Readonly<{
  publicKeyHex: string;
  group: GroupConversation;
  disbandedAtUnixMs: number;
}>): CommunityMembershipLedgerMutation => {
  const publicKeyHex = params.publicKeyHex.trim();
  const updatedAtUnixMs = Math.max(params.disbandedAtUnixMs, Date.now());
  return {
    reason: "relay_disbanded",
    entry: bindLedgerEntryToPublicKey(toCommunityMembershipLedgerEntryFromGroup({
      ...params.group,
      creatorPubkey: params.group.creatorPubkey ?? publicKeyHex,
    }, {
      status: "left",
      updatedAtUnixMs,
    }), publicKeyHex),
  };
};

export const resolveCommunityMembershipCoordinator = (params: Readonly<{
  publicKeyHex: string;
  profileId: string;
  persistedGroups: ReadonlyArray<GroupConversation>;
  membershipLedger: ReadonlyArray<CommunityMembershipLedgerEntry>;
  tombstones: ReadonlySet<string>;
  runtimeEvidence?: ReadonlyArray<CommunityMembershipRuntimeEvidence>;
  groupMessageAuthorsByConversationId?: Readonly<Record<string, ReadonlyArray<string>>>;
  inviteMemberPubkeysByGroupKey?: Readonly<Record<string, ReadonlyArray<string>>>;
}>): CommunityMembershipCoordinatorResult => {
  let effectiveLedger = params.membershipLedger;
  const explicitTerminalLedgerByKey = toLedgerByKey(params.membershipLedger);
  const additionalLedgerMutations: CommunityMembershipLedgerMutation[] = [];
  let runtimeJoinSuppressedByTerminalCount = 0;
  let explicitRejoinCount = 0;

  // REL-002: historical ledger rows are archival evidence only — never auto-promote to joined on hydrate.

  for (const evidence of params.runtimeEvidence ?? []) {
    const entry = bindLedgerEntryToPublicKey(toJoinedLedgerEntry(evidence, params.publicKeyHex), params.publicKeyHex);
    const key = toCommunityMembershipLedgerKey(entry);
    if (!key) {
      continue;
    }
    const existingTerminal = explicitTerminalLedgerByKey.get(key);
    if (evidence.kind === "user_explicit_rejoin" || evidence.kind === "user_explicit_join") {
      effectiveLedger = replaceLedgerEntryByKey(effectiveLedger, entry);
      additionalLedgerMutations.push({ reason: "explicit_rejoin", entry });
      explicitRejoinCount += 1;
      continue;
    }
    if (
      (
        isAuthoritativeAmbientJoinEvidence(evidence.kind)
        || isProvisionalAmbientJoinEvidence(evidence.kind)
      )
      && isTerminalLedgerEntry(existingTerminal)
    ) {
      runtimeJoinSuppressedByTerminalCount += 1;
      continue;
    }
    if (isAuthoritativeAmbientJoinEvidence(evidence.kind)) {
      effectiveLedger = replaceLedgerEntryByKey(effectiveLedger, entry);
      additionalLedgerMutations.push({ reason: "runtime_join_confirmed", entry });
    }
  }

  const recovery = resolveCommunityMembershipRecovery({
    publicKeyHex: params.publicKeyHex,
    profileId: params.profileId,
    persistedGroups: params.persistedGroups,
    membershipLedger: effectiveLedger,
    tombstones: params.tombstones,
    groupMessageAuthorsByConversationId: params.groupMessageAuthorsByConversationId,
    inviteMemberPubkeysByGroupKey: params.inviteMemberPubkeysByGroupKey,
  });
  const fallbackMutations = recovery.missingLedgerCoverageEntries
    .filter((entry) => {
      const ledgerKey = toCommunityMembershipLedgerKey(entry);
      const groupId = entry.groupId?.trim() ?? "";
      const relayUrl = entry.relayUrl?.trim() ?? "";
      if (!ledgerKey || groupId.length === 0 || relayUrl.length === 0) {
        return true;
      }
      return !hasDurableCommunityLeaveIntent({
        publicKeyHex: params.publicKeyHex,
        profileId: params.profileId,
        groupId,
        relayUrl,
        ledgerEntry: explicitTerminalLedgerByKey.get(ledgerKey),
        tombstones: params.tombstones,
      });
    })
    .map((entry) => ({
      reason: "persisted_fallback_backfill" as const,
      entry: bindLedgerEntryToPublicKey(entry, params.publicKeyHex),
    }));
  const ledgerMutations = [...additionalLedgerMutations, ...fallbackMutations];

  return {
    groups: recovery.groups,
    membershipProjections: recovery.membershipProjections,
    descriptorProjections: recovery.descriptorProjections,
    ledgerMutations,
    diagnostics: {
      ...recovery.diagnostics,
      explicitTerminalLedgerCount: Array.from(explicitTerminalLedgerByKey.values()).filter(isTerminalLedgerEntry).length,
      runtimeJoinSuppressedByTerminalCount,
      explicitRejoinCount,
      ledgerMutationCount: ledgerMutations.length,
    },
  };
};
