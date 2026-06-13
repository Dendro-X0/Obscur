import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunityMembershipLedgerEntry } from "@/app/features/groups/services/community-membership-ledger";
import type { CoordinationMembershipMaterialization } from "@/app/features/groups/services/community-coordination-membership-materializer";
import {
  isSelfActiveInDirectoryMaterialization,
  isSelfListedAsTerminalInDirectory,
} from "@/app/features/relationship-sync/relationship-sync-directory-sidebar-policy";
import { hasTerminalLedgerScopeEvidence } from "@/app/features/workspace-kernel/workspace-kernel-membership-scope";

export const MEMBERSHIP_LEAVE_ZOMBIE_PK = "cc".repeat(32) as PublicKeyHex;
export const MEMBERSHIP_LEAVE_ZOMBIE_PEER = "dd".repeat(32) as PublicKeyHex;
export const MEMBERSHIP_LEAVE_ZOMBIE_GROUP_ID = "newtest-zombie";
export const MEMBERSHIP_LEAVE_ZOMBIE_RELAY = "ws://localhost:7000";

export type MembershipLeaveZombieCaseResult = Readonly<{
  id: string;
  passed: boolean;
  issues: ReadonlyArray<string>;
  qualifiesForRepair: boolean;
}>;

export type MembershipLeaveZombieScenarioResult = Readonly<{
  ok: boolean;
  cases: ReadonlyArray<MembershipLeaveZombieCaseResult>;
}>;

type LeaveZombieCase = Readonly<{
  id: string;
  materialization: CoordinationMembershipMaterialization;
  ledger: ReadonlyArray<CommunityMembershipLedgerEntry>;
  hasLeaveOutbox: boolean;
  expectQualifiesForRepair: boolean;
}>;

const ACTIVE_DIRECTORY: CoordinationMembershipMaterialization = {
  activeMemberPubkeys: [MEMBERSHIP_LEAVE_ZOMBIE_PEER, MEMBERSHIP_LEAVE_ZOMBIE_PK],
  leftMemberPubkeys: [],
  expelledMemberPubkeys: [],
  headSeq: 4,
};

const TERMINAL_LEDGER: ReadonlyArray<CommunityMembershipLedgerEntry> = [{
  communityId: "v2_newtest_zombie",
  groupId: MEMBERSHIP_LEAVE_ZOMBIE_GROUP_ID,
  relayUrl: MEMBERSHIP_LEAVE_ZOMBIE_RELAY,
  status: "left",
}];

const JOINED_LEDGER: ReadonlyArray<CommunityMembershipLedgerEntry> = [{
  communityId: "v2_newtest_zombie",
  groupId: MEMBERSHIP_LEAVE_ZOMBIE_GROUP_ID,
  relayUrl: MEMBERSHIP_LEAVE_ZOMBIE_RELAY,
  status: "joined",
  memberPubkeys: [MEMBERSHIP_LEAVE_ZOMBIE_PEER, MEMBERSHIP_LEAVE_ZOMBIE_PK],
}];

const findJoinedLedgerEntry = (
  ledger: ReadonlyArray<CommunityMembershipLedgerEntry>,
  groupId: string,
  relayUrl: string,
): CommunityMembershipLedgerEntry | undefined => (
  ledger.find((entry) => (
    entry.groupId.trim() === groupId.trim()
    && (entry.relayUrl ?? "").trim() === relayUrl.trim()
    && entry.status === "joined"
  ))
);

/** Dev-lab synthetic gate — mirrors production policy with explicit leave-outbox injection. */
export const evaluateLeaveZombieRepairGate = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  groupId: string;
  relayUrl: string;
  materialization: CoordinationMembershipMaterialization;
  ledger: ReadonlyArray<CommunityMembershipLedgerEntry>;
  hasLeaveOutbox: boolean;
}>): boolean => {
  if (!isSelfActiveInDirectoryMaterialization(params.materialization, params.publicKeyHex)) {
    return false;
  }
  if (isSelfListedAsTerminalInDirectory(params.materialization, params.publicKeyHex)) {
    return false;
  }
  if (params.hasLeaveOutbox) {
    return false;
  }

  if (hasTerminalLedgerScopeEvidence(params.ledger, {
    groupId: params.groupId,
    relayUrl: params.relayUrl,
  })) {
    return true;
  }

  return !findJoinedLedgerEntry(params.ledger, params.groupId, params.relayUrl);
};

const LEAVE_ZOMBIE_CASES: ReadonlyArray<LeaveZombieCase> = [
  {
    id: "intentional_leave_outbox_blocks_repair",
    materialization: ACTIVE_DIRECTORY,
    ledger: TERMINAL_LEDGER,
    hasLeaveOutbox: true,
    expectQualifiesForRepair: false,
  },
  {
    id: "stale_directory_without_outbox_may_repair",
    materialization: ACTIVE_DIRECTORY,
    ledger: TERMINAL_LEDGER,
    hasLeaveOutbox: false,
    expectQualifiesForRepair: true,
  },
  {
    id: "directory_terminal_left_blocks_repair",
    materialization: {
      ...ACTIVE_DIRECTORY,
      activeMemberPubkeys: [MEMBERSHIP_LEAVE_ZOMBIE_PEER],
      leftMemberPubkeys: [MEMBERSHIP_LEAVE_ZOMBIE_PK],
    },
    ledger: TERMINAL_LEDGER,
    hasLeaveOutbox: false,
    expectQualifiesForRepair: false,
  },
  {
    id: "directory_inactive_blocks_repair",
    materialization: {
      ...ACTIVE_DIRECTORY,
      activeMemberPubkeys: [MEMBERSHIP_LEAVE_ZOMBIE_PEER],
    },
    ledger: JOINED_LEDGER,
    hasLeaveOutbox: false,
    expectQualifiesForRepair: false,
  },
];

const evaluateCase = (leaveCase: LeaveZombieCase): MembershipLeaveZombieCaseResult => {
  const qualifiesForRepair = evaluateLeaveZombieRepairGate({
    publicKeyHex: MEMBERSHIP_LEAVE_ZOMBIE_PK,
    groupId: MEMBERSHIP_LEAVE_ZOMBIE_GROUP_ID,
    relayUrl: MEMBERSHIP_LEAVE_ZOMBIE_RELAY,
    materialization: leaveCase.materialization,
    ledger: leaveCase.ledger,
    hasLeaveOutbox: leaveCase.hasLeaveOutbox,
  });
  const passed = qualifiesForRepair === leaveCase.expectQualifiesForRepair;
  const issues = passed
    ? []
    : [`expected_qualifies_${leaveCase.expectQualifiesForRepair}_got_${qualifiesForRepair}`];

  return {
    id: leaveCase.id,
    passed,
    issues,
    qualifiesForRepair,
  };
};

/**
 * E-REL leave zombie synthetic — mirrors NewTest 1 stay-left vs stale-directory repair.
 * Pure policy evaluation; no coordination I/O.
 */
export const evaluateMembershipLeaveZombieScenario = (): MembershipLeaveZombieScenarioResult => {
  const cases = LEAVE_ZOMBIE_CASES.map(evaluateCase);
  return {
    ok: cases.every((entry) => entry.passed),
    cases,
  };
};
