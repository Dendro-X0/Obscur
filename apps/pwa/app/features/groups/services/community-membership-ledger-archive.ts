import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { GroupConversation } from "@/app/features/messaging/types";
import {
  isTerminalCommunityMembershipLedgerEntry,
  loadCommunityMembershipLedger,
  type CommunityMembershipLedgerEntry,
} from "./community-membership-ledger";
import { isGroupTombstoned } from "./group-tombstone-store";
import { communityMembershipScopeMatches } from "./community-membership-scope-key";

export type ArchivedCommunityMembershipLedgerRow = Readonly<{
  entry: CommunityMembershipLedgerEntry;
  tombstoned: boolean;
  visibleInSidebar: boolean;
}>;

const matchesVisibleGroup = (
  entry: CommunityMembershipLedgerEntry,
  visibleGroups: ReadonlyArray<GroupConversation>,
): boolean => (
  visibleGroups.some((group) => (
    communityMembershipScopeMatches(
      { groupId: entry.groupId, relayUrl: entry.relayUrl ?? "" },
      { groupId: group.groupId, relayUrl: group.relayUrl ?? "" },
    )
  ))
);

export const listArchivedCommunityMembershipLedgerRows = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  profileId: string;
  visibleGroups: ReadonlyArray<GroupConversation>;
}>): ReadonlyArray<ArchivedCommunityMembershipLedgerRow> => (
  loadCommunityMembershipLedger(params.publicKeyHex, { profileId: params.profileId })
    .filter((entry) => isTerminalCommunityMembershipLedgerEntry(entry))
    .map((entry) => ({
      entry,
      tombstoned: isGroupTombstoned(
        params.publicKeyHex,
        { groupId: entry.groupId, relayUrl: entry.relayUrl },
        { profileId: params.profileId },
      ),
      visibleInSidebar: matchesVisibleGroup(entry, params.visibleGroups),
    }))
);
