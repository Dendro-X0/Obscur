import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { dedupeCommunityMemberPubkeys } from "./community-member-roster-projection";

const SESSION_STORAGE_PREFIX = "obscur.community.participant-roster.session.v1";

const toSessionStorageKey = (conversationId: string, profileId: string): string => (
  `${SESSION_STORAGE_PREFIX}.${profileId}.${conversationId}`
);

export const loadCommunityParticipantRosterSession = (
  conversationId: string,
  profileId: string,
): ReadonlyArray<PublicKeyHex> => {
  if (!conversationId || typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.sessionStorage.getItem(toSessionStorageKey(conversationId, profileId));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return dedupeCommunityMemberPubkeys(
      parsed.filter((entry): entry is PublicKeyHex => typeof entry === "string" && entry.trim().length > 0),
    );
  } catch {
    return [];
  }
};

export const saveCommunityParticipantRosterSession = (
  conversationId: string,
  profileId: string,
  sessionPubkeys: ReadonlyArray<PublicKeyHex>,
): void => {
  if (!conversationId || typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.setItem(
      toSessionStorageKey(conversationId, profileId),
      JSON.stringify(sessionPubkeys),
    );
  } catch {
    return;
  }
};
