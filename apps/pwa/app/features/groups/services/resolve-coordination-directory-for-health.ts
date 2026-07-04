import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CoordinationMembershipMaterialization } from "./community-coordination-membership-materializer";
import { loadCoordinationMembershipDirectory } from "./community-coordination-membership-directory-store";

const isPubkeyActiveInDirectory = (
  materialization: CoordinationMembershipMaterialization,
  pubkey: PublicKeyHex,
): boolean => {
  const normalized = pubkey.trim().toLowerCase();
  return materialization.activeMemberPubkeys.some(
    (entry) => entry.trim().toLowerCase() === normalized,
  );
};

/**
 * Prefer a coordination directory snapshot that lists the local member.
 * Fixes split-brain when ledger/directory disagree on communityId (COM-RUN-01/06).
 */
export const resolveCoordinationDirectoryForMemberHealth = (params: Readonly<{
  communityId?: string;
  communityIdCandidates?: ReadonlyArray<string>;
  profileId?: string;
  localMemberPubkey?: PublicKeyHex | null;
  primaryDirectory: CoordinationMembershipMaterialization | null;
}>): CoordinationMembershipMaterialization | null => {
  const local = params.localMemberPubkey?.trim();
  if (!local) {
    return params.primaryDirectory;
  }

  const candidates = Array.from(new Set(
    [
      params.communityId?.trim() ?? "",
      ...(params.communityIdCandidates ?? []),
    ].filter((value) => value.length > 0),
  ));

  for (const communityId of candidates) {
    const directory = loadCoordinationMembershipDirectory(communityId, params.profileId);
    if (directory && isPubkeyActiveInDirectory(directory, local as PublicKeyHex)) {
      return directory;
    }
  }

  return params.primaryDirectory;
};
