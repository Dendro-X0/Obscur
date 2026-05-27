"use client";

import { useCallback, useEffect, useRef } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { SocialGraphService } from "../../social-graph/services/social-graph-service";
import { ProfileSearchService, type ProfileSearchResult } from "../services/profile-search-service";

/**
 * Binds ProfileSearchService to the latest relay pool without listing `pool` in effect deps.
 * Relay pool objects from useRelay() get a new reference whenever connection snapshots update;
 * depending on `pool` in useMemo/useEffect causes search effects to re-fire and can recurse
 * through setIsSearching → render → new pool → effect (Maximum update depth exceeded).
 */
export const useProfileSearchServiceRef = (
  pool: unknown,
  publicKeyHex: PublicKeyHex | undefined,
  socialGraph?: SocialGraphService,
): Readonly<{
  searchByName: (query: string) => Promise<ProfileSearchResult[]>;
}> => {
  const poolRef = useRef(pool);
  poolRef.current = pool;
  const socialGraphRef = useRef(socialGraph);
  socialGraphRef.current = socialGraph;
  const serviceRef = useRef<ProfileSearchService | null>(null);

  useEffect(() => {
    if (!poolRef.current || !publicKeyHex) {
      serviceRef.current = null;
      return;
    }
    serviceRef.current = new ProfileSearchService(
      poolRef.current as ConstructorParameters<typeof ProfileSearchService>[0],
      socialGraphRef.current,
      publicKeyHex,
    );
  }, [publicKeyHex]);

  const searchByName = useCallback(async (query: string) => {
    if (!serviceRef.current) {
      return [];
    }
    return serviceRef.current.searchByName(query);
  }, []);

  return { searchByName };
};
