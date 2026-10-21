import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { buildAccountDisplayHintsByPublicKey } from "@/app/features/profiles/services/desktop-profile-preview-enrichment";
import { seedProfileMetadataCache } from "@/app/features/profile/hooks/use-profile-metadata";
import {
  isPeerPubkeyPlaceholderName,
  resolvePeerDisplayName,
} from "@/app/features/profile/utils/resolve-peer-display-name";
import { INVITE_CONNECTION_FALLBACK_NAME } from "./invite-connection-display";

const HOSTILE_PLACEHOLDER_NAMES = new Set([
  INVITE_CONNECTION_FALLBACK_NAME.toLowerCase(),
  "unknown",
  "unnamed connection",
  "identity hidden",
]);

const asHumanLabel = (value: string | null | undefined, pubkey: string): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (HOSTILE_PLACEHOLDER_NAMES.has(trimmed.toLowerCase())) {
    return null;
  }
  if (isPeerPubkeyPlaceholderName(trimmed, pubkey)) {
    return null;
  }
  return trimmed;
};

export type InviteConnectionPresentation = Readonly<{
  displayName: string;
  avatarUrl?: string;
  usedLocalAccountHint: boolean;
}>;

/**
 * Invite picker presentation — human name + optional avatar.
 * Order: live/cache metadata → DM connection label → local profile-slot hint by pubkey → pubkey preview.
 * Does not change peerTrust / connection-store privilege.
 */
export const resolveInviteConnectionPresentation = (params: Readonly<{
  pubkey: string;
  metadataDisplayName?: string | null;
  metadataAvatarUrl?: string | null;
  connectionDisplayName?: string | null;
  cachedDisplayName?: string | null;
  /** Prior identity-resolver / friend-code / contact-card label for this pubkey. */
  resolvedDisplayName?: string | null;
  /** Injected in tests; defaults to device-local profile-slot hints. */
  localHintByPubkey?: ReadonlyMap<string, Readonly<{ username: string; avatarUrl: string }>>;
}>): InviteConnectionPresentation => {
  const hints = params.localHintByPubkey ?? buildAccountDisplayHintsByPublicKey();
  const localHint = hints.get(params.pubkey.trim().toLowerCase());
  const humanConnection = asHumanLabel(params.connectionDisplayName, params.pubkey);
  const humanMetadata = asHumanLabel(params.metadataDisplayName, params.pubkey)
    ?? asHumanLabel(params.cachedDisplayName, params.pubkey)
    ?? asHumanLabel(params.resolvedDisplayName, params.pubkey);
  const humanLocal = asHumanLabel(localHint?.username, params.pubkey);

  const displayName = resolvePeerDisplayName({
    pubkey: params.pubkey,
    metadataDisplayName: humanMetadata,
    fallbackDisplayName: humanConnection ?? humanLocal,
  });

  const avatarUrl = (params.metadataAvatarUrl?.trim() || localHint?.avatarUrl?.trim() || undefined);

  if (localHint && (humanLocal || localHint.avatarUrl)) {
    seedProfileMetadataCache({
      pubkey: params.pubkey.trim().toLowerCase() as PublicKeyHex,
      displayName: humanLocal || humanMetadata || undefined,
      avatarUrl: localHint.avatarUrl || undefined,
    });
  }

  return {
    displayName,
    avatarUrl,
    usedLocalAccountHint: Boolean(humanLocal && !humanMetadata && !humanConnection),
  };
};
