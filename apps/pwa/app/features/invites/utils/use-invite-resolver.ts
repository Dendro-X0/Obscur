"use client";

import { useState, useCallback, useMemo } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { useRelay } from "../../relays/providers/relay-provider";
import { isValidInviteCode } from "./invite-parser";
import type { NostrFilter } from "../../relays/types/nostr-filter";
import { discoveryCache } from "@/app/features/search/services/discovery-cache";
import { queryRelayProfiles } from "@/app/features/search/services/relay-discovery-query";

export type ResolvedInvite = {
    publicKeyHex: PublicKeyHex;
    displayName?: string;
    avatar?: string;
    about?: string;
};

const normalizeInviteCode = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const normalized = value.trim().toUpperCase();
    return normalized.length > 0 ? normalized : null;
};

const hasInviteCodeTag = (event: { tags?: unknown }, inviteCode: string): boolean => {
    if (!Array.isArray(event.tags)) return false;
    return event.tags.some((tag): boolean => {
        if (!Array.isArray(tag)) return false;
        return normalizeInviteCode(tag[1]) === inviteCode;
    });
};

const parseProfileContent = (rawContent: unknown): Record<string, unknown> => {
    if (typeof rawContent !== "string") return {};
    try {
        const parsed = JSON.parse(rawContent);
        return typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : {};
    } catch {
        return {};
    }
};

const contentContainsInviteCode = (content: Record<string, unknown>, inviteCode: string): boolean => {
    const about = typeof content.about === "string" ? content.about.toUpperCase() : "";
    const name = normalizeInviteCode(content.name);
    const displayName = normalizeInviteCode(content.display_name);
    return about.includes(inviteCode) || name === inviteCode || displayName === inviteCode;
};

const buildInviteLookupFilters = (inviteCode: string): ReadonlyArray<NostrFilter> => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const recentWindowSeconds = 60 * 60 * 24 * 180; // 180 days
    return [
        { kinds: [0], "#code": [inviteCode], limit: 3 },
        { kinds: [0], search: inviteCode, limit: 10 },
        // Fallback for relays that don't support custom-tag or NIP-50 search.
        { kinds: [0], since: nowSeconds - recentWindowSeconds, limit: 300 },
    ];
};

export const inviteResolverInternals = {
    normalizeInviteCode,
    hasInviteCodeTag,
    parseProfileContent,
    contentContainsInviteCode,
    buildInviteLookupFilters,
};

export const useInviteResolver = (params: { myPublicKeyHex: PublicKeyHex | null }) => {
    void params;
    const { relayPool: pool } = useRelay();


    const [isResolving, setIsResolving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const resolveCode = useCallback(async (code: string): Promise<ResolvedInvite | null> => {
        if (!isValidInviteCode(code)) {
            setError("Invalid invite code format");
            return null;
        }

        const cached = discoveryCache.resolveInviteCode(code);
        if (cached) {
            return {
                publicKeyHex: cached.pubkey as PublicKeyHex,
                displayName: cached.displayName || cached.name,
                avatar: cached.picture,
                about: cached.about,
            };
        }

        setIsResolving(true);
        setError(null);

        try {
            const records = await queryRelayProfiles({
                pool,
                mode: "invite",
                query: code,
                timeoutMs: 7_000,
                maxResults: 20,
            });
            const matched = records.find((record) => (record.inviteCode ?? "").toUpperCase() === code.toUpperCase())
                ?? records[0];
            if (!matched) {
                setError("Could not find user with this code");
                return null;
            }
            return {
                publicKeyHex: matched.pubkey as PublicKeyHex,
                displayName: matched.displayName || matched.name,
                avatar: matched.picture,
                about: matched.about,
            };
        } catch {
            setError("Could not find user with this code");
            return null;
        } finally {
            setIsResolving(false);
        }
    }, [pool]);

    return useMemo(() => ({
        resolveCode,
        isResolving,
        error
    }), [resolveCode, isResolving, error]);
};
