"use client";

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { seedProfileMetadataCache } from "@/app/features/profile/hooks/use-profile-metadata";
import { isExperimentOnlineEnabled } from "@/app/features/runtime/experiment-shell-policy";
import { buildAccountDisplayHintsByPublicKey } from "@/app/features/profiles/services/desktop-profile-preview-enrichment";
import { discoveryCache } from "./discovery-cache";
import { upsertDevicePeerDisplay } from "./device-peer-display-cache";
import { resolvedIdentityCache } from "./resolved-identity-cache";
import { seedPeerDisplayFromLocalAccountHintsSync } from "./peer-display-local-hint-seed";

/**
 * Soft-l3 / Track L fixtures (public keys + published pictures). Dual profile windows
 * do not share localStorage partitions — seed display labels/avatars under
 * experiment-online so invite/network rows stay human-readable without inventing
 * unbound profile-picker slots.
 */
const LAB_PEER_DISPLAY_HINTS = [
  {
    pubkey: "c09832d637eb265d90b29c12eb8dfcfffe165b8fb34094af75236d5be4d97884",
    displayName: "Tester1",
    avatarUrl:
      "https://image.nostr.build/a5fedd99654f40b34523d77e26ff0eb9979637799d6f2dd5293ce00869b549a9.jpg",
  },
  {
    pubkey: "3db055b47e05bdfb9083efec0b7aecd2a045dbf7d865cf4d95d98817d946830f",
    displayName: "Tester2",
    avatarUrl:
      "https://image.nostr.build/b68455576647a2dc11a541f46d6ac1a648673a106e511a08d73c5a23ae5f0c4d.jpg",
  },
] as const;

/** Hydrate-only: fill missing discovery / resolved / metadata labels for lab peers. */
export const seedLabPeerDisplayHintsIfNeeded = (): number => {
  if (!isExperimentOnlineEnabled()) {
    return 0;
  }
  let seeded = seedPeerDisplayFromLocalAccountHintsSync();
  const localHints = buildAccountDisplayHintsByPublicKey();
  for (const peer of LAB_PEER_DISPLAY_HINTS) {
    const pubkey = peer.pubkey.toLowerCase();
    const localHint = localHints.get(pubkey);
    const cached = discoveryCache.getProfile(pubkey);
    const resolved = resolvedIdentityCache.getByPubkey(pubkey);
    const avatarUrl = localHint?.avatarUrl?.trim()
      || cached?.picture?.trim()
      || peer.avatarUrl
      || "";
    const hasDiscoveryName = Boolean(cached?.displayName?.trim() || cached?.name?.trim());
    const hasDiscoveryPicture = Boolean(cached?.picture?.trim());
    const hasResolvedName = Boolean(resolved?.display?.trim());
    if (!hasDiscoveryName || (avatarUrl && !hasDiscoveryPicture)) {
      discoveryCache.upsertProfile({
        pubkey,
        displayName: peer.displayName,
        name: peer.displayName,
        picture: avatarUrl || cached?.picture,
        about: cached?.about,
        nip05: cached?.nip05,
        inviteCode: cached?.inviteCode,
      });
      seeded += 1;
    }
    if (!hasResolvedName) {
      resolvedIdentityCache.upsert({
        pubkey,
        display: peer.displayName,
        source: "text",
        confidence: "cached_only",
      });
      seeded += 1;
    }
    seedProfileMetadataCache({
      pubkey: pubkey as PublicKeyHex,
      displayName: peer.displayName,
      avatarUrl: avatarUrl || undefined,
    });
    // Mirror into AppData so the other profile window can hydrate without reading
    // this webview's partitioned localStorage.
    void upsertDevicePeerDisplay({
      pubkey,
      displayName: peer.displayName,
      avatarUrl: avatarUrl || undefined,
    });
  }
  return seeded;
};

export const labPeerDisplaySeedInternals = {
  LAB_PEER_DISPLAY_HINTS,
};
