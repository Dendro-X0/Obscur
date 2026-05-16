"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getResolvedClientGateway } from "@/app/features/profiles/services/resolve-client-gateway";

/**
 * Applies `stabilizeCommunityMemberPubkeys` when `activeMemberPubkeys` changes, always
 * reading the latest left/expelled lists via refs (avoids one-frame stale closures when
 * roster projection and sealed-community state update in the same tick).
 *
 * Canonical with `community-visible-members` + `community-member-roster-projection`;
 * used by group home and management participant lists (R2 single stabilization owner).
 */
export const useStableCommunityParticipantPubkeys = (params: Readonly<{
    activeMemberPubkeys: ReadonlyArray<PublicKeyHex>;
    leftMemberPubkeys: ReadonlyArray<PublicKeyHex>;
    expelledMemberPubkeys: ReadonlyArray<PublicKeyHex>;
}>): ReadonlyArray<PublicKeyHex> => {
    const { activeMemberPubkeys, leftMemberPubkeys, expelledMemberPubkeys } = params;
    const [stable, setStable] = useState<ReadonlyArray<PublicKeyHex>>(activeMemberPubkeys);
    const leftRef = useRef(leftMemberPubkeys);
    const expelledRef = useRef(expelledMemberPubkeys);

    useEffect(() => {
        leftRef.current = leftMemberPubkeys;
        expelledRef.current = expelledMemberPubkeys;
    }, [leftMemberPubkeys, expelledMemberPubkeys]);

    useEffect(() => {
        setStable((previous) => {
            const result = getResolvedClientGateway().communityRoster.stabilizeMemberPubkeys({
                previousMemberPubkeys: previous,
                nextMemberPubkeys: activeMemberPubkeys,
                leftMemberPubkeys: leftRef.current,
                expelledMemberPubkeys: expelledRef.current,
            });
            return result.nextMemberPubkeys.join(",") === previous.join(",")
                ? previous
                : result.nextMemberPubkeys;
        });
    }, [activeMemberPubkeys]);

    return stable;
};
