"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@dweb/ui-kit/toast";
import { useTranslation } from "react-i18next";
import { resolveVaultProfileId } from "@/app/features/storage/services/vault-at-rest";
import type { VaultMediaItem } from "@/app/features/vault/types/vault-media-item";
import {
  registerVaultMediaBlobUrl,
  revokeAllVaultMediaBlobUrls,
  revokeVaultMediaBlobUrl,
} from "@/app/features/vault/services/vault-media-blob-lifecycle";
import { logRuntimeEvent } from "@/app/shared/runtime-log-classification";
import {
  deleteLesObject,
  isLesNativeAvailable,
  listLesObjects,
  readLesObjectDecrypted,
  type LesObjectMeta,
} from "../sdk/les-native-sdk";
import {
  buildLesRemoteUrl,
  isLesPreviewPendingUrl,
  mapLesMetaToVaultMediaItem,
  parseLesRemoteUrl,
  LES_PREVIEW_PENDING_PLACEHOLDER,
} from "../sdk/les-vault-media-adapter";
import {
  exportLesVaultItemToUserPath,
  revealLesVaultItemFolder,
} from "../sdk/les-vault-export";

const PREVIEW_CONCURRENCY = 3;

const bytesToBlobUrl = (bytes: Uint8Array, contentType: string): string => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return URL.createObjectURL(new Blob([copy.buffer], { type: contentType || "application/octet-stream" }));
};

async function mapPool<T>(
  items: ReadonlyArray<T>,
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  const runners = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      await worker(items[current]!);
    }
  });
  await Promise.all(runners);
}

/** Images need thumbs in the grid; heavy media decrypts on preview open. */
const shouldEagerDecryptMeta = (meta: LesObjectMeta): boolean =>
  (meta.kind ?? "").trim().toLowerCase() === "image";

export type UseLesVaultMediaResult = Readonly<{
  mediaItems: ReadonlyArray<VaultMediaItem>;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  ensurePreview: (remoteUrl: string) => Promise<boolean>;
  downloadToLocalPath: (item: VaultMediaItem) => Promise<boolean>;
  deleteLocalCopy: (remoteUrl: string) => Promise<void>;
  openLocalFileLocation: (remoteUrl: string) => Promise<boolean>;
  stats: Readonly<{
    imageCount: number;
    videoCount: number;
    audioCount: number;
    fileCount: number;
    total: number;
  }>;
  available: boolean;
}>;

/**
 * LES catalog → VaultMediaGrid props.
 * Eager decrypt for images only; audio/video/file decrypt on `ensurePreview`.
 */
export function useLesVaultMedia(): UseLesVaultMediaResult {
  const { t } = useTranslation();
  const available = isLesNativeAvailable();
  const profileId = resolveVaultProfileId();
  const [mediaItems, setMediaItems] = useState<ReadonlyArray<VaultMediaItem>>([]);
  const [isLoading, setIsLoading] = useState(available);
  const [error, setError] = useState<string | null>(null);
  const generationRef = useRef(0);
  const itemsRef = useRef(mediaItems);
  const previewByRemoteUrlRef = useRef(new Map<string, string>());
  const metaByRemoteUrlRef = useRef(new Map<string, LesObjectMeta>());
  const inflightPreviewRef = useRef(new Map<string, Promise<boolean>>());
  itemsRef.current = mediaItems;

  const applyPreviewBlob = useCallback((meta: LesObjectMeta, blobUrl: string): void => {
    const remoteUrl = buildLesRemoteUrl(meta.profileId, meta.lesObjectId);
    registerVaultMediaBlobUrl(remoteUrl, blobUrl);
    previewByRemoteUrlRef.current.set(remoteUrl, blobUrl);
    setMediaItems((prev) =>
      prev.map((item) =>
        item.remoteUrl === remoteUrl
          ? mapLesMetaToVaultMediaItem(meta, blobUrl)
          : item,
      ),
    );
  }, []);

  const decryptMetaToPreview = useCallback(async (
    meta: LesObjectMeta,
    generation: number,
  ): Promise<boolean> => {
    const remoteUrl = buildLesRemoteUrl(meta.profileId, meta.lesObjectId);
    const cached = previewByRemoteUrlRef.current.get(remoteUrl);
    if (cached && !isLesPreviewPendingUrl(cached)) {
      return true;
    }
    try {
      const bytes = await readLesObjectDecrypted(meta.lesObjectId, meta.profileId);
      if (generation !== generationRef.current || bytes.byteLength === 0) {
        return false;
      }
      const blobUrl = bytesToBlobUrl(bytes, meta.contentType);
      applyPreviewBlob(meta, blobUrl);
      return true;
    } catch (err) {
      logRuntimeEvent(
        "les.vault_media.preview_decrypt_failed",
        "degraded",
        ["[LES] Preview decrypt failed", {
          lesObjectId: meta.lesObjectId,
          profileId: meta.profileId,
          error: err instanceof Error ? err.message : String(err),
        }],
        { windowMs: 15_000, maxPerWindow: 4, summaryEverySuppressed: 10 },
      );
      return false;
    }
  }, [applyPreviewBlob]);

  const refresh = useCallback(async () => {
    if (!isLesNativeAvailable()) {
      previewByRemoteUrlRef.current.forEach((_, remoteUrl) => {
        revokeVaultMediaBlobUrl(remoteUrl);
      });
      previewByRemoteUrlRef.current.clear();
      metaByRemoteUrlRef.current.clear();
      revokeAllVaultMediaBlobUrls();
      setMediaItems([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const generation = generationRef.current + 1;
    generationRef.current = generation;
    setIsLoading(true);

    try {
      const catalog = await listLesObjects(resolveVaultProfileId().trim() || undefined);
      if (generation !== generationRef.current) {
        return;
      }

      const liveRemoteUrls = new Set(
        catalog.map((meta) => buildLesRemoteUrl(meta.profileId, meta.lesObjectId)),
      );
      for (const [remoteUrl] of [...previewByRemoteUrlRef.current.entries()]) {
        if (!liveRemoteUrls.has(remoteUrl)) {
          revokeVaultMediaBlobUrl(remoteUrl);
          previewByRemoteUrlRef.current.delete(remoteUrl);
        }
      }
      metaByRemoteUrlRef.current = new Map(
        catalog.map((meta) => [buildLesRemoteUrl(meta.profileId, meta.lesObjectId), meta]),
      );

      const initial = catalog.map((meta) => {
        const remoteUrl = buildLesRemoteUrl(meta.profileId, meta.lesObjectId);
        const cached = previewByRemoteUrlRef.current.get(remoteUrl);
        const preview = cached && !isLesPreviewPendingUrl(cached)
          ? cached
          : LES_PREVIEW_PENDING_PLACEHOLDER;
        return mapLesMetaToVaultMediaItem(meta, preview);
      });
      setMediaItems(initial);
      setError(null);
      setIsLoading(false);

      const eager = catalog.filter((meta) => {
        if (!shouldEagerDecryptMeta(meta)) {
          return false;
        }
        const remoteUrl = buildLesRemoteUrl(meta.profileId, meta.lesObjectId);
        const cached = previewByRemoteUrlRef.current.get(remoteUrl);
        return !(cached && !isLesPreviewPendingUrl(cached));
      });

      await mapPool(eager, PREVIEW_CONCURRENCY, async (meta: LesObjectMeta) => {
        if (generation !== generationRef.current) {
          return;
        }
        await decryptMetaToPreview(meta, generation);
      });
    } catch (err) {
      if (generation !== generationRef.current) {
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
      setMediaItems([]);
      setIsLoading(false);
    }
  }, [decryptMetaToPreview]);

  const ensurePreview = useCallback(async (remoteUrl: string): Promise<boolean> => {
    const trimmed = remoteUrl.trim();
    if (!trimmed) {
      return false;
    }
    const cached = previewByRemoteUrlRef.current.get(trimmed);
    if (cached && !isLesPreviewPendingUrl(cached)) {
      return true;
    }
    const inflight = inflightPreviewRef.current.get(trimmed);
    if (inflight) {
      return inflight;
    }
    const meta = metaByRemoteUrlRef.current.get(trimmed);
    if (!meta) {
      return false;
    }
    const generation = generationRef.current;
    const task = decryptMetaToPreview(meta, generation).finally(() => {
      inflightPreviewRef.current.delete(trimmed);
    });
    inflightPreviewRef.current.set(trimmed, task);
    return task;
  }, [decryptMetaToPreview]);

  useEffect(() => {
    void refresh();
    return () => {
      generationRef.current += 1;
      previewByRemoteUrlRef.current.forEach((_, remoteUrl) => {
        revokeVaultMediaBlobUrl(remoteUrl);
      });
      previewByRemoteUrlRef.current.clear();
      metaByRemoteUrlRef.current.clear();
      inflightPreviewRef.current.clear();
      revokeAllVaultMediaBlobUrls();
    };
  }, [refresh, profileId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const onChanged = (): void => {
      void refresh();
    };
    window.addEventListener("obscur:les-catalog-changed", onChanged);
    return () => window.removeEventListener("obscur:les-catalog-changed", onChanged);
  }, [refresh]);

  const downloadToLocalPath = useCallback(async (item: VaultMediaItem): Promise<boolean> => {
    try {
      const exported = await exportLesVaultItemToUserPath(item);
      if (exported === "cancelled") {
        return false;
      }
      if (exported !== "saved") {
        toast.error(t("vault.downloadToFolderFailed"));
        return false;
      }
      toast.success(t("vault.exportDecryptedCopySuccess"));
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
      return false;
    }
  }, [t]);

  const deleteLocalCopy = useCallback(async (remoteUrl: string): Promise<void> => {
    const parsed = parseLesRemoteUrl(remoteUrl);
    if (!parsed) {
      toast.error(t("vault.removeFromVaultFailed", "Could not remove this item from the vault."));
      return;
    }
    try {
      const receipt = await deleteLesObject(parsed.lesObjectId, parsed.profileId);
      if (!receipt.deleted) {
        toast.error(t("vault.removeFromVaultFailed", "Could not remove this item from the vault."));
        return;
      }
      const cached = previewByRemoteUrlRef.current.get(remoteUrl);
      if (cached) {
        revokeVaultMediaBlobUrl(remoteUrl);
        previewByRemoteUrlRef.current.delete(remoteUrl);
      }
      toast.success(t("vault.removeFromVaultSuccess", "Removed from your encrypted local vault."));
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }, [refresh, t]);

  const openLocalFileLocation = useCallback(async (remoteUrl: string): Promise<boolean> => {
    const item = itemsRef.current.find((entry) => entry.remoteUrl === remoteUrl);
    if (!item) {
      return false;
    }
    return revealLesVaultItemFolder(item);
  }, []);

  const stats = useMemo(() => {
    const imageCount = mediaItems.filter((item) => item.attachment.kind === "image").length;
    const videoCount = mediaItems.filter((item) => item.attachment.kind === "video").length;
    const audioCount = mediaItems.filter((item) =>
      item.attachment.kind === "audio" || item.attachment.kind === "voice_note"
    ).length;
    const fileCount = mediaItems.filter((item) => item.attachment.kind === "file").length;
    return { imageCount, videoCount, audioCount, fileCount, total: mediaItems.length };
  }, [mediaItems]);

  return {
    mediaItems,
    isLoading,
    error,
    refresh,
    ensurePreview,
    downloadToLocalPath,
    deleteLocalCopy,
    openLocalFileLocation,
    stats,
    available,
  };
}
