"use client";

import { useMemo } from "react";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useProfile } from "@/app/features/profile/hooks/use-profile";
import { useProfileMetadata, type UseProfileMetadataOptions } from "./use-profile-metadata";
import { normalizePublicUrl } from "@/app/shared/public-url";
import { isDeletedAccountProfile } from "@/app/features/profile/utils/deleted-profile";

export type ResolvedProfileMetadata = Readonly<{
  isSelf: boolean;
  isDeleted: boolean;
  displayName?: string;
  avatarUrl?: string;
  about?: string;
  nip05?: string;
}>;

export const useResolvedProfileMetadata = (
  pubkey: string | null,
  options: UseProfileMetadataOptions = {},
): ResolvedProfileMetadata => {
  const metadata = useProfileMetadata(pubkey, options);
  const profile = useProfile();
  const { state: identityState } = useIdentity();

  const myPubkey = identityState.publicKeyHex ?? identityState.stored?.publicKeyHex ?? null;
  const isSelf = Boolean(pubkey && myPubkey && pubkey === myPubkey);

  return useMemo(() => {
    const localName = profile.state.profile.username.trim();
    const localAvatar = normalizePublicUrl(profile.state.profile.avatarUrl);
    const localAbout = (profile.state.profile.about || "").trim();
    const localNip05 = (profile.state.profile.nip05 || "").trim();
    const deleted = isDeletedAccountProfile({
      displayName: metadata?.displayName,
      about: metadata?.about,
    });

    return {
      isSelf,
      isDeleted: deleted,
      displayName: metadata?.displayName || (isSelf ? localName || undefined : undefined),
      avatarUrl: deleted
        ? undefined
        : (normalizePublicUrl(metadata?.avatarUrl) || (isSelf ? localAvatar || undefined : undefined)),
      about: metadata?.about || (isSelf ? localAbout || undefined : undefined),
      nip05: metadata?.nip05 || (isSelf ? localNip05 || undefined : undefined),
    };
  }, [
    isSelf,
    metadata?.about,
    metadata?.avatarUrl,
    metadata?.displayName,
    metadata?.nip05,
    profile.state.profile.about,
    profile.state.profile.avatarUrl,
    profile.state.profile.nip05,
    profile.state.profile.username,
  ]);
};
