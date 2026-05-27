import { normalizeCommunityInvitePayload } from "@/app/features/groups/utils/community-invite-payload";

/** DM rows that must render as invite/response cards, not plain text bubbles. */
export const isCommunityInviteThreadPayloadContent = (content: string): boolean => {
  if (!content || typeof content !== "string") {
    return false;
  }
  try {
    const parsed = normalizeCommunityInvitePayload(JSON.parse(content));
    if (parsed?.type === "community-invite") {
      return true;
    }
    const raw = JSON.parse(content) as { type?: unknown };
    return raw?.type === "community-invite-response";
  } catch {
    return false;
  }
};
