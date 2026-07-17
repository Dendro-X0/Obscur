import type { AttachmentKind } from "@/app/features/messaging/types";
import type { VaultMediaItem } from "@/app/features/vault/types/vault-media-item";
import type { LesObjectMeta } from "./les-native-sdk";

/** Transparent 1×1 GIF used until LES decrypt yields a blob URL. */
export const LES_PREVIEW_PENDING_PLACEHOLDER =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

/** Placeholder or catalog identity — not yet playable in <video>/<img>. */
export const isLesPreviewPendingUrl = (url: string): boolean => {
  const trimmed = url.trim();
  return trimmed === LES_PREVIEW_PENDING_PLACEHOLDER || trimmed.startsWith("les://");
};

/** Blob or remote URL ready for media playback (excludes LES pending placeholders). */
export const isVaultMediaPlaybackUrl = (url: string): boolean => {
  const trimmed = url.trim().toLowerCase();
  if (!trimmed || isLesPreviewPendingUrl(url)) {
    return false;
  }
  return (
    trimmed.startsWith("blob:")
    || trimmed.startsWith("http://")
    || trimmed.startsWith("https://")
    || trimmed.startsWith("asset:")
    || trimmed.startsWith("tauri://")
    || trimmed.startsWith("https://asset.localhost")
  );
};

/** Seek first frame for remote video posters only (not blob/data). */
export const buildVideoPosterSeekUrl = (sourceUrl: string): string => {
  const trimmed = sourceUrl.trim();
  if (!trimmed || trimmed.includes("#") || isLesPreviewPendingUrl(trimmed)) {
    return trimmed;
  }
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("blob:") || lower.startsWith("data:")) {
    return trimmed;
  }
  if (lower.startsWith("http://") || lower.startsWith("https://")) {
    return `${trimmed}#t=0.1`;
  }
  return trimmed;
};

/** Stable identity key for VaultMediaGrid favorites / filters (not a network URL). */
export const buildLesRemoteUrl = (profileId: string, lesObjectId: string): string =>
  `les://${encodeURIComponent(profileId.trim() || "default")}/${encodeURIComponent(lesObjectId.trim())}`;

export const parseLesRemoteUrl = (
  url: string,
): Readonly<{ profileId: string; lesObjectId: string }> | null => {
  const trimmed = url.trim();
  if (!trimmed.startsWith("les://")) {
    return null;
  }
  const rest = trimmed.slice("les://".length);
  const slash = rest.indexOf("/");
  if (slash <= 0 || slash >= rest.length - 1) {
    return null;
  }
  try {
    return {
      profileId: decodeURIComponent(rest.slice(0, slash)),
      lesObjectId: decodeURIComponent(rest.slice(slash + 1)),
    };
  } catch {
    return null;
  }
};

const toAttachmentKind = (kind: string): AttachmentKind => {
  switch (kind.trim().toLowerCase()) {
    case "image":
      return "image";
    case "video":
      return "video";
    case "audio":
      return "audio";
    case "voice_note":
      return "voice_note";
    default:
      return "file";
  }
};

/**
 * Maps LES catalog metadata into the existing VaultMediaGrid item shape.
 * Preview bytes belong in `previewUrl` (blob: or data: placeholder) after decrypt.
 * Never pass `les://` as the attachment URL — the grid cannot render it as media.
 */
export const mapLesMetaToVaultMediaItem = (
  meta: LesObjectMeta,
  previewUrl?: string | null,
): VaultMediaItem => {
  const remoteUrl = buildLesRemoteUrl(meta.profileId, meta.lesObjectId);
  const url = previewUrl?.trim() || LES_PREVIEW_PENDING_PLACEHOLDER;
  return {
    id: meta.lesObjectId,
    messageId: meta.lesObjectId,
    remoteUrl,
    isLocalCached: true,
    localRelativePath: meta.relativePath,
    sourceConversationId: null,
    timestamp: new Date(Number.isFinite(meta.createdAtUnixMs) ? meta.createdAtUnixMs : Date.now()),
    attachment: {
      kind: toAttachmentKind(meta.kind),
      url,
      contentType: meta.contentType || "application/octet-stream",
      fileName: meta.displayName || meta.lesObjectId,
    },
  };
};
