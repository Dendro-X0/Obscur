"use client";

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { seedProfileMetadataCache } from "@/app/features/profile/hooks/use-profile-metadata";
import {
  buildAccountDisplayHints,
  buildAccountDisplayHintsByPublicKey,
} from "@/app/features/profiles/services/desktop-profile-preview-enrichment";
import { discoveryCache } from "./discovery-cache";
import { resolvedIdentityCache } from "./resolved-identity-cache";

const seedHintMap = (
  hints: ReadonlyMap<string, Readonly<{ username: string; avatarUrl: string }>>,
): number => {
  let seeded = 0;
  for (const [pubkey, hint] of hints) {
    const key = pubkey.trim().toLowerCase();
    if (key.length !== 64) {
      continue;
    }
    const username = hint.username.trim();
    const avatarUrl = hint.avatarUrl.trim();
    if (!username && !avatarUrl) {
      continue;
    }
    const cached = discoveryCache.getProfile(key);
    const needsName = Boolean(username) && !cached?.displayName?.trim() && !cached?.name?.trim();
    const needsPicture = Boolean(avatarUrl) && !cached?.picture?.trim();
    if (needsName || needsPicture) {
      discoveryCache.upsertProfile({
        pubkey: key,
        displayName: username || cached?.displayName || cached?.name,
        name: username || cached?.name,
        picture: avatarUrl || cached?.picture,
      });
      seeded += 1;
    }
    if (username) {
      const resolved = resolvedIdentityCache.getByPubkey(key);
      if (!resolved?.display?.trim()) {
        resolvedIdentityCache.upsert({
          pubkey: key,
          display: username,
          source: "text",
          confidence: "cached_only",
        });
        seeded += 1;
      }
    }
    seedProfileMetadataCache({
      pubkey: key as PublicKeyHex,
      displayName: username || undefined,
      avatarUrl: avatarUrl || undefined,
    });
  }
  return seeded;
};

/** Sync scan of profile-slot drafts/bindings — best-effort avatar + name hydrate. */
export const seedPeerDisplayFromLocalAccountHintsSync = (): number => (
  seedHintMap(buildAccountDisplayHintsByPublicKey())
);

/** Async scan including IndexedDB identity bindings. */
export const seedPeerDisplayFromLocalAccountHints = async (): Promise<number> => {
  const hints = await buildAccountDisplayHints();
  return seedHintMap(hints);
};
