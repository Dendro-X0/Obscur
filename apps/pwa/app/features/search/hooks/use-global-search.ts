"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { NostrFilter } from "@/app/features/relays/types/nostr-filter";
import { DiscoveryEngine } from "@/app/features/search/services/discovery-engine";
import { discoverySessionDiagnosticsStore } from "@/app/features/search/services/discovery-session-diagnostics";
import type {
    DiscoveryIntent,
    DiscoveryQueryState,
    DiscoveryReasonCode,
    DiscoveryResult
} from "@/app/features/search/types/discovery";
import { useGroups } from "@/app/features/groups/providers/group-provider";

export type SearchResult = DiscoveryResult;

export interface UseGlobalSearchOptions {
    myPublicKeyHex: PublicKeyHex | null;
    intent?: DiscoveryIntent;
    onResult?: (result: DiscoveryResult) => void;
}

const SEARCH_TIMEOUT_MS = 8_000;
const SEARCH_FALLBACK_WINDOW_SECONDS = 60 * 60 * 24 * 120;

const toLower = (value: unknown): string => (typeof value === "string" ? value.toLowerCase() : "");

const profileMatchesQuery = (query: string, content: Record<string, unknown>, pubkey: string): boolean => {
    const q = query.toLowerCase();
    if (toLower(content.name).includes(q)) return true;
    if (toLower(content.display_name).includes(q)) return true;
    if (toLower(content.about).includes(q)) return true;
    if (toLower(content.nip05).includes(q)) return true;
    if (pubkey.toLowerCase().includes(q)) return true;
    return false;
};

const buildGlobalSearchFilters = (query: string): ReadonlyArray<NostrFilter> => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    return [
        { kinds: [0], search: query, limit: 40 },
        { kinds: [0], since: nowSeconds - SEARCH_FALLBACK_WINDOW_SECONDS, limit: 400 },
    ];
};

export const globalSearchInternals = {
    profileMatchesQuery,
    buildGlobalSearchFilters,
};

const createDefaultQueryState = (intent: DiscoveryIntent): DiscoveryQueryState => ({
    intent,
    query: "",
    phase: "idle",
    elapsedMs: 0,
    sourceStatusMap: {
        local: { state: "idle" },
        relay: { state: "idle" },
        index: { state: "idle" },
    },
});

const reasonToMessage = (reasonCode: DiscoveryReasonCode | undefined): string | null => {
    switch (reasonCode) {
        case "invalid_input":
            return "Input format is invalid.";
        case "unsupported_token":
            return "Use QR/contact card/Friend Code/npub for deterministic add.";
        case "invalid_code":
            return "Code format is invalid.";
        case "expired_code":
            return "Code expired. Ask for a new code.";
        case "code_used":
            return "Code already used. Ask for a new code.";
        case "legacy_code_unresolvable":
            return "Legacy code not resolvable. Ask for QR/contact card/Friend Code.";
        case "index_unavailable_fallback":
            return "Index unavailable and relay fallback degraded.";
        case "no_match":
            return "No matching people or communities were found.";
        case "offline":
            return "You are offline. Showing cached results only.";
        case "relay_degraded":
            return "Relay network is degraded. Results may be partial.";
        case "index_unavailable":
            return "Index service is unavailable.";
        case "canceled":
            return "Search canceled.";
        default:
            return null;
    }
};

export function useGlobalSearch(options: UseGlobalSearchOptions) {
    const defaultIntent = options.intent ?? "add_friend";
    void options.myPublicKeyHex;
    const { relayPool: pool, relayRecovery } = useRelay();
    const { createdGroups } = useGroups();

    const [results, setResults] = useState<ReadonlyArray<DiscoveryResult>>([]);
    const [queryState, setQueryState] = useState<DiscoveryQueryState>(() => createDefaultQueryState(defaultIntent));
    const [error, setError] = useState<string | null>(null);

    const searchRunIdRef = useRef(0);
    const searchAbortRef = useRef<AbortController | null>(null);

    const clearResults = useCallback(() => {
        setResults([]);
        setError(null);
        setQueryState(createDefaultQueryState(defaultIntent));
    }, [defaultIntent]);

    const invalidatePreviousSearches = useCallback(() => {
        searchRunIdRef.current += 1;
        if (searchAbortRef.current) {
            searchAbortRef.current.abort();
            searchAbortRef.current = null;
        }
    }, []);

    useEffect(() => {
        return () => {
            invalidatePreviousSearches();
        };
    }, [invalidatePreviousSearches]);

    const search = useCallback(async (query: string, intent?: DiscoveryIntent) => {
        const trimmedQuery = query.trim();
        const effectiveIntent = intent ?? defaultIntent;
        if (!trimmedQuery) {
            invalidatePreviousSearches();
            clearResults();
            return;
        }

        invalidatePreviousSearches();
        const runId = searchRunIdRef.current;
        const diagnosticsRunId = discoverySessionDiagnosticsStore.startLookup({
            intent: effectiveIntent,
            query: trimmedQuery,
        });
        const abortController = new AbortController();
        searchAbortRef.current = abortController;
        setError(null);
        setResults([]);
        setQueryState(createDefaultQueryState(effectiveIntent));

        try {
            const finalResult = await DiscoveryEngine.run({
                query: trimmedQuery,
                intent: effectiveIntent,
                pool,
                relayTimeoutMs: SEARCH_TIMEOUT_MS,
                signal: abortController.signal,
                localCommunities: createdGroups.map((group) => ({
                    communityId: group.groupId,
                    relayUrl: group.relayUrl,
                    name: group.displayName,
                    about: undefined,
                    picture: group.avatar,
                    updatedAtUnixMs: group.lastMessageTime?.getTime?.() ?? Date.now(),
                })),
                indexBaseUrl: process.env.NEXT_PUBLIC_DISCOVERY_INDEX_URL,
                skipRelayLookup: relayRecovery.writableRelayCount === 0 && typeof navigator !== "undefined" && navigator.onLine !== false,
                onProgress: (state, partialResults) => {
                    if (searchRunIdRef.current !== runId) return;
                    setQueryState(state);
                    setResults(Array.from(partialResults));
                },
            });

            if (searchRunIdRef.current !== runId) {
                return;
            }
            setResults(Array.from(finalResult.results));
            setQueryState(finalResult.state);
            setError(reasonToMessage(finalResult.state.reasonCode));
            discoverySessionDiagnosticsStore.completeLookup({
                runId: diagnosticsRunId,
                state: finalResult.state,
                results: finalResult.results,
            });
            if (options.onResult && finalResult.results.length > 0) {
                finalResult.results.forEach(options.onResult);
            }
        } catch (err) {
            const reasonCode = err instanceof DOMException && err.name === "AbortError"
                ? "canceled"
                : "relay_degraded";
            const fallbackState: DiscoveryQueryState = {
                ...createDefaultQueryState(effectiveIntent),
                query: trimmedQuery,
                phase: "degraded",
                reasonCode,
                elapsedMs: 0,
            };
            discoverySessionDiagnosticsStore.completeLookup({
                runId: diagnosticsRunId,
                state: fallbackState,
                results: [],
            });
            if (searchRunIdRef.current !== runId) {
                return;
            }
            const message = err instanceof Error ? err.message : "Search failed";
            setError(message);
            setQueryState((prev) => ({
                ...prev,
                phase: "degraded",
                reasonCode: "relay_degraded",
            }));
        } finally {
            if (searchAbortRef.current === abortController) {
                searchAbortRef.current = null;
            }
        }
    }, [pool, relayRecovery.writableRelayCount, invalidatePreviousSearches, clearResults, createdGroups, defaultIntent, options]);

    const isSearching = queryState.phase === "running" || queryState.phase === "partial";

    return useMemo(() => ({
        results,
        isSearching,
        queryState,
        error,
        search,
        clearResults
    }), [results, isSearching, queryState, error, search, clearResults]);
}
