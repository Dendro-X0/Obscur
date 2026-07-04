import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

const normalizePubkey = (pubkey: string): string => pubkey.trim().toLowerCase();

/**
 * Layer 0 read model — whether a visible community participant is in the viewer's contacts.
 * Does not mutate roster or membership truth (membership-graph study §2.2).
 */
export const isCommunityParticipantInContacts = (
  pubkey: string,
  acceptedPeers: ReadonlyArray<PublicKeyHex>,
  selfPubkey?: PublicKeyHex | null,
): boolean => {
  const normalized = normalizePubkey(pubkey);
  if (!normalized) {
    return false;
  }
  const self = selfPubkey ? normalizePubkey(selfPubkey) : "";
  if (self.length > 0 && normalized === self) {
    return true;
  }
  return acceptedPeers.some((entry) => normalizePubkey(entry) === normalized);
};

export const listCommunityParticipantsNotInContacts = (
  visiblePubkeys: ReadonlyArray<string>,
  acceptedPeers: ReadonlyArray<PublicKeyHex>,
  selfPubkey?: PublicKeyHex | null,
): ReadonlyArray<string> => (
  visiblePubkeys.filter((pubkey) => (
    !isCommunityParticipantInContacts(pubkey, acceptedPeers, selfPubkey)
  ))
);

export type CommunityParticipantContactCoverage = Readonly<{
  visibleCount: number;
  notInContactsCount: number;
  notInContactsPubkeys: ReadonlyArray<string>;
}>;

export const summarizeCommunityParticipantContactCoverage = (
  visiblePubkeys: ReadonlyArray<string>,
  acceptedPeers: ReadonlyArray<PublicKeyHex>,
  selfPubkey?: PublicKeyHex | null,
): CommunityParticipantContactCoverage => {
  const notInContactsPubkeys = listCommunityParticipantsNotInContacts(
    visiblePubkeys,
    acceptedPeers,
    selfPubkey,
  );
  return {
    visibleCount: visiblePubkeys.length,
    notInContactsCount: notInContactsPubkeys.length,
    notInContactsPubkeys,
  };
};
