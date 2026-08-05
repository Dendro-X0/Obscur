import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { dedupeCommunityMemberPubkeys } from "./community-member-roster-projection";

export const COMMUNITY_HEADER_MEMBER_METRICS_OWNER_ID = "community-header-member-metrics" as const;

export type CommunityHeaderMemberCountSource = "directory" | "known_here";

export type CommunityHeaderMemberMetrics = Readonly<{
  memberCount: number;
  memberCountSource: CommunityHeaderMemberCountSource;
  directoryFetchedAtUnixMs: number | null;
  onlineAmongVisible: number;
  visibleForPresenceCount: number;
}>;

/**
 * U5 Wave B / membership study §2.3 — one labeled local source for header counts.
 * Never invents cross-client roster parity or global "online in community."
 */
export const resolveCommunityHeaderMemberMetrics = (params: Readonly<{
  /** When non-null, a directory snapshot exists for this community (may be empty after leave). */
  directoryActivePubkeys?: ReadonlyArray<PublicKeyHex> | null;
  directoryFetchedAtUnixMs?: number | null;
  knownHerePubkeys: ReadonlyArray<PublicKeyHex>;
  isPeerOnline: (pubkey: PublicKeyHex) => boolean;
}>): CommunityHeaderMemberMetrics => {
  const knownHere = dedupeCommunityMemberPubkeys(params.knownHerePubkeys);
  const useDirectory = params.directoryActivePubkeys != null;
  const directoryActive = useDirectory
    ? dedupeCommunityMemberPubkeys(params.directoryActivePubkeys ?? [])
    : [];

  const memberCount = useDirectory
    ? directoryActive.length
    : Math.max(knownHere.length, 1);
  const memberCountSource: CommunityHeaderMemberCountSource = useDirectory
    ? "directory"
    : "known_here";

  const presenceSet = useDirectory && directoryActive.length > 0
    ? directoryActive
    : knownHere;
  const onlineAmongVisible = presenceSet.filter((pubkey) => params.isPeerOnline(pubkey)).length;

  return {
    memberCount,
    memberCountSource,
    directoryFetchedAtUnixMs: useDirectory
      ? (params.directoryFetchedAtUnixMs ?? null)
      : null,
    onlineAmongVisible,
    visibleForPresenceCount: presenceSet.length,
  };
};
