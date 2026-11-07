import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

export type InviteConnectionCandidateInput = Readonly<{
  pubkey: string;
  connectionDisplayName?: string | null;
  metadataDisplayName?: string | null;
}>;

export type InviteConnectionCandidate = Readonly<{
  pubkey: string;
  connectionDisplayName?: string;
  cachedMetadataDisplayName?: string;
}>;

export type ResolveInviteConnectionCandidatesParams = Readonly<{
  acceptedPeers: ReadonlyArray<PublicKeyHex | string>;
  /** Optional DM / messaging rows — used for display names only. */
  connectionsByPubkey?: ReadonlyMap<string, InviteConnectionCandidateInput>;
  resolveMetadataDisplayName?: (pubkey: string) => string | null | undefined;
  searchQuery?: string;
  toSearchText: (params: Readonly<{
    pubkey: string;
    resolvedDisplayName: string;
    connectionDisplayName?: string;
    metadataDisplayName?: string;
  }>) => string;
  resolveDisplayName: (params: Readonly<{
    pubkey: string;
    connectionDisplayName?: string;
    metadataDisplayName?: string;
  }>) => string;
}>;

/**
 * Slice 3 — invite picker candidates follow peerTrust acceptedPeers.
 * A missing DM conversation must not hide an accepted connection (social-core Fail was empty list).
 */
export const resolveInviteConnectionCandidates = (
  params: ResolveInviteConnectionCandidatesParams,
): ReadonlyArray<InviteConnectionCandidate> => {
  const normalizedQuery = params.searchQuery?.trim().toLowerCase() ?? "";
  const out: InviteConnectionCandidate[] = [];

  for (const peer of params.acceptedPeers) {
    const pubkey = peer.trim();
    if (!pubkey) {
      continue;
    }
    const connection = params.connectionsByPubkey?.get(pubkey.toLowerCase())
      ?? params.connectionsByPubkey?.get(pubkey);
    const connectionDisplayName = connection?.connectionDisplayName?.trim() || undefined;
    const metadataDisplayName = (
      connection?.metadataDisplayName?.trim()
      || params.resolveMetadataDisplayName?.(pubkey)?.trim()
      || undefined
    );
    const resolvedDisplayName = params.resolveDisplayName({
      pubkey,
      connectionDisplayName,
      metadataDisplayName,
    });
    const searchText = params.toSearchText({
      pubkey,
      resolvedDisplayName,
      connectionDisplayName,
      metadataDisplayName,
    });
    if (normalizedQuery.length > 0 && !searchText.toLowerCase().includes(normalizedQuery)) {
      continue;
    }
    out.push({
      pubkey,
      connectionDisplayName,
      cachedMetadataDisplayName: metadataDisplayName,
    });
  }

  return out;
};
