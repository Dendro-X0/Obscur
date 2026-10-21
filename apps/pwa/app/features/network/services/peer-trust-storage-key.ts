import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getDefaultProfileId, getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";

const PEER_TRUST_STORAGE_PREFIX = "obscur.peer_trust.v1";

export const getLegacyPeerTrustStorageKey = (publicKeyHex: PublicKeyHex): string => (
  `${PEER_TRUST_STORAGE_PREFIX}.${publicKeyHex}`
);

export const getPeerTrustStorageKey = (
  publicKeyHex: PublicKeyHex,
  profileId: string,
): string => getScopedStorageKey(getLegacyPeerTrustStorageKey(publicKeyHex), profileId);

/**
 * Unscoped pubkey-keyed rows belonged to the historical single-profile window.
 * Non-default profiles must not inherit that blob — that is the cross-profile leak.
 */
export const canInheritUnscopedPeerTrust = (profileId: string): boolean => (
  profileId.trim() === getDefaultProfileId()
);
