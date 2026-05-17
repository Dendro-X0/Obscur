"use client";

import type { AttachmentKind } from "../types";
import { parseVoiceNoteFileName } from "@/app/features/messaging/services/voice-note-metadata";

export const MEDIA_UPLOAD_LIMITS = {
    imageBytes: 50 * 1024 * 1024,
    audioBytes: 50 * 1024 * 1024,
    videoBytes: 250 * 1024 * 1024,
    fileBytes: 100 * 1024 * 1024,
} as const;

export const MEDIA_COMPRESSION_TARGETS = {
    imageCompressAboveBytes: 1 * 1024 * 1024,
    videoCompressAboveBytes: 10 * 1024 * 1024,
} as const;

export const MEDIA_RUNTIME_SAFETY_LIMITS = {
    imagePreprocessBytes: 24 * 1024 * 1024,
    videoPreprocessBytes: 64 * 1024 * 1024,
    nativeDirectUploadBytes: 160 * 1024 * 1024,
    inMemorySentCacheBytes: 16 * 1024 * 1024,
    pendingAttachmentBatchBytes: 384 * 1024 * 1024,
    maxVideoAttachmentsPerMessage: 1,
} as const;

export const BEST_EFFORT_STORAGE_NOTE =
    "Uploads use public NIP-96 providers (best effort). For important files, use a smaller file or paste an external link.";

const formatMb = (bytes: number): string => `${Math.round((bytes / (1024 * 1024)) * 10) / 10}MB`;

export const getMediaKindForPolicy = (file: File): AttachmentKind => {
    if (parseVoiceNoteFileName(file.name).isVoiceNote) return "voice_note";
    const mime = (file.type || "").toLowerCase();
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/")) return "audio";
    if (mime.startsWith("image/")) return "image";
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    if (["mp4", "mov", "avi", "webm", "ogv", "m4v", "3gp", "mkv"].includes(extension)) return "video";
    if (["mp3", "wav", "m4a", "ogg", "aac", "flac", "opus"].includes(extension)) return "audio";
    if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension)) return "image";
    return "file";
};

export const getMediaLimitBytes = (kind: AttachmentKind): number => {
    if (kind === "video") return MEDIA_UPLOAD_LIMITS.videoBytes;
    if (kind === "voice_note") return MEDIA_UPLOAD_LIMITS.audioBytes;
    if (kind === "audio") return MEDIA_UPLOAD_LIMITS.audioBytes;
    if (kind === "file") return MEDIA_UPLOAD_LIMITS.fileBytes;
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

export const shouldSkipPreprocessForRuntimeSafety = (file: File): boolean => {
    const kind = getMediaKindForPolicy(file);
    if (kind === "image") {
        return file.size > MEDIA_RUNTIME_SAFETY_LIMITS.imagePreprocessBytes;
    }
    if (kind === "video") {
        return file.size > MEDIA_RUNTIME_SAFETY_LIMITS.videoPreprocessBytes;
    }
    return false;
};

export const shouldPreferBrowserUploadForRuntimeSafety = (file: File, isNativeRuntime: boolean): boolean => {
    if (!isNativeRuntime) {
        return false;
    }
    const kind = getMediaKindForPolicy(file);
    return (
        (kind === "video" || kind === "audio" || kind === "file")
        && file.size > MEDIA_RUNTIME_SAFETY_LIMITS.nativeDirectUploadBytes
    );
};

export const shouldAvoidInMemoryAttachmentCaching = (file: File): boolean => (
    file.size > MEDIA_RUNTIME_SAFETY_LIMITS.inMemorySentCacheBytes
);

export const validateAttachmentBatchForRuntimeSafety = (
    files: ReadonlyArray<File>,
    currentPendingFiles: ReadonlyArray<File> = [],
): string | null => {
    const combinedFiles = [...currentPendingFiles, ...files];
    const videoCount = combinedFiles.filter((file) => getMediaKindForPolicy(file) === "video").length;
    if (videoCount > MEDIA_RUNTIME_SAFETY_LIMITS.maxVideoAttachmentsPerMessage) {
        return `Only ${MEDIA_RUNTIME_SAFETY_LIMITS.maxVideoAttachmentsPerMessage} video can be attached per message right now. Send additional videos in separate messages for a more reliable upload. ${BEST_EFFORT_STORAGE_NOTE}`;
    }
    const totalBytes = combinedFiles.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes <= MEDIA_RUNTIME_SAFETY_LIMITS.pendingAttachmentBatchBytes) {
        return null;
    }
    return `Selected attachments exceed ${formatMb(MEDIA_RUNTIME_SAFETY_LIMITS.pendingAttachmentBatchBytes)} total. For stability, send fewer or smaller files at once. ${BEST_EFFORT_STORAGE_NOTE}`;
};
