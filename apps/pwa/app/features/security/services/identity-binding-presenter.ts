import { nip19 } from "nostr-tools";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { DiscoveryConfidence, ResolvedIdentity, ResolverInputKind } from "@/app/features/search/types/discovery";

export type IdentityBindingResolverSource =
  | ResolverInputKind
  | "connection_request"
  | "manual";

export type IdentityBindingViewModel = Readonly<{
  publicKeyHex: PublicKeyHex;
  npub: string;
  npubFragment: string;
  hexFragment: string;
  displayName: string | null;
  displayNameUntrusted: boolean;
  resolverSource: IdentityBindingResolverSource;
  friendCode: string | null;
  avatarUrl: string | null;
  confidence: DiscoveryConfidence;
}>;

const normalizePublicKeyHex = (value: string): PublicKeyHex | null => {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length !== 64 || !/^[0-9a-f]+$/.test(trimmed)) {
    return null;
  }
  return trimmed as PublicKeyHex;
};

export const formatIdentityKeyFragment = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length <= 20) {
    return trimmed;
  }
  return `${trimmed.slice(0, 8)}…${trimmed.slice(-8)}`;
};

export const encodeIdentityBindingNpub = (publicKeyHex: PublicKeyHex): string => {
  try {
    return nip19.npubEncode(publicKeyHex);
  } catch {
    return publicKeyHex;
  }
};

export const buildIdentityBindingViewModel = (params: Readonly<{
  publicKeyHex: string;
  displayName?: string | null;
  resolverSource: IdentityBindingResolverSource;
  friendCode?: string | null;
  avatarUrl?: string | null;
  confidence?: DiscoveryConfidence;
}>): IdentityBindingViewModel | null => {
  const publicKeyHex = normalizePublicKeyHex(params.publicKeyHex);
  if (!publicKeyHex) {
    return null;
  }
  const npub = encodeIdentityBindingNpub(publicKeyHex);
  const displayName = params.displayName?.trim() || null;
  return {
    publicKeyHex,
    npub,
    npubFragment: formatIdentityKeyFragment(npub),
    hexFragment: formatIdentityKeyFragment(publicKeyHex),
    displayName,
    displayNameUntrusted: Boolean(displayName),
    resolverSource: params.resolverSource,
    friendCode: params.friendCode?.trim() || null,
    avatarUrl: params.avatarUrl?.trim() || null,
    confidence: params.confidence ?? "relay_confirmed",
  };
};

export const buildIdentityBindingFromResolvedIdentity = (
  identity: ResolvedIdentity,
  options?: Readonly<{
    displayName?: string | null;
    avatarUrl?: string | null;
  }>,
): IdentityBindingViewModel | null => (
  buildIdentityBindingViewModel({
    publicKeyHex: identity.pubkey,
    displayName: options?.displayName ?? identity.display ?? null,
    resolverSource: identity.source,
    friendCode: identity.inviteCode ?? null,
    avatarUrl: options?.avatarUrl ?? null,
    confidence: identity.confidence,
  })
);

export const identityBindingSourceI18nKey = (
  source: IdentityBindingResolverSource,
): string => {
  switch (source) {
    case "contact_card":
      return "security.identityBinding.source.contactCard";
    case "friend_code_v3":
      return "security.identityBinding.source.friendCodeV3";
    case "friend_code_v2":
      return "security.identityBinding.source.friendCodeV2";
    case "npub":
      return "security.identityBinding.source.npub";
    case "hex":
      return "security.identityBinding.source.hex";
    case "legacy_code":
      return "security.identityBinding.source.legacyCode";
    case "text":
      return "security.identityBinding.source.text";
    case "connection_request":
      return "security.identityBinding.source.connectionRequest";
    default:
      return "security.identityBinding.source.manual";
  }
};
