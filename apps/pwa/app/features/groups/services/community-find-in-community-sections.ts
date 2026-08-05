import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { isCommunityParticipantInContacts } from "./community-participant-contact-read-model";

export const FIND_IN_COMMUNITY_SECTION_CAP = 50 as const;

export type FindInCommunitySections = Readonly<{
  recentInChat: ReadonlyArray<string>;
  connectionsHere: ReadonlyArray<string>;
  everyoneElse: ReadonlyArray<string>;
}>;

const normalize = (pubkey: string): string => pubkey.trim().toLowerCase();

/**
 * U5 — partition visible members into honest discoverability sections (§2.2).
 * Does not invent roster parity; only reorders local evidence.
 */
export const buildFindInCommunitySections = (params: Readonly<{
  visiblePubkeys: ReadonlyArray<string>;
  authorEvidencePubkeys: ReadonlyArray<string>;
  acceptedPeers: ReadonlyArray<PublicKeyHex>;
  selfPubkey?: PublicKeyHex | null;
  matchesSearch: (pubkey: string) => boolean;
  sectionCap?: number;
}>): FindInCommunitySections => {
  const cap = params.sectionCap ?? FIND_IN_COMMUNITY_SECTION_CAP;
  const visible = params.visiblePubkeys.filter((pubkey) => (
    pubkey.trim().length > 0 && params.matchesSearch(pubkey)
  ));
  const visibleSet = new Set(visible.map(normalize));

  const recentInChat = params.authorEvidencePubkeys
    .filter((pubkey) => visibleSet.has(normalize(pubkey)))
    .filter((pubkey, index, all) => (
      all.findIndex((candidate) => normalize(candidate) === normalize(pubkey)) === index
    ))
    .slice(0, cap);

  const recentSet = new Set(recentInChat.map(normalize));

  const connectionsHere = visible
    .filter((pubkey) => !recentSet.has(normalize(pubkey)))
    .filter((pubkey) => isCommunityParticipantInContacts(
      pubkey,
      params.acceptedPeers,
      params.selfPubkey,
    ))
    .slice(0, cap);

  const connectionsSet = new Set(connectionsHere.map(normalize));

  const everyoneElse = visible
    .filter((pubkey) => (
      !recentSet.has(normalize(pubkey)) && !connectionsSet.has(normalize(pubkey))
    ))
    .slice(0, cap);

  return { recentInChat, connectionsHere, everyoneElse };
};
