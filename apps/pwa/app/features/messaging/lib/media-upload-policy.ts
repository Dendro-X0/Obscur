"use client";

import type { AttachmentKind } from "../types";

export const MEDIA_UPLOAD_LIMITS = {
    imageBytes: 8 * 1024 * 1024,
    audioBytes: 20 * 1024 * 1024,
    videoBytes: 35 * 1024 * 1024,
} as const;

export const MEDIA_COMPRESSION_TARGETS = {
    imageCompressAboveBytes: 1 * 1024 * 1024,
    videoCompressAboveBytes: 10 * 1024 * 1024,
} as const;

export const BEST_EFFORT_STORAGE_NOTE =
    "Uploads use public NIP-96 providers (best effort). For important files, use a smaller file or paste an external link.";

const formatMb = (bytes: number): string => `${Math.round((bytes / (1024 * 1024)) * 10) / 10}MB`;

export const getMediaKindForPolicy = (file: File): AttachmentKind => {
    const mime = (file.type || "").toLowerCase();
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/")) return "audio";
    return "image";
};

export const getMediaLimitBytes = (kind: AttachmentKind): number => {
    if (kind === "video") return MEDIA_UPLOAD_LIMITS.videoBytes;
    if (kind === "audio") return MEDIA_UPLOAD_LIMITS.audioBytes;
    return MEDIA_UPLOAD_LIMITS.imageBytes;
};

export const validateMediaFileForBestEffortUpload = (file: File): string | null => {
    const kind = getMediaKindForPolicy(file);
    const limit = getMediaLimitBytes(kind);
    if (file.size <= limit) {
        return null;
    }
    return `${file.name} exceeds ${formatMb(limit)} (${kind}). ${BEST_EFFORT_STORAGE_NOTE}`;
};

export const shouldCompressByPolicy = (file: File): boolean => {
    const kind = getMediaKindForPolicy(file);
    if (kind === "image") return file.size > MEDIA_COMPRESSION_TARGETS.imageCompressAboveBytes;
    if (kind === "video") return file.size > MEDIA_COMPRESSION_TARGETS.videoCompressAboveBytes;
    return false;
};
