import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

export type OperatorSignalSeverity = "info" | "warn" | "critical";

export type CommunityOperatorSignal = Readonly<{
  id: string;
  severity: OperatorSignalSeverity;
  label: string;
  detail: string;
}>;

export type CommunityOperatorHealthSummary = Readonly<{
  activeMemberCount: number;
  knownMemberCount: number;
  onlineMemberCount: number;
  offlineMemberCount: number;
  leftMemberCount: number;
  expelledMemberCount: number;
  disbanded: boolean;
  quorumThreshold: number;
  targetsWithKickVotes: number;
  totalKickVotes: number;
  highestKickPressure: Readonly<{
    targetPubkey: PublicKeyHex;
    voteCount: number;
    ratio: number;
    nearQuorum: boolean;
  }> | null;
  signals: ReadonlyArray<CommunityOperatorSignal>;
}>;

type CommunityOperatorHealthInput = Readonly<{
  activeMembers: ReadonlyArray<PublicKeyHex>;
  leftMembers: ReadonlyArray<PublicKeyHex>;
  expelledMembers: ReadonlyArray<PublicKeyHex>;
  onlineMemberCount: number;
  kickVotes: Readonly<Record<PublicKeyHex, ReadonlyArray<string>>>;
  disbandedAt?: number;
}>;

const dedupePublicKeys = (keys: ReadonlyArray<PublicKeyHex>): ReadonlyArray<PublicKeyHex> => {
  if (keys.length <= 1) return keys;
  return Array.from(new Set(keys));
};

const clampOnlineCount = (onlineMemberCount: number, activeMemberCount: number): number => {
  if (!Number.isFinite(onlineMemberCount)) return 0;
  return Math.min(Math.max(0, Math.floor(onlineMemberCount)), activeMemberCount);
};

const toPubkeyHint = (publicKeyHex: string): string => {
  if (publicKeyHex.length <= 16) return publicKeyHex;
  return `${publicKeyHex.slice(0, 8)}...${publicKeyHex.slice(-4)}`;
};

export const summarizeCommunityOperatorHealth = (
  input: CommunityOperatorHealthInput
): CommunityOperatorHealthSummary => {
  const activeMembers = dedupePublicKeys(input.activeMembers);
  const leftMembers = dedupePublicKeys(input.leftMembers);
  const expelledMembers = dedupePublicKeys(input.expelledMembers);

  const activeMemberCount = activeMembers.length;
  const onlineMemberCount = clampOnlineCount(input.onlineMemberCount, activeMemberCount);
  const offlineMemberCount = Math.max(0, activeMemberCount - onlineMemberCount);

  const knownMembers = new Set<PublicKeyHex>([
    ...activeMembers,
    ...leftMembers,
    ...expelledMembers,
  ]);
  const knownMemberCount = knownMembers.size;

  const quorumThreshold = activeMemberCount > 0
    ? Math.floor(activeMemberCount / 2) + 1
    : 0;

  const kickVoteEntries = Object.entries(input.kickVotes)
    .map(([targetPubkey, voters]) => ({
      targetPubkey: targetPubkey as PublicKeyHex,
      voteCount: new Set(voters).size,
    }))
    .filter((entry) => entry.voteCount > 0)
    .sort((a, b) => (
      b.voteCount - a.voteCount
      || a.targetPubkey.localeCompare(b.targetPubkey)
    ));

  const totalKickVotes = kickVoteEntries.reduce((sum, entry) => sum + entry.voteCount, 0);
  const highestEntry = kickVoteEntries[0];
  const highestKickPressure = highestEntry
    ? {
      targetPubkey: highestEntry.targetPubkey,
      voteCount: highestEntry.voteCount,
      ratio: quorumThreshold > 0
        ? Number((highestEntry.voteCount / quorumThreshold).toFixed(2))
        : 0,
      nearQuorum: quorumThreshold > 0
        && highestEntry.voteCount >= Math.max(1, quorumThreshold - 1),
    }
    : null;

  const signals: CommunityOperatorSignal[] = [];
  if (input.disbandedAt !== undefined) {
    signals.push({
      id: "community_disbanded",
      severity: "critical",
      label: "Community disbanded",
      detail: "Ledger indicates this community has been disbanded. Posting is expected to fail until recreated.",
    });
  }
  if (activeMemberCount === 0 && input.disbandedAt === undefined) {
    signals.push({
      id: "no_active_members",
      severity: "warn",
      label: "No active members",
      detail: "No active members are currently in the ledger; check membership convergence and recovery.",
    });
  }
  if (highestKickPressure) {
    signals.push({
      id: "kick_vote_pressure",
      severity: highestKickPressure.nearQuorum ? "critical" : "warn",
      label: "Kick vote pressure",
      detail: `Highest target ${toPubkeyHint(highestKickPressure.targetPubkey)} is at ${highestKickPressure.voteCount}/${Math.max(quorumThreshold, 1)} votes.`,
    });
  }
  if (expelledMembers.length > 0) {
    signals.push({
      id: "expelled_members_present",
      severity: "warn",
      label: "Expelled members present",
      detail: `${expelledMembers.length} member${expelledMembers.length === 1 ? "" : "s"} marked as expelled in the ledger.`,
    });
  }
  if (leftMembers.length > 0) {
    signals.push({
      id: "left_members_present",
      severity: leftMembers.length >= Math.max(2, Math.ceil(activeMemberCount / 2)) ? "warn" : "info",
      label: "Voluntary departures recorded",
      detail: `${leftMembers.length} member${leftMembers.length === 1 ? "" : "s"} left this community.`,
    });
  }
  if (onlineMemberCount === 0 && activeMemberCount > 0) {
    signals.push({
      id: "no_members_online",
      severity: "info",
      label: "No members online",
      detail: "No active members are currently online according to local presence signals.",
    });
  }
  if (signals.length === 0) {
    signals.push({
      id: "community_stable",
      severity: "info",
      label: "Community stable",
      detail: "No immediate governance or membership risk signals detected.",
    });
  }

  return {
    activeMemberCount,
    knownMemberCount,
    onlineMemberCount,
    offlineMemberCount,
    leftMemberCount: leftMembers.length,
    expelledMemberCount: expelledMembers.length,
    disbanded: input.disbandedAt !== undefined,
    quorumThreshold,
    targetsWithKickVotes: kickVoteEntries.length,
    totalKickVotes,
    highestKickPressure,
    signals,
  };
};

