import { normalizePublicUrl } from "@/app/shared/public-url";

/**
 * OS / Tauri toasts need a fetchable absolute https avatar.
 * Content-kind SVG data-URIs and relative paths are not peer avatars.
 */
export const resolveNotificationPeerIconUrl = (params: Readonly<{
  groupAvatar?: string | null;
  senderPicture?: string | null;
}>): string | undefined => {
  const candidates = [params.groupAvatar, params.senderPicture];
  for (const candidate of candidates) {
    const normalized = normalizePublicUrl(candidate);
    if (normalized.startsWith("https://")) {
      return normalized;
    }
  }
  return undefined;
};
