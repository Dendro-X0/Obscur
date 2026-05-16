import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunityMemberProjection } from "@dweb/core/community-projection-contracts";
import {
    mergeKnownParticipantSeedPubkeys,
    type CommunityKnownParticipantDirectory,
} from "./community-known-participant-directory";
import {
    dedupeCommunityMemberPubkeys,
    projectCommunityMemberRoster,
    stabilizeCommunityMemberPubkeys as stabilizeCommunityMemberPubkeysFromRoster,
} from "./community-member-roster-projection";
import type { RelayEvidenceConfidence } from "./community-member-roster-projection";
import type { StabilizeCommunityMemberPubkeysResult } from "./community-member-roster-projection";

export type { RelayEvidenceConfidence, StabilizeCommunityMemberPubkeysResult };

export type GroupMemberProfileLike = Readonly<{
    displayName?: string | null;
    name?: string | null;
    about?: string | null;
}>;

export type ResolveGroupMemberProfile = (pubkey: string) => GroupMemberProfileLike | null | undefined;

export const mergeKnownCommunityMemberPubkeys = (params: Readonly<{
    seededMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
    liveMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
    authorEvidencePubkeys?: ReadonlyArray<PublicKeyHex>;
}>): ReadonlyArray<PublicKeyHex> => (
    projectCommunityMemberRoster({
        seededMemberPubkeys: params.seededMemberPubkeys,
        liveMemberPubkeys: params.liveMemberPubkeys,
        authorEvidencePubkeys: params.authorEvidencePubkeys,
    }).allKnownMemberPubkeys
);

export const resolveCommunitySeedMemberPubkeys = (params: Readonly<{
    seededMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
    projectionMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
    localMemberPubkey?: PublicKeyHex | null;
}>): ReadonlyArray<PublicKeyHex> => (
    projectCommunityMemberRoster({
        seededMemberPubkeys: params.seededMemberPubkeys,
        liveMemberPubkeys: params.projectionMemberPubkeys,
        localMemberPubkey: params.localMemberPubkey,
    }).allKnownMemberPubkeys
);

/** Directory ∪ persisted `memberPubkeys` → seed, then union with roster projection + local (sealed-community / management UIs). */
export const resolveCommunitySeedMemberPubkeysFromDirectory = (params: Readonly<{
    directory: CommunityKnownParticipantDirectory | null | undefined;
    persistedGroupMemberPubkeys?: ReadonlyArray<PublicKeyHex> | null;
    projectionMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
    localMemberPubkey?: PublicKeyHex | null;
}>): ReadonlyArray<PublicKeyHex> => (
    resolveCommunitySeedMemberPubkeys({
        seededMemberPubkeys: mergeKnownParticipantSeedPubkeys({
            directory: params.directory ?? null,
            persistedGroupMemberPubkeys: params.persistedGroupMemberPubkeys,
        }),
        projectionMemberPubkeys: params.projectionMemberPubkeys,
        localMemberPubkey: params.localMemberPubkey,
    })
);

export const resolveVisibleCommunityMemberPubkeys = (params: Readonly<{
    seededMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
    projectionMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
    authorEvidencePubkeys?: ReadonlyArray<PublicKeyHex>;
    localMemberPubkey?: PublicKeyHex | null;
    leftMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
    expelledMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
}>): ReadonlyArray<PublicKeyHex> => (
    projectCommunityMemberRoster({
        seededMemberPubkeys: params.seededMemberPubkeys,
        liveMemberPubkeys: params.projectionMemberPubkeys,
        authorEvidencePubkeys: params.authorEvidencePubkeys,
        localMemberPubkey: params.localMemberPubkey,
        leftMemberPubkeys: params.leftMemberPubkeys,
        expelledMemberPubkeys: params.expelledMemberPubkeys,
    }).activeMemberPubkeys
);

/** Dedupe message `pubkey` values for `resolveVisibleCommunityMemberPubkeys` author-evidence input. Used by group home / management UIs, **`group-provider`** hydrate (`groupMessageAuthorsByConversationId` + member backfill), and **`collectGroupMessageAuthorPubkeys`**. Prefer **`resolveActiveCommunityMemberPubkeysFromConversation`** when computing active roster + author evidence together. */
export const resolveAuthorEvidencePubkeysFromCommunityMessages = (
    messages: ReadonlyArray<Readonly<{ pubkey?: string | null }>>,
): ReadonlyArray<PublicKeyHex> => (
    Array.from(new Set(
        messages
            .map((message) => message.pubkey?.trim() ?? "")
            .filter((pubkey) => pubkey.length > 0),
    )) as ReadonlyArray<PublicKeyHex>
);

export type ResolveActiveCommunityMemberPubkeysFromConversationParams = Readonly<{
    communityMessages: ReadonlyArray<Readonly<{ pubkey?: string | null }>>;
    seededMemberPubkeys: ReadonlyArray<PublicKeyHex>;
    projectionMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
    localMemberPubkey?: PublicKeyHex | null;
    leftMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
    expelledMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
}>;

export type ActiveCommunityMemberPubkeysResolution = Readonly<{
    activeMemberPubkeys: ReadonlyArray<PublicKeyHex>;
    authorEvidencePubkeys: ReadonlyArray<PublicKeyHex>;
}>;

/** Single pass: timeline authors → `resolveVisibleCommunityMemberPubkeys` (group home / management). */
export const resolveActiveCommunityMemberPubkeysFromConversation = (
    params: ResolveActiveCommunityMemberPubkeysFromConversationParams,
): ActiveCommunityMemberPubkeysResolution => {
    const authorEvidencePubkeys = resolveAuthorEvidencePubkeysFromCommunityMessages(params.communityMessages);
    const activeMemberPubkeys = resolveVisibleCommunityMemberPubkeys({
        seededMemberPubkeys: params.seededMemberPubkeys,
        projectionMemberPubkeys: params.projectionMemberPubkeys,
        authorEvidencePubkeys,
        localMemberPubkey: params.localMemberPubkey,
        leftMemberPubkeys: params.leftMemberPubkeys,
        expelledMemberPubkeys: params.expelledMemberPubkeys,
    });
    return { activeMemberPubkeys, authorEvidencePubkeys };
};

const isCommunityMemberProjection = (
    value: PublicKeyHex | CommunityMemberProjection,
): value is CommunityMemberProjection => (
    typeof value === "object"
    && value !== null
    && "memberPublicKeyHex" in value
    && "status" in value
);

export const filterVisibleGroupMembers = (
    members: ReadonlyArray<PublicKeyHex | CommunityMemberProjection>,
    _resolveProfile: ResolveGroupMemberProfile
): ReadonlyArray<PublicKeyHex> => {
    // Community membership visibility must follow canonical membership evidence,
    // not opportunistic profile cache state. A stale "deleted"/hidden profile cache
    // entry should never erase a valid member from the roster UI.
    return members
        .filter((member) => (
            !isCommunityMemberProjection(member) || member.status === "joined"
        ))
        .map((member) => (
            isCommunityMemberProjection(member) ? member.memberPublicKeyHex : member
        ));
};

export const filterActiveCommunityMemberPubkeys = (params: Readonly<{
    memberPubkeys: ReadonlyArray<PublicKeyHex>;
    leftMembers?: ReadonlyArray<PublicKeyHex>;
    expelledMembers?: ReadonlyArray<PublicKeyHex>;
}>): ReadonlyArray<PublicKeyHex> => {
    const leftMemberSet = new Set(params.leftMembers ?? []);
    const expelledMemberSet = new Set(params.expelledMembers ?? []);
    return params.memberPubkeys.filter((pubkey) => (
        !leftMemberSet.has(pubkey) && !expelledMemberSet.has(pubkey)
    ));
};

/** Session/UI params (`previous` / `next`); implementation lives in `community-member-roster-projection`. React: `useStableCommunityParticipantPubkeys`. */
export type StabilizeCommunityMemberPubkeysParams = Readonly<{
    previousMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
    nextMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
    leftMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
    expelledMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
    relayEvidenceConfidence?: RelayEvidenceConfidence;
}>;

export const stabilizeCommunityMemberPubkeys = (
    params: StabilizeCommunityMemberPubkeysParams,
): StabilizeCommunityMemberPubkeysResult => (
    stabilizeCommunityMemberPubkeysFromRoster({
        currentMemberPubkeys: params.previousMemberPubkeys ?? [],
        incomingActiveMemberPubkeys: params.nextMemberPubkeys ?? [],
        leftMemberPubkeys: params.leftMemberPubkeys,
        expelledMemberPubkeys: params.expelledMemberPubkeys,
        relayEvidenceConfidence: params.relayEvidenceConfidence,
    })
);
