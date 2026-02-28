"use client";

import { useCallback, useEffect } from "react";
import { useMessaging } from "../../messaging/providers/messaging-provider";
import {
    shouldCompress,
    compressImage,
    compressVideo,
    generateVideoThumbnail
} from "../../messaging/lib/media-processor";

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

    // Cleanup preview URLs on unmount
    useEffect(() => {
        return () => {
            pendingAttachmentPreviewUrls.forEach(url => {
                if (url.startsWith('blob:') || url.startsWith('data:')) {
                    URL.revokeObjectURL(url);
                }
            });
        };
    }, []);

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
        const MAX_SIZE = 500 * 1024 * 1024; // 500MB pre-compression limit

        const processedFiles: File[] = [];
        const newPreviewUrls: string[] = [];

        setIsProcessingMedia(true);
        setMediaProcessingProgress(0);

        try {
            for (let i = 0; i < fileList.length; i++) {
                let file = fileList[i];

                if (file.size > MAX_SIZE) {
                    setAttachmentError(`File ${file.name} is too large (max 500MB)`);
                    continue;
                }

                let previewUrl = URL.createObjectURL(file);

                if (shouldCompress(file)) {
                    setMediaProcessingProgress(Math.round((i / fileList.length) * 100));

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
                            // Local progress for this specific file
                            const totalProgress = Math.round(((i + (progress / 100)) / fileList.length) * 100);
                            setMediaProcessingProgress(totalProgress);
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

                processedFiles.push(file);
                newPreviewUrls.push(previewUrl);
            }

            if (processedFiles.length > 0) {
                setPendingAttachments((prev: ReadonlyArray<File>) => [...prev, ...processedFiles]);
                setPendingAttachmentPreviewUrls((prev: ReadonlyArray<string>) => [...prev, ...newPreviewUrls]);
                setAttachmentError(null);
            }
        } catch (error) {
            console.error("Media processing failed:", error);
            setAttachmentError("Failed to process some files.");
        } finally {
            setIsProcessingMedia(false);
            setMediaProcessingProgress(0);
        }
    }, [setPendingAttachments, setPendingAttachmentPreviewUrls, setAttachmentError, setIsProcessingMedia, setMediaProcessingProgress]);

    const pickAttachments = useCallback(() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = 'image/*,video/*,audio/*';
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
