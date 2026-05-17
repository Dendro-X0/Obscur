import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

export type GroupMemberProfileLike = Readonly<{
    displayName?: string | null;
    name?: string | null;
    about?: string | null;
}>;

export type ResolveGroupMemberProfile = (pubkey: string) => GroupMemberProfileLike | null | undefined;

export const filterVisibleGroupMembers = (
    memberPubkeys: ReadonlyArray<PublicKeyHex>,
    _resolveProfile: ResolveGroupMemberProfile
): ReadonlyArray<PublicKeyHex> => {
    // Community membership visibility must follow canonical membership evidence,
    // not opportunistic profile cache state. A stale "deleted"/hidden profile cache
    // entry should never erase a valid member from the roster UI.
    return memberPubkeys;
};
