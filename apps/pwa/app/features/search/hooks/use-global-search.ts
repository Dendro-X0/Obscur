"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { useInviteResolver } from "@/app/features/invites/utils/use-invite-resolver";
import { isValidInviteCode } from "@/app/features/invites/utils/invite-parser";
import { parsePublicKeyInput } from "@/app/features/profile/utils/parse-public-key-input";
import { parseNip29GroupIdentifier } from "@/app/features/groups/utils/parse-nip29-group-identifier";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

export interface SearchResult {
    type: "person" | "community" | "invite" | "link";
    pubkey?: string;
    id?: string;
    name: string;
    display_name?: string;
    picture?: string;
    about?: string;
    nip05?: string;
    relayUrl?: string;
}

export interface UseGlobalSearchOptions {
    myPublicKeyHex: PublicKeyHex | null;
    onResult?: (result: SearchResult) => void;
}

export function useGlobalSearch(options: UseGlobalSearchOptions) {
    const { t } = useTranslation();
    const { relayPool: pool } = useRelay();
    const inviteResolver = useInviteResolver({ myPublicKeyHex: options.myPublicKeyHex });

    const [results, setResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const subIdRef = useRef<string | null>(null);

    const clearResults = useCallback(() => {
        setResults([]);
        setError(null);
    }, []);

    const search = useCallback(async (query: string) => {
        const trimmedQuery = query.trim();
        if (!trimmedQuery) {
            clearResults();
            return;
        }

        setIsSearching(true);
        setError(null);
        setResults([]);

        // 1. Check for Invite Code
        const upperQuery = trimmedQuery.toUpperCase();
        if (isValidInviteCode(upperQuery)) {
            try {
                const resolved = await inviteResolver.resolveCode(upperQuery);
                if (resolved) {
                    const result: SearchResult = {
                        type: "invite",
                        pubkey: resolved.publicKeyHex,
                        name: resolved.displayName || t("common.unknown"),
                        display_name: resolved.displayName,
                        picture: resolved.avatar,
                    };
                    setResults([result]);
                    setIsSearching(false);
                    return;
                }
            } catch (err) {
                console.error("Failed to resolve invite code:", err);
            }
        }

        // 2. Check for exact pubkey
        const parsedPubkey = parsePublicKeyInput(trimmedQuery);
        if (parsedPubkey.ok) {
            const result: SearchResult = {
                type: "person",
                pubkey: parsedPubkey.publicKeyHex,
                name: parsedPubkey.publicKeyHex.slice(0, 8) + "...",
            };
            setResults([result]);
            setIsSearching(false);
            // We could also fetch metadata for this pubkey here
            return;
        }

        // 3. Check for group identifier (NIP-29) - only if formatted as host'id
        if (trimmedQuery.includes("'")) {
            const parsedGroup = parseNip29GroupIdentifier(trimmedQuery);
            if (parsedGroup.ok) {
                const result: SearchResult = {
                    type: "community",
                    id: parsedGroup.groupId,
                    relayUrl: parsedGroup.relayUrl,
                    name: parsedGroup.groupId,
                };
                setResults([result]);
                setIsSearching(false);
                return;
            }
        }

        // 4. Global Relay Search (NIP-50)
        if (subIdRef.current) {
            pool.sendToOpen(JSON.stringify(["CLOSE", subIdRef.current]));
        }

        const subId = Math.random().toString(36).substring(7);
        subIdRef.current = subId;

        // Search for profiles (kind 0)
        const filter = {
            kinds: [0],
            limit: 20,
            search: trimmedQuery
        };
        const req = JSON.stringify(["REQ", subId, filter]);

        void pool.broadcastEvent(req);

        const cleanup = pool.subscribeToMessages(({ message }) => {
            try {
                const parsedMessage = JSON.parse(message);
                if (parsedMessage[0] === "EVENT" && parsedMessage[1] === subId) {
                    const event = parsedMessage[2];
                    if (event.kind === 0) {
                        try {
                            const content = JSON.parse(event.content);
                            const result: SearchResult = {
                                type: "person",
                                pubkey: event.pubkey,
                                name: content.name || content.display_name || t("common.unknown"),
                                display_name: content.display_name,
                                picture: content.picture,
                                about: content.about,
                                nip05: content.nip05,
                            };

                            setResults(prev => {
                                if (prev.some(r => r.pubkey === event.pubkey)) return prev;
                                return [...prev, result];
                            });
                        } catch (e) {
                            // Ignore invalid content
                        }
                    }
                }
                if (parsedMessage[0] === "EOSE" && parsedMessage[1] === subId) {
                    setIsSearching(false);
                }
            } catch (err) {
                console.error("Search result parse failed:", err);
            }
        });

        // Timeout fallback
        setTimeout(() => {
            if (subIdRef.current === subId) {
                pool.sendToOpen(JSON.stringify(["CLOSE", subId]));
                cleanup();
                setIsSearching(false);
                subIdRef.current = null;
            }
        }, 8000);

    }, [inviteResolver.resolveCode, pool, t, clearResults]);

    return useMemo(() => ({
        results,
        isSearching,
        error,
        search,
        clearResults
    }), [results, isSearching, error, search, clearResults]);
}
