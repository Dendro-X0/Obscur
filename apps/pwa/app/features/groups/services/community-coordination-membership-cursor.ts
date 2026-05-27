import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";

const CURSOR_PREFIX = "obscur.community.coordination_membership_seq.v1";

const toKey = (communityId: string, profileId?: string): string => (
  getScopedStorageKey(`${CURSOR_PREFIX}.${communityId.trim()}`, profileId ?? getResolvedProfileId())
);

export const loadCoordinationMembershipSeqCursor = (
  communityId: string,
  profileId?: string,
): number => {
  if (typeof window === "undefined") {
    return 0;
  }
  try {
    const raw = window.localStorage.getItem(toKey(communityId, profileId));
    if (!raw) {
      return 0;
    }
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
};

export const saveCoordinationMembershipSeqCursor = (
  communityId: string,
  seq: number,
  profileId?: string,
): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(toKey(communityId, profileId), String(Math.max(0, Math.floor(seq))));
  } catch {
    // ignore
  }
};
