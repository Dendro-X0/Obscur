import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { logAppEvent } from "@/app/shared/log-app-event";
import {
  loadCommunityTerminalMembershipCache,
  mergeTerminalMemberPubkeys,
  saveCommunityTerminalMembershipCache,
} from "./community-terminal-membership-cache";

export type TerminalInvitePeerResponseStatus = "declined" | "canceled";

export type PersistTerminalInvitePeerLeftEvidenceParams = Readonly<{
  groupId: string;
  relayUrl: string;
  peerPublicKeyHex: PublicKeyHex;
  responseStatus: TerminalInvitePeerResponseStatus;
  profileId?: string;
}>;

/**
 * MEM-005: record terminal invite outcome for a peer so relay-joined roster
 * evidence cannot keep them visible after decline/cancel.
 */
export function persistTerminalInvitePeerLeftEvidence(
  params: PersistTerminalInvitePeerLeftEvidenceParams,
): void {
  const groupId = params.groupId.trim();
  const relayUrl = params.relayUrl.trim();
  const peerPublicKeyHex = params.peerPublicKeyHex.trim() as PublicKeyHex;
  if (!groupId || !relayUrl || peerPublicKeyHex.length === 0) {
    return;
  }

  const profileId = params.profileId ?? getResolvedProfileId();
  const existing = loadCommunityTerminalMembershipCache({
    groupId,
    relayUrl,
    profileId,
  });

  saveCommunityTerminalMembershipCache({
    groupId,
    relayUrl,
    leftMemberPubkeys: mergeTerminalMemberPubkeys(
      existing?.leftMemberPubkeys ?? [],
      [peerPublicKeyHex],
    ),
    expelledMemberPubkeys: existing?.expelledMemberPubkeys ?? [],
    disbandedAtUnixMs: existing?.disbandedAtUnixMs ?? null,
    profileId,
  });

  logAppEvent({
    name: "groups.invite_terminal_peer_recorded",
    level: "info",
    scope: { feature: "groups", action: "invite_terminal" },
    context: {
      groupId,
      relayUrl,
      peerPubkeySuffix: peerPublicKeyHex.slice(-8),
      responseStatus: params.responseStatus,
      profileId,
    },
  });
}

export function removePubkeyFromMemberList(
  pubkeys: ReadonlyArray<string>,
  peerPublicKeyHex: string,
): ReadonlyArray<string> {
  const normalizedPeer = peerPublicKeyHex.trim().toLowerCase();
  if (normalizedPeer.length === 0) {
    return [...pubkeys];
  }
  return pubkeys.filter((pubkey) => pubkey.trim().toLowerCase() !== normalizedPeer);
}
