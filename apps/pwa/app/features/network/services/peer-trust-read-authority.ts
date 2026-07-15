import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { ProjectionReadAuthorityReason } from "@/app/features/account-sync/services/account-projection-read-authority";

export type PeerTrustReadSource = "legacy" | "projection" | "legacy_hold";

export type PeerTrustReadAuthorityDecision = Readonly<{
  acceptedPeers: ReadonlyArray<PublicKeyHex>;
  source: PeerTrustReadSource;
  holdReason: "projection_empty_legacy_nonempty" | null;
  projectionReadAuthorityReason: ProjectionReadAuthorityReason;
}>;

/**
 * Avoid empty contact list flicker during projection read cutover:
 * keep legacy peerTrust until projection has at least one accepted peer,
 * then union stored + projection so partial projection rebuilds cannot drop peers.
 */
export const resolvePeerTrustReadAuthority = (params: Readonly<{
  shouldUseProjectionReads: boolean;
  projectionReadAuthorityReason: ProjectionReadAuthorityReason;
  projectionAcceptedPeers: ReadonlyArray<PublicKeyHex>;
  storedAcceptedPeers: ReadonlyArray<PublicKeyHex>;
}>): PeerTrustReadAuthorityDecision => {
  if (!params.shouldUseProjectionReads) {
    return {
      acceptedPeers: params.storedAcceptedPeers,
      source: "legacy",
      holdReason: null,
      projectionReadAuthorityReason: params.projectionReadAuthorityReason,
    };
  }

  if (
    params.projectionAcceptedPeers.length === 0
    && params.storedAcceptedPeers.length > 0
  ) {
    return {
      acceptedPeers: params.storedAcceptedPeers,
      source: "legacy_hold",
      holdReason: "projection_empty_legacy_nonempty",
      projectionReadAuthorityReason: params.projectionReadAuthorityReason,
    };
  }

  const mergedAcceptedPeers = Array.from(new Set([
    ...params.storedAcceptedPeers,
    ...params.projectionAcceptedPeers,
  ]));

  return {
    acceptedPeers: mergedAcceptedPeers,
    source: params.projectionAcceptedPeers.length > 0 ? "projection" : "legacy",
    holdReason: null,
    projectionReadAuthorityReason: params.projectionReadAuthorityReason,
  };
};
