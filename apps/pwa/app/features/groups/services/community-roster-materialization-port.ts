/**
 * R2 — Community roster materialization port (app-owned; wired on ClientGateway).
 */
import type { GroupConversationRosterContract } from "@dweb/client-gateway/community-roster";
import type { CommunityKnownParticipantDirectory } from "./community-known-participant-directory";
import type { CommunityKnownParticipantsEntry } from "./community-known-participants-store";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type {
  ActiveCommunityMemberPubkeysResolution,
  ResolveActiveCommunityMemberPubkeysFromConversationParams,
  StabilizeCommunityMemberPubkeysParams,
  StabilizeCommunityMemberPubkeysResult,
} from "./community-visible-members";

export type ResolveCommunitySeedMemberPubkeysFromDirectoryParams = Readonly<{
  directory: CommunityKnownParticipantDirectory | null | undefined;
  persistedGroupMemberPubkeys?: ReadonlyArray<PublicKeyHex> | null;
  projectionMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  localMemberPubkey?: PublicKeyHex | null;
}>;

/** App-typed roster port (checked against `@dweb/client-gateway` in contract-satisfaction test). */
export type CommunityRosterMaterializationPort = Readonly<{
  resolveAuthorEvidencePubkeysFromMessages: (
    messages: ReadonlyArray<Readonly<{ pubkey?: string | null }>>,
  ) => ReadonlyArray<PublicKeyHex>;
  resolveSeedMemberPubkeysFromDirectory: (
    params: ResolveCommunitySeedMemberPubkeysFromDirectoryParams,
  ) => ReadonlyArray<PublicKeyHex>;
  resolveActiveMemberPubkeysFromConversation: (
    params: ResolveActiveCommunityMemberPubkeysFromConversationParams,
  ) => ActiveCommunityMemberPubkeysResolution;
  stabilizeMemberPubkeys: (
    params: StabilizeCommunityMemberPubkeysParams,
  ) => StabilizeCommunityMemberPubkeysResult;
  persistKnownParticipantDirectoryIfWidened: (params: Readonly<{
    publicKeyHex: PublicKeyHex;
    profileId: string;
    directory: CommunityKnownParticipantDirectory;
    persistedGroupMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
    storedEntry?: CommunityKnownParticipantsEntry;
  }>) => boolean;
  persistObservedKnownParticipants: (params: Readonly<{
    publicKeyHex: PublicKeyHex;
    profileId: string;
    entry: CommunityKnownParticipantsEntry;
  }>) => void;
  persistHydratedGroupKnownParticipants: (params: Readonly<{
    publicKeyHex: PublicKeyHex;
    profileId: string;
    group: GroupConversationRosterContract;
    additionalParticipantPubkeys?: ReadonlyArray<PublicKeyHex>;
  }>) => void;
  resolveSnapshotNextMembers: (params: Readonly<{
    currentMemberPubkeys: ReadonlyArray<PublicKeyHex>;
    snapshotNextMemberPubkeys: ReadonlyArray<PublicKeyHex>;
    leftMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
    expelledMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
    protectRemovalPubkeys?: ReadonlyArray<PublicKeyHex>;
    guardRelaxed?: boolean;
  }>) => ReadonlyArray<PublicKeyHex>;
}>;
