"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMessaging } from "../../messaging/providers/messaging-provider";
import {
    compressImage,
    compressVideo,
    generateVideoThumbnail
} from "../../messaging/lib/media-processor";
import {
    BEST_EFFORT_STORAGE_NOTE,
    shouldCompressByPolicy,
    validateMediaFileForBestEffortUpload
} from "../../messaging/lib/media-upload-policy";

const PROCESSING_PROGRESS_FALLBACK_CAP = 95;

const clampProgress = (value: number): number => {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, Math.min(100, Math.round(value)));
};

const computeFallbackTickStep = (currentProgress: number): number => {
    if (currentProgress < 40) {
        return 3;
    }
    if (currentProgress < 75) {
        return 2;
    }
    return 1;
};

const createPerFileProgress = (params: Readonly<{
    fileIndex: number;
    fileCount: number;
    fileLocalProgressPercent: number;
}>): number => {
    const safeFileCount = Math.max(params.fileCount, 1);
    const boundedLocalProgress = Math.max(0, Math.min(100, params.fileLocalProgressPercent));
    return ((params.fileIndex + (boundedLocalProgress / 100)) / safeFileCount) * 100;
};

/**
 * Hook to manage attachment file selection, validation, and preview URLs.
 */
export function useAttachmentHandler() {
    const {
        setPendingAttachments,
        setPendingAttachmentPreviewUrls,
        pendingAttachmentPreviewUrls,
        setAttachmentError,
        setIsProcessingMedia,
        setMediaProcessingProgress
    } = useMessaging();
    const processingProgressRef = useRef<number>(0);
    const processingProgressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pendingAttachmentPreviewUrlsRef = useRef(pendingAttachmentPreviewUrls);

    useEffect(() => {
        pendingAttachmentPreviewUrlsRef.current = pendingAttachmentPreviewUrls;
    }, [pendingAttachmentPreviewUrls]);

    const stopProcessingProgressFallbackTicker = useCallback((): void => {
        if (processingProgressIntervalRef.current) {
            clearInterval(processingProgressIntervalRef.current);
            processingProgressIntervalRef.current = null;
        }
    }, []);

    const publishProcessingProgress = useCallback((nextProgress: number): void => {
        const boundedProgress = clampProgress(nextProgress);
        if (boundedProgress <= processingProgressRef.current) {
            return;
        }
        processingProgressRef.current = boundedProgress;
        setMediaProcessingProgress(boundedProgress);
    }, [setMediaProcessingProgress]);

    const startProcessingProgressFallbackTicker = useCallback((): void => {
        stopProcessingProgressFallbackTicker();
        processingProgressIntervalRef.current = setInterval(() => {
            const currentProgress = processingProgressRef.current;
            if (currentProgress >= PROCESSING_PROGRESS_FALLBACK_CAP) {
                return;
            }
            publishProcessingProgress(
                Math.min(
                    PROCESSING_PROGRESS_FALLBACK_CAP,
                    currentProgress + computeFallbackTickStep(currentProgress)
                )
            );
        }, 180);
    }, [publishProcessingProgress, stopProcessingProgressFallbackTicker]);

    // Cleanup preview URLs on unmount
    useEffect(() => {
        return () => {
            stopProcessingProgressFallbackTicker();
            pendingAttachmentPreviewUrlsRef.current.forEach(url => {
                if (url.startsWith('blob:') || url.startsWith('data:')) {
                    URL.revokeObjectURL(url);
                }
            });
        };
    }, [stopProcessingProgressFallbackTicker]);

    const clearPendingAttachments = useCallback(() => {
        pendingAttachmentPreviewUrls.forEach(url => {
            if (url.startsWith('blob:') || url.startsWith('data:')) {
                URL.revokeObjectURL(url);
            }
        });
        setPendingAttachments([]);
        setPendingAttachmentPreviewUrls([]);
        setAttachmentError(null);
    }, [pendingAttachmentPreviewUrls, setPendingAttachments, setPendingAttachmentPreviewUrls, setAttachmentError]);

    const removePendingAttachment = useCallback((index: number) => {
        setPendingAttachmentPreviewUrls((prev: ReadonlyArray<string>) => {
            const url = prev[index];
            if (url && (url.startsWith('blob:') || url.startsWith('data:'))) {
                URL.revokeObjectURL(url);
            }
            return prev.filter((_, i) => i !== index);
        });
        setPendingAttachments((prev: ReadonlyArray<File>) => prev.filter((_, i) => i !== index));
    }, [setPendingAttachments, setPendingAttachmentPreviewUrls]);

    const handleFilesSelected = useCallback(async (files: FileList | File[]) => {
        const fileList = Array.from(files);

        const processedFiles: File[] = [];
        const newPreviewUrls: string[] = [];
        const skippedReasons: string[] = [];

        setIsProcessingMedia(true);
        processingProgressRef.current = 0;
        publishProcessingProgress(6);
        startProcessingProgressFallbackTicker();

        try {
            for (let i = 0; i < fileList.length; i++) {
                let file = fileList[i];
                const fileCount = Math.max(fileList.length, 1);
                publishProcessingProgress((i / fileCount) * 100);

                const validationError = validateMediaFileForBestEffortUpload(file);
                if (validationError) {
                    skippedReasons.push(validationError);
                    publishProcessingProgress(((i + 1) / fileCount) * 100);
                    continue;
                }

                let previewUrl = URL.createObjectURL(file);

                if (shouldCompressByPolicy(file)) {
                    if (file.type.startsWith("image/")) {
                        const originalUrl = previewUrl;
                        file = await compressImage(file);
                        previewUrl = URL.createObjectURL(file);
                        URL.revokeObjectURL(originalUrl);
                    } else if (file.type.startsWith("video/")) {
                        // Generate thumbnail first (using original file is usually fine and faster)
                        const thumbDataUrl = await generateVideoThumbnail(file);

                        const originalUrl = previewUrl;
                        file = await compressVideo(file, (progress: number) => {
                            // Local progress for this specific file.
                            const totalProgress = createPerFileProgress({
                                fileIndex: i,
                                fileCount,
                                fileLocalProgressPercent: progress,
                            });
                            publishProcessingProgress(totalProgress);
                        });

                        if (thumbDataUrl) {
                            previewUrl = thumbDataUrl; // Use thumbnail for preview
                            URL.revokeObjectURL(originalUrl);
                        } else {
                            previewUrl = URL.createObjectURL(file);
                            URL.revokeObjectURL(originalUrl);
                        }
                    }
                }

                const postProcessValidationError = validateMediaFileForBestEffortUpload(file);
                if (postProcessValidationError) {
                    skippedReasons.push(postProcessValidationError);
                    if (previewUrl.startsWith("blob:") || previewUrl.startsWith("data:")) {
                        URL.revokeObjectURL(previewUrl);
                    }
                    publishProcessingProgress(((i + 1) / fileCount) * 100);
                    continue;
                }

                processedFiles.push(file);
                newPreviewUrls.push(previewUrl);
                publishProcessingProgress(((i + 1) / fileCount) * 100);
            }

            if (processedFiles.length > 0) {
                setPendingAttachments((prev: ReadonlyArray<File>) => [...prev, ...processedFiles]);
                setPendingAttachmentPreviewUrls((prev: ReadonlyArray<string>) => [...prev, ...newPreviewUrls]);
                if (skippedReasons.length > 0) {
                    setAttachmentError(skippedReasons[0]);
                } else {
                    setAttachmentError(null);
                }
            } else if (skippedReasons.length > 0) {
                setAttachmentError(skippedReasons[0]);
            }
        } catch (error) {
            console.error("Media processing failed:", error);
            setAttachmentError(`Failed to process some files. ${BEST_EFFORT_STORAGE_NOTE}`);
        } finally {
            publishProcessingProgress(100);
            stopProcessingProgressFallbackTicker();
            await new Promise((resolve) => setTimeout(resolve, 140));
            setIsProcessingMedia(false);
            processingProgressRef.current = 0;
            setMediaProcessingProgress(0);
        }
    }, [
        publishProcessingProgress,
        setPendingAttachments,
        setPendingAttachmentPreviewUrls,
        setAttachmentError,
        setIsProcessingMedia,
        setMediaProcessingProgress,
        startProcessingProgressFallbackTicker,
        stopProcessingProgressFallbackTicker,
    ]);

    const pickAttachments = useCallback(() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = "image/*,video/*,audio/*,.pdf,.txt,.csv,.rtf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp";
        input.onchange = (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files) {
                handleFilesSelected(files);
            }
        };
        input.click();
    }, [handleFilesSelected]);

    return {
        pickAttachments,
        handleFilesSelected,
        removePendingAttachment,
        clearPendingAttachments
    };
}

export const useAttachmentHandlerInternals = {
    clampProgress,
    computeFallbackTickStep,
    createPerFileProgress,
};
