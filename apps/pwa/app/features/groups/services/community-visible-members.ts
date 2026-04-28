import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunityMemberProjection } from "@dweb/core/community-projection-contracts";
import {
    dedupeCommunityMemberPubkeys,
    projectCommunityMemberRoster,
} from "./community-member-roster-projection";
import type { RelayEvidenceConfidence } from "./community-member-roster-projection";

export type { RelayEvidenceConfidence };

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

export type StabilizeCommunityMemberPubkeysParams = Readonly<{
    previousMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
    nextMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
    leftMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
    expelledMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
    relayEvidenceConfidence?: RelayEvidenceConfidence;
}>;

export type StabilizeCommunityMemberPubkeysResult = Readonly<{
    shouldApply: boolean;
    reasonCode: "equivalent" | "apply_snapshot" | "apply_snapshot_guard_relaxed" | "missing_removal_evidence";
    nextMemberPubkeys: ReadonlyArray<PublicKeyHex>;
    removedWithoutEvidence: ReadonlyArray<PublicKeyHex>;
    confidence: RelayEvidenceConfidence;
    guardRelaxed: boolean;
}>;

export const stabilizeCommunityMemberPubkeys = (params: StabilizeCommunityMemberPubkeysParams): StabilizeCommunityMemberPubkeysResult => {
    const currentMemberPubkeys = dedupeCommunityMemberPubkeys(params.previousMemberPubkeys ?? []);
    const nextMemberPubkeys = dedupeCommunityMemberPubkeys(params.nextMemberPubkeys ?? []);
    const leftMemberPubkeys = new Set<PublicKeyHex>(params.leftMemberPubkeys ?? []);
    const expelledMemberPubkeys = new Set<PublicKeyHex>(params.expelledMemberPubkeys ?? []);

    // Check for members that appear removed without evidence
    const removedWithoutEvidence = currentMemberPubkeys.filter((pubkey) => (
        !nextMemberPubkeys.includes(pubkey)
        && !leftMemberPubkeys.has(pubkey)
        && !expelledMemberPubkeys.has(pubkey)
    ));

    // During relay warm-up, allow snapshot even if it appears to remove members
    // This handles the case where relay sends partial data initially
    const isRelayWarmUp = params.relayEvidenceConfidence === "seed_only" ||
        (params.relayEvidenceConfidence === "warming_up" && currentMemberPubkeys.length <= 2);

    if (removedWithoutEvidence.length > 0 && !isRelayWarmUp) {
        return {
            shouldApply: false,
            reasonCode: "missing_removal_evidence",
            nextMemberPubkeys: currentMemberPubkeys,
            removedWithoutEvidence,
            confidence: params.relayEvidenceConfidence ?? "unknown",
            guardRelaxed: false,
        };
    }

    if (currentMemberPubkeys.join(",") === nextMemberPubkeys.join(",")) {
        return {
            shouldApply: false,
            reasonCode: "equivalent",
            nextMemberPubkeys: currentMemberPubkeys,
            removedWithoutEvidence: [],
            confidence: params.relayEvidenceConfidence ?? "unknown",
            guardRelaxed: isRelayWarmUp && removedWithoutEvidence.length > 0,
        };
    }

    return {
        shouldApply: true,
        reasonCode: removedWithoutEvidence.length > 0 && isRelayWarmUp
            ? "apply_snapshot_guard_relaxed"
            : "apply_snapshot",
        nextMemberPubkeys,
        removedWithoutEvidence: [],
        confidence: params.relayEvidenceConfidence ?? "unknown",
        guardRelaxed: isRelayWarmUp && removedWithoutEvidence.length > 0,
    };
};
