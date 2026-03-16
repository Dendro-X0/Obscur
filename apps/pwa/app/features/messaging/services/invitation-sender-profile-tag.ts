"use client";

import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { normalizePublicUrl } from "@/app/shared/public-url";

const LOCAL_PROFILE_STORAGE_KEY = "dweb.nostr.pwa.profile";
const SENDER_PROFILE_TAG = "obscur-sender-profile-v1";
const MAX_PROFILE_TAG_BYTES = 1024;

type LocalProfileState = Readonly<{
  version: number;
  profile?: Readonly<{
    username?: string;
    avatarUrl?: string;
    about?: string;
    nip05?: string;
  }>;
}>;

export type InvitationSenderProfile = Readonly<{
  displayName?: string;
  avatarUrl?: string;
  about?: string;
  nip05?: string;
}>;

const normalizeText = (value: unknown, maxLength: number): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
};

const getLocalProfileStorageKey = (): string => getScopedStorageKey(LOCAL_PROFILE_STORAGE_KEY);

const readLocalInvitationSenderProfile = (): InvitationSenderProfile | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getLocalProfileStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalProfileState;
    const profile = parsed?.profile;
    if (!profile || parsed.version !== 1) return null;
    const next: InvitationSenderProfile = {
      displayName: normalizeText(profile.username, 80),
      avatarUrl: normalizePublicUrl(normalizeText(profile.avatarUrl, 512)),
      about: normalizeText(profile.about, 280),
      nip05: normalizeText(profile.nip05, 160),
    };
    if (!next.displayName && !next.avatarUrl && !next.about && !next.nip05) {
      return null;
    }
    return next;
  } catch {
    return null;
  }
};

export const buildInvitationSenderProfileTag = (): string[] | null => {
  const profile = readLocalInvitationSenderProfile();
  if (!profile) return null;
  const encoded = JSON.stringify({ v: 1, ...profile });
  if (encoded.length > MAX_PROFILE_TAG_BYTES) {
    return null;
  }
  return [SENDER_PROFILE_TAG, encoded];
};

export const readInvitationSenderProfileFromTags = (
  tags: ReadonlyArray<ReadonlyArray<string>>
): InvitationSenderProfile | null => {
  const encoded = tags.find((tag) => tag[0] === SENDER_PROFILE_TAG)?.[1];
  if (!encoded || encoded.length > MAX_PROFILE_TAG_BYTES) {
    return null;
  }
  try {
    const parsed = JSON.parse(encoded) as Readonly<Record<string, unknown>>;
    if (parsed.v !== 1) {
      return null;
    }
    const profile: InvitationSenderProfile = {
      displayName: normalizeText(parsed.displayName, 80),
      avatarUrl: normalizePublicUrl(normalizeText(parsed.avatarUrl, 512)),
      about: normalizeText(parsed.about, 280),
      nip05: normalizeText(parsed.nip05, 160),
    };
    if (!profile.displayName && !profile.avatarUrl && !profile.about && !profile.nip05) {
      return null;
    }
    return profile;
  } catch {
    return null;
  }
};

export const invitationSenderProfileTagInternals = {
  getLocalProfileStorageKey,
  readLocalInvitationSenderProfile,
  SENDER_PROFILE_TAG,
};
