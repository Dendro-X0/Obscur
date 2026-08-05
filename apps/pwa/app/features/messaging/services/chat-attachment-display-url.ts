/**
 * Chat attachment display URL resolution (paint only).
 * Network / message identity URL stays on `attachment.url`; never persist blob/les results.
 *
 * Spec: specs/backend/chat-image-load-after-restart-design-2026-08.md
 */

import { normalizeAttachmentUrl } from "@/app/shared/public-url";
import { resolveVaultProfileId } from "@/app/features/storage/services/vault-at-rest";
import {
  fetchRemoteAttachmentBytesForVaultSave,
  resolveLocalMediaUrl,
} from "@/app/features/vault/services/local-media-store";
import { registerVaultMediaBlobUrl } from "@/app/features/vault/services/vault-media-blob-lifecycle";
import {
  isLesNativeAvailable,
  listLesObjects,
  readLesObjectDecrypted,
} from "@/app/features/les/sdk/les-native-sdk";

export const isPersistedBlobAttachmentUrl = (url: string): boolean =>
  url.trim().toLowerCase().startsWith("blob:");

export const isSessionOnlyMediaUrl = (url: string): boolean => {
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed.startsWith("blob:")
    || trimmed.startsWith("data:")
    || trimmed.startsWith("asset:")
    || trimmed.startsWith("file:")
    || trimmed.includes("asset.localhost")
    || trimmed.includes("ipc.localhost")
  );
};

const isRemoteHttpUrl = (url: string): boolean => {
  const trimmed = url.trim().toLowerCase();
  return trimmed.startsWith("https:") || trimmed.startsWith("http:");
};

const bytesToRegisteredBlobUrl = (remoteUrl: string, bytes: Uint8Array, contentType?: string): string => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: contentType?.trim() || "application/octet-stream" });
  return registerVaultMediaBlobUrl(remoteUrl, URL.createObjectURL(blob));
};

export const resolveLesDisplayUrlForSourceAttachment = async (
  remoteUrl: string,
): Promise<string | null> => {
  if (!isLesNativeAvailable()) {
    return null;
  }
  const normalized = normalizeAttachmentUrl(remoteUrl) || remoteUrl.trim();
  if (!normalized) {
    return null;
  }
  const profileId = resolveVaultProfileId().trim() || undefined;
  try {
    const rows = await listLesObjects(profileId);
    const match = rows.find((row) => {
      const source = (row.sourceAttachmentUrl ?? "").trim();
      return source === normalized || source === remoteUrl.trim();
    });
    if (!match) {
      return null;
    }
    const bytes = await readLesObjectDecrypted(match.lesObjectId, match.profileId);
    if (!bytes || bytes.byteLength === 0) {
      return null;
    }
    return bytesToRegisteredBlobUrl(normalized, bytes, match.contentType);
  } catch {
    return null;
  }
};

/**
 * Prefer local vault / LES decrypted bytes; else return the remote identity URL.
 */
export const resolveChatAttachmentDisplayUrl = async (remoteUrl: string): Promise<string> => {
  const url = remoteUrl.trim();
  if (!url) {
    return url;
  }
  if (isSessionOnlyMediaUrl(url)) {
    return url;
  }

  try {
    const local = await resolveLocalMediaUrl(url);
    if (local) {
      return local;
    }
  } catch {
    // continue
  }

  try {
    const les = await resolveLesDisplayUrlForSourceAttachment(url);
    if (les) {
      return les;
    }
  } catch {
    // continue
  }

  return url;
};

/**
 * After a webview &lt;img&gt; failure: re-resolve local/LES, then native HTTP → blob once.
 */
export const fetchChatAttachmentDisplayFallback = async (
  remoteUrl: string,
): Promise<string | null> => {
  const url = remoteUrl.trim();
  if (!url || !isRemoteHttpUrl(url)) {
    return null;
  }

  const preferred = await resolveChatAttachmentDisplayUrl(url);
  if (preferred !== url && isSessionOnlyMediaUrl(preferred)) {
    return preferred;
  }
  if (preferred !== url && !isRemoteHttpUrl(preferred)) {
    return preferred;
  }

  const bytes = await fetchRemoteAttachmentBytesForVaultSave(url);
  if (!bytes || bytes.byteLength === 0) {
    return null;
  }
  return bytesToRegisteredBlobUrl(url, bytes);
};
