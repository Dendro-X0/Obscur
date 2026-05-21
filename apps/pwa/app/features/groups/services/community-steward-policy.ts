import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunityMode } from "../types/community-mode";

export type CommunityAuthorityMode =
    | "solo_steward"
    | "member_vote"
    | "designated_stewards";

export type CommunityStewardPolicy = Readonly<{
    authorityMode: CommunityAuthorityMode;
    isDesignatedSteward: boolean;
    requiresGovernanceVoteForDescriptor: boolean;
    requiresGovernanceVoteForExpel: boolean;
    canDirectDescriptorUpdate: boolean;
    canDirectMemberExpel: boolean;
}>;

const normalizePublicKeyHex = (value: string): PublicKeyHex | null => {
    const trimmed = value.trim();
    return trimmed.length === 64 ? (trimmed as PublicKeyHex) : null;
};

/** Dedupe and validate steward pubkeys from descriptor metadata. */
export const readStewardPubkeysFromMetadataField = (
    value: unknown,
): ReadonlyArray<PublicKeyHex> => (
    Array.isArray(value)
        ? normalizeCommunityStewardPubkeys(value.filter((entry): entry is string => typeof entry === "string"))
        : []
);

export const normalizeCommunityStewardPubkeys = (
    pubkeys: ReadonlyArray<string> | undefined,
): ReadonlyArray<PublicKeyHex> => {
    if (!pubkeys?.length) {
        return [];
    }
    const seen = new Set<string>();
    const normalized: PublicKeyHex[] = [];
    for (const entry of pubkeys) {
        const pubkey = normalizePublicKeyHex(entry);
        if (!pubkey || seen.has(pubkey)) {
            continue;
        }
        seen.add(pubkey);
        normalized.push(pubkey);
    }
    return normalized;
};

export const resolveInitialStewardPubkeysForCreate = (params: Readonly<{
    communityMode: CommunityMode;
    creatorPublicKeyHex: PublicKeyHex;
}>): ReadonlyArray<PublicKeyHex> => (
    params.communityMode === "managed_workspace"
        ? [params.creatorPublicKeyHex]
        : []
);

export const isCommunityDesignatedSteward = (params: Readonly<{
    stewardPubkeys: ReadonlyArray<PublicKeyHex>;
    actorPublicKeyHex: string | null;
}>): boolean => {
    const actor = params.actorPublicKeyHex?.trim();
    if (!actor) {
        return false;
    }
    return params.stewardPubkeys.some((pubkey) => pubkey === actor);
};

/**
 * Resolves whether descriptor/expel actions need governance vs direct publish (P3.2).
 * Sovereign multi-member communities use member_vote; managed uses designated stewards.
 */
export const resolveCommunityStewardPolicy = (params: Readonly<{
    communityMode?: CommunityMode;
    stewardPubkeys?: ReadonlyArray<string>;
    actorPublicKeyHex: string | null;
    activeMemberCount: number;
}>): CommunityStewardPolicy => {
    const stewards = normalizeCommunityStewardPubkeys(params.stewardPubkeys);
    const isSteward = isCommunityDesignatedSteward({
        stewardPubkeys: stewards,
        actorPublicKeyHex: params.actorPublicKeyHex,
    });

    if (params.activeMemberCount <= 1) {
        return {
            authorityMode: "solo_steward",
            isDesignatedSteward: isSteward,
            requiresGovernanceVoteForDescriptor: false,
            requiresGovernanceVoteForExpel: true,
            canDirectDescriptorUpdate: true,
            canDirectMemberExpel: false,
        };
    }

    if (params.communityMode === "managed_workspace" && isSteward) {
        return {
            authorityMode: "designated_stewards",
            isDesignatedSteward: true,
            requiresGovernanceVoteForDescriptor: false,
            requiresGovernanceVoteForExpel: false,
            canDirectDescriptorUpdate: true,
            canDirectMemberExpel: true,
        };
    }

    return {
        authorityMode: "member_vote",
        isDesignatedSteward: isSteward,
        requiresGovernanceVoteForDescriptor: true,
        requiresGovernanceVoteForExpel: true,
        canDirectDescriptorUpdate: false,
        canDirectMemberExpel: false,
    };
};
