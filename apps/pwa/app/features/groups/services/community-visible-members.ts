import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { isDeletedAccountProfile } from "@/app/features/profile/utils/deleted-profile";

export type GroupMemberProfileLike = Readonly<{
    displayName?: string | null;
    name?: string | null;
    about?: string | null;
}>;

export type ResolveGroupMemberProfile = (pubkey: string) => GroupMemberProfileLike | null | undefined;

export const filterVisibleGroupMembers = (
    memberPubkeys: ReadonlyArray<PublicKeyHex>,
    resolveProfile: ResolveGroupMemberProfile
): ReadonlyArray<PublicKeyHex> => {
    return memberPubkeys.filter((pubkey) => {
        const profile = resolveProfile(pubkey);
        return !isDeletedAccountProfile({
            displayName: profile?.displayName ?? profile?.name,
            about: profile?.about,
        });
    });
};
