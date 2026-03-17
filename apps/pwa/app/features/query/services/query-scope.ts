"use client";

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

export const ANONYMOUS_QUERY_SCOPE = "anonymous";

export type QueryScope = Readonly<{
  profileId: string;
  publicKeyHex: PublicKeyHex | typeof ANONYMOUS_QUERY_SCOPE;
}>;

export const createQueryScope = (params: Readonly<{
  profileId: string | null | undefined;
  publicKeyHex: PublicKeyHex | null | undefined;
}>): QueryScope => {
  const normalizedProfileId = typeof params.profileId === "string" && params.profileId.trim().length > 0
    ? params.profileId.trim()
    : "default";
  return {
    profileId: normalizedProfileId,
    publicKeyHex: params.publicKeyHex ?? ANONYMOUS_QUERY_SCOPE,
  };
};

export const getQueryScopeCacheKey = (scope: QueryScope): string => {
  return `${scope.profileId}::${scope.publicKeyHex}`;
};

