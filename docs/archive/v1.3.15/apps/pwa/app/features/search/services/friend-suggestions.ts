"use client";

import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import type { DiscoveryProfileRecord } from "./discovery-cache";

export type FriendSuggestion = Readonly<{
  pubkey: string;
  displayName: string;
  subtitle?: string;
  about?: string;
  picture?: string;
  inviteCode?: string;
  score: number;
  updatedAtUnixMs: number;
}>;

type BuildFriendSuggestionsParams = Readonly<{
  profiles: ReadonlyArray<DiscoveryProfileRecord>;
  myPublicKeyHex?: string | null;
  acceptedPeers?: ReadonlyArray<string>;
  blockedPeers?: ReadonlyArray<string>;
  excludedPeers?: ReadonlyArray<string>;
  limit?: number;
  nowUnixMs?: number;
}>;

const toNormalizedSet = (values: ReadonlyArray<string> | undefined): ReadonlySet<string> => {
  if (!values || values.length === 0) {
    return new Set();
  }
  return new Set(
    values
      .map((value) => normalizePublicKeyHex(value))
      .filter((value): value is string => typeof value === "string")
  );
};

const scoreProfile = (profile: DiscoveryProfileRecord, nowUnixMs: number): number => {
  const ageHours = Math.max(0, (nowUnixMs - profile.updatedAtUnixMs) / (1000 * 60 * 60));
  const recencyScore = Math.max(0, 96 - ageHours);
  const profileCompletenessScore = (profile.displayName ? 8 : 0) + (profile.nip05 ? 5 : 0) + (profile.inviteCode ? 6 : 0);
  return recencyScore + profileCompletenessScore;
};

export const buildFriendSuggestions = (params: BuildFriendSuggestionsParams): ReadonlyArray<FriendSuggestion> => {
  const nowUnixMs = params.nowUnixMs ?? Date.now();
  const normalizedSelf = params.myPublicKeyHex ? normalizePublicKeyHex(params.myPublicKeyHex) : null;
  const acceptedPeers = toNormalizedSet(params.acceptedPeers);
  const blockedPeers = toNormalizedSet(params.blockedPeers);
  const excludedPeers = toNormalizedSet(params.excludedPeers);
  const limit = Math.max(1, params.limit ?? 6);
  const seen = new Set<string>();

  const suggestions: FriendSuggestion[] = [];

  for (const profile of params.profiles) {
    const pubkey = normalizePublicKeyHex(profile.pubkey);
    if (!pubkey) continue;
    if (seen.has(pubkey)) continue;
    seen.add(pubkey);
    if (normalizedSelf && pubkey === normalizedSelf) continue;
    if (acceptedPeers.has(pubkey)) continue;
    if (blockedPeers.has(pubkey)) continue;
    if (excludedPeers.has(pubkey)) continue;

    const score = scoreProfile(profile, nowUnixMs);
    suggestions.push({
      pubkey,
      displayName: profile.displayName || profile.name || pubkey.slice(0, 16),
      subtitle: profile.nip05 || profile.inviteCode,
      about: profile.about,
      picture: profile.picture,
      inviteCode: profile.inviteCode,
      score,
      updatedAtUnixMs: profile.updatedAtUnixMs,
    });
  }

  return suggestions
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (right.updatedAtUnixMs !== left.updatedAtUnixMs) return right.updatedAtUnixMs - left.updatedAtUnixMs;
      return left.pubkey.localeCompare(right.pubkey);
    })
    .slice(0, limit);
};

export const friendSuggestionInternals = {
  scoreProfile,
  toNormalizedSet,
};
