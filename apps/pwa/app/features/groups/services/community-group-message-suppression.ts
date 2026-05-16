import { messagingClientOperations } from "@/app/features/messaging/services/messaging-client-operations";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";

/** Local delete-for-me / durable tombstones for sealed community timeline rows. */
export const isSuppressedCommunityGroupMessageIdentity = (
  params: Readonly<{
    messageId?: string | null;
    eventId?: string | null;
    profileId?: string;
    nowMs?: number;
  }>,
): boolean => {
  const profileId = params.profileId?.trim() || getResolvedProfileId() || undefined;
  const nowMs = params.nowMs ?? Date.now();
  const candidates = [params.messageId, params.eventId]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);
  return candidates.some((id) => messagingClientOperations.isDmMessageSuppressed(id, profileId, nowMs));
};
