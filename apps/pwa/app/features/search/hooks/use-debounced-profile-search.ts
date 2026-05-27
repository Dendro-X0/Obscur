"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { ProfileSearchResult } from "../services/profile-search-service";
import { useProfileSearchServiceRef } from "./use-profile-search-service-ref";

export type UseDebouncedProfileSearchParams = Readonly<{
  query: string;
  pool: unknown;
  publicKeyHex?: PublicKeyHex;
  debounceMs?: number;
  minQueryLength?: number;
}>;

const EMPTY_RESULTS: ProfileSearchResult[] = [];

/**
 * Debounced global profile search with stable relay-pool binding (see useProfileSearchServiceRef).
 */
export const useDebouncedProfileSearch = ({
  query,
  pool,
  publicKeyHex,
  debounceMs = 350,
  minQueryLength = 3,
}: UseDebouncedProfileSearchParams): Readonly<{
  results: ReadonlyArray<ProfileSearchResult>;
  isSearching: boolean;
}> => {
  const { searchByName } = useProfileSearchServiceRef(pool, publicKeyHex);
  const [results, setResults] = useState<ReadonlyArray<ProfileSearchResult>>(EMPTY_RESULTS);
  const [isSearching, setIsSearching] = useState(false);
  const generationRef = useRef(0);

  useEffect(() => {
    const normalizedQuery = query.trim();
    const generation = generationRef.current + 1;
    generationRef.current = generation;

    if (normalizedQuery.length < minQueryLength) {
      setResults((previous) => (previous.length === 0 ? previous : EMPTY_RESULTS));
      setIsSearching((previous) => (previous ? false : previous));
      return;
    }

    setIsSearching((previous) => (previous ? previous : true));
    const timeoutId = window.setTimeout(() => {
      void searchByName(normalizedQuery)
        .then((searchResults) => {
          if (generationRef.current !== generation) {
            return;
          }
          setResults(searchResults);
          setIsSearching(false);
        })
        .catch(() => {
          if (generationRef.current !== generation) {
            return;
          }
          setResults(EMPTY_RESULTS);
          setIsSearching(false);
        });
    }, debounceMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [debounceMs, minQueryLength, query, searchByName]);

  return { results, isSearching };
};
