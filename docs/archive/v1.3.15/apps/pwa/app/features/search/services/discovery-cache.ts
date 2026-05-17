"use client";

import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { INVITE_CODE_PREFIX } from "@/app/features/invites/utils/invite-code-format";

export type DiscoveryProfileRecord = Readonly<{
    pubkey: string;
    name?: string;
    displayName?: string;
    about?: string;
    picture?: string;
    nip05?: string;
    inviteCode?: string;
    updatedAtUnixMs: number;
}>;

type DiscoveryCacheState = Readonly<{
    version: 1;
    profiles: ReadonlyArray<DiscoveryProfileRecord>;
}>;

const getStorageKey = (): string => getScopedStorageKey("obscur.discovery.cache.v1");
const MAX_PROFILE_COUNT = 3000;
const LEGACY_INVITE_CODE_PREFIX = "OBSCUR";
const INVITE_CODE_PREFIXES = Array.from(new Set([INVITE_CODE_PREFIX, LEGACY_INVITE_CODE_PREFIX]));

const normalize = (value: unknown): string | undefined => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
};

const toInviteCode = (value: unknown): string | undefined => {
    const normalized = normalize(value);
    if (!normalized) return undefined;
    const upper = normalized.toUpperCase();
    const isAllowed = INVITE_CODE_PREFIXES.some((prefix) => {
        const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`^${escaped}-[A-Z0-9]{4,16}$`).test(upper);
    });
    return isAllowed ? upper : undefined;
};

const readState = (): DiscoveryCacheState => {
    if (typeof window === "undefined") {
        return { version: 1, profiles: [] };
    }
    try {
        const raw = window.localStorage.getItem(getStorageKey());
        if (!raw) return { version: 1, profiles: [] };
        const parsed = JSON.parse(raw) as DiscoveryCacheState;
        if (parsed?.version !== 1 || !Array.isArray(parsed.profiles)) {
            return { version: 1, profiles: [] };
        }
        return parsed;
    } catch {
        return { version: 1, profiles: [] };
    }
};

const writeState = (state: DiscoveryCacheState): void => {
    if (typeof window === "undefined") {
        return;
    }
    try {
        window.localStorage.setItem(getStorageKey(), JSON.stringify(state));
    } catch {
        // Ignore cache write errors.
    }
};

const extractInviteCode = (about?: string): string | undefined => {
    if (!about) return undefined;
    for (const prefix of INVITE_CODE_PREFIXES) {
        const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const match = about.match(new RegExp(`\\b${escaped}-[A-Z0-9]{4,16}\\b`, "i"));
        if (match?.[0]) {
            return match[0].toUpperCase();
        }
    }
    return undefined;
};

const buildQueryText = (record: DiscoveryProfileRecord): string => {
    return [
        record.pubkey,
        record.name,
        record.displayName,
        record.about,
        record.nip05,
        record.inviteCode,
    ]
        .filter((v): v is string => typeof v === "string" && v.length > 0)
        .join(" ")
        .toLowerCase();
};

const upsertProfile = (input: Readonly<{
    pubkey: string;
    name?: string;
    displayName?: string;
    about?: string;
    picture?: string;
    nip05?: string;
    inviteCode?: string;
}>): DiscoveryProfileRecord => {
    const state = readState();
    const now = Date.now();
    const normalizedInviteCode = toInviteCode(input.inviteCode) ?? extractInviteCode(input.about);
    const nextRecord: DiscoveryProfileRecord = {
        pubkey: input.pubkey,
        name: normalize(input.name),
        displayName: normalize(input.displayName),
        about: normalize(input.about),
        picture: normalize(input.picture),
        nip05: normalize(input.nip05),
        inviteCode: normalizedInviteCode,
        updatedAtUnixMs: now,
    };

    const withoutExisting = state.profiles.filter((profile) => profile.pubkey !== input.pubkey);
    const nextProfiles = [nextRecord, ...withoutExisting].slice(0, MAX_PROFILE_COUNT);
    writeState({ version: 1, profiles: nextProfiles });
    return nextRecord;
};

const searchProfiles = (query: string, limit = 50): ReadonlyArray<DiscoveryProfileRecord> => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const state = readState();
    const matches = state.profiles.filter((profile) => buildQueryText(profile).includes(q));
    return matches.slice(0, Math.max(1, limit));
};

const resolveInviteCode = (inviteCode: string): DiscoveryProfileRecord | null => {
    const normalizedCode = toInviteCode(inviteCode);
    if (!normalizedCode) return null;
    const state = readState();
    const matched = state.profiles.find((profile) => profile.inviteCode === normalizedCode);
    return matched ?? null;
};

const getProfiles = (limit = 100): ReadonlyArray<DiscoveryProfileRecord> => {
    const state = readState();
    return state.profiles.slice(0, Math.max(1, limit));
};

const getProfile = (pubkey: string): DiscoveryProfileRecord | null => {
    const normalized = normalize(pubkey);
    if (!normalized) return null;
    const state = readState();
    return state.profiles.find((profile) => profile.pubkey === normalized) ?? null;
};

export const discoveryCache = {
    upsertProfile,
    searchProfiles,
    resolveInviteCode,
    getProfiles,
    getProfile,
};

export const discoveryCacheInternals = {
    getStorageKey,
};
