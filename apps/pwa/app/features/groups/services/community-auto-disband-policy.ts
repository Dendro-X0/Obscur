import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

const normalizePubkey = (value: string): string => value.trim().toLowerCase();

const dedupePubkeys = (values: ReadonlyArray<string>): ReadonlyArray<PublicKeyHex> => {
  const seen = new Set<string>();
  const out: PublicKeyHex[] = [];
  values.forEach((value) => {
    const normalized = normalizePubkey(value);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    out.push(normalized as PublicKeyHex);
  });
  return out;
};

export type CommunityAutoDisbandOnLeaveDecision = Readonly<{
  activeMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  remainingKnownMembers: ReadonlyArray<PublicKeyHex>;
  shouldAttemptAutoDisband: boolean;
}>;

/**
 * Decide whether the leaver is the last known participant before publishing a disband event.
 * Uses seeded roster evidence (directory / persisted group members) in addition to live CRDT
 * members so a stale relay roster cannot disband a community that still has local join evidence.
 */
export const resolveCommunityAutoDisbandOnLeaveDecision = (params: Readonly<{
  liveMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  seededMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  leftMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  expelledMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  myPublicKeyHex: PublicKeyHex | null;
}>): CommunityAutoDisbandOnLeaveDecision => {
  const leftSet = new Set(params.leftMemberPubkeys.map(normalizePubkey));
  const expelledSet = new Set(params.expelledMemberPubkeys.map(normalizePubkey));
  const activeMemberPubkeys = dedupePubkeys([
    ...(params.seededMemberPubkeys ?? []),
    ...params.liveMemberPubkeys,
  ]).filter((pubkey) => (
    !leftSet.has(normalizePubkey(pubkey))
    && !expelledSet.has(normalizePubkey(pubkey))
  ));
  const myKey = params.myPublicKeyHex?.trim() ?? "";
  const remainingKnownMembers = myKey.length > 0
    ? activeMemberPubkeys.filter((pubkey) => normalizePubkey(pubkey) !== normalizePubkey(myKey))
    : activeMemberPubkeys;
  return {
    activeMemberPubkeys,
    remainingKnownMembers,
    shouldAttemptAutoDisband: remainingKnownMembers.length === 0,
  };
};
