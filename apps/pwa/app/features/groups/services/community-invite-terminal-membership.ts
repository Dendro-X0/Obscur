import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { logAppEvent } from "@/app/shared/log-app-event";
import {
  loadCommunityTerminalMembershipCache,
  mergeTerminalMemberPubkeys,
  saveCommunityTerminalMembershipCache,
} from "./community-terminal-membership-cache";

export type TerminalInvitePeerResponseStatus = "declined" | "canceled";

export type TerminalPeerLeftReason = TerminalInvitePeerResponseStatus | "left";

export type PersistTerminalInvitePeerLeftEvidenceParams = Readonly<{
  groupId: string;
  relayUrl: string;
  peerPublicKeyHex: PublicKeyHex;
  responseStatus: TerminalInvitePeerResponseStatus;
  profileId?: string;
}>;

export type PersistTerminalPeerLeftEvidenceParams = Readonly<{
  groupId: string;
  relayUrl: string;
  peerPublicKeyHexes: ReadonlyArray<PublicKeyHex | string>;
  reason: TerminalPeerLeftReason;
  profileId?: string;
}>;

/**
 * Sticky terminal left evidence so roster hydrate / seed cannot keep a peer
 * visible after leave, invite decline/cancel, or gossip remove.
 */
export function persistTerminalPeerLeftEvidence(
  params: PersistTerminalPeerLeftEvidenceParams,
): void {
  const groupId = params.groupId.trim();
  const relayUrl = params.relayUrl.trim();
  const peerPublicKeyHexes = mergeTerminalMemberPubkeys(params.peerPublicKeyHexes);
  if (!groupId || !relayUrl || peerPublicKeyHexes.length === 0) {
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
      peerPublicKeyHexes,
    ),
    expelledMemberPubkeys: existing?.expelledMemberPubkeys ?? [],
    disbandedAtUnixMs: existing?.disbandedAtUnixMs ?? null,
    profileId,
  });

  logAppEvent({
    name: params.reason === "left"
      ? "groups.leave_terminal_peer_recorded"
      : "groups.invite_terminal_peer_recorded",
    level: "info",
    scope: {
      feature: "groups",
      action: params.reason === "left" ? "leave_terminal" : "invite_terminal",
    },
    context: {
      groupId,
      relayUrl,
      peerCount: peerPublicKeyHexes.length,
      peerPubkeySuffix: peerPublicKeyHexes[0]?.slice(-8) ?? null,
      reason: params.reason,
      profileId,
    },
  });
}

/**
 * MEM-005: record terminal invite outcome for a peer so relay-joined roster
 * evidence cannot keep them visible after decline/cancel.
 */
export function persistTerminalInvitePeerLeftEvidence(
  params: PersistTerminalInvitePeerLeftEvidenceParams,
): void {
  persistTerminalPeerLeftEvidence({
    groupId: params.groupId,
    relayUrl: params.relayUrl,
    peerPublicKeyHexes: [params.peerPublicKeyHex],
    reason: params.responseStatus,
    profileId: params.profileId,
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
