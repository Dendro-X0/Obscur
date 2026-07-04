/**
 * Group provider contracts — context shape for legacy group list provider.
 */
import type React from "react";

import type { GroupConversation } from "@/app/features/messaging/types";
import type { CommunityKnownParticipantDirectory } from "@/app/features/groups/services/community-known-participant-directory";
import type { CommunityRosterProjection } from "@/app/features/groups/services/community-member-roster-projection";
import type { ArchivedCommunityMembershipLedgerRow } from "@/app/features/groups/services/community-membership-ledger-archive";

export interface GroupContextType {
  createdGroups: ReadonlyArray<GroupConversation>;
  hasHydratedGroups: boolean;
  communityRosterByConversationId: Readonly<Record<string, CommunityRosterProjection>>;
  communityKnownParticipantDirectoryByConversationId: Readonly<Record<string, CommunityKnownParticipantDirectory>>;
  setCreatedGroups: React.Dispatch<React.SetStateAction<ReadonlyArray<GroupConversation>>>;
  isNewGroupOpen: boolean;
  setIsNewGroupOpen: (open: boolean) => void;
  isCreatingGroup: boolean;
  setIsCreatingGroup: (creating: boolean) => void;
  isGroupInfoOpen: boolean;
  setIsGroupInfoOpen: (open: boolean) => void;
  newGroupName: string;
  setNewGroupName: (name: string) => void;
  newGroupMemberPubkeys: string;
  setNewGroupMemberPubkeys: (pubkeys: string) => void;
  addGroup: (
    group: GroupConversation,
    options?: Readonly<{ allowRevive?: boolean; provisionalJoin?: boolean; relayConfirmed?: boolean }>,
  ) => void;
  updateGroup: (params: Readonly<{
    groupId: string;
    relayUrl?: string;
    conversationId?: string;
    updates: Partial<GroupConversation>;
  }>) => void;
  leaveGroup: (params: Readonly<{
    groupId: string;
    relayUrl?: string;
    conversationId?: string;
    relayConfirmed?: boolean;
  }>) => void;
  removeGroupConversation: (conversationId: string) => void;
  forcePurgeCommunity: (params: Readonly<{ groupId: string; relayUrl?: string; conversationId?: string }>) => void;
  purgeArchivedCommunityMembership: (params: Readonly<{ groupId: string; relayUrl?: string }>) => number;
  purgeAllArchivedCommunityMemberships: () => number;
  archivedCommunityMembershipRows: ReadonlyArray<ArchivedCommunityMembershipLedgerRow>;
  recordMembershipLedgerAfterInviteDecline: (group: GroupConversation) => void;
}
