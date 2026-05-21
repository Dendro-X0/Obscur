/**
 * UI-facing membership evidence tiers for community rosters.
 * `relay_confirmed` — relay/CRDT membership; `provisional` — local TTL after invite accept;
 * `terminal` — hidden from active roster by leave/expulsion evidence.
 */
export type CommunityMemberEvidenceTier = "relay_confirmed" | "provisional" | "terminal";

export type CommunityTerminalMemberKind = "left" | "expelled";

const norm = (pk: string): string => pk.trim().toLowerCase();

export const resolveCommunityMemberEvidenceTier = (
    pubkey: string,
    params: Readonly<{
        activeMemberPubkeys: ReadonlyArray<string>;
        provisionalMemberPubkeys: ReadonlyArray<string>;
    }>,
): CommunityMemberEvidenceTier => {
    const key = norm(pubkey);
    const active = new Set(params.activeMemberPubkeys.map(norm));
    if (active.has(key)) {
        return "relay_confirmed";
    }
    const provisional = new Set(params.provisionalMemberPubkeys.map(norm));
    if (provisional.has(key)) {
        return "provisional";
    }
    return "relay_confirmed";
};
