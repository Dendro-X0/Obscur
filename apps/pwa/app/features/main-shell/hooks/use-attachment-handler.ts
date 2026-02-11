"use client";

import { useCallback, useEffect } from "react";
import { useMessaging } from "../../messaging/providers/messaging-provider";

/**
 * Hook to manage attachment file selection, validation, and preview URLs.
 */
export function useAttachmentHandler() {
    const {
        setPendingAttachments,
        setPendingAttachmentPreviewUrls,
        pendingAttachmentPreviewUrls,
        setAttachmentError
    } = useMessaging();

    // Cleanup preview URLs on unmount
    useEffect(() => {
        return () => {
            pendingAttachmentPreviewUrls.forEach(url => {
                if (url.startsWith('blob:')) {
                    URL.revokeObjectURL(url);
                }
            });
        };
    }, []);

    const clearPendingAttachments = useCallback(() => {
        pendingAttachmentPreviewUrls.forEach(url => {
            if (url.startsWith('blob:')) {
                URL.revokeObjectURL(url);
            }
        });
        setPendingAttachments([]);
        setPendingAttachmentPreviewUrls([]);
        setAttachmentError(null);
    }, [pendingAttachmentPreviewUrls, setPendingAttachments, setPendingAttachmentPreviewUrls, setAttachmentError]);

    const removePendingAttachment = useCallback((index: number) => {
        setPendingAttachmentPreviewUrls(prev => {
            const url = prev[index];
            if (url && url.startsWith('blob:')) {
                URL.revokeObjectURL(url);
            }
            return prev.filter((_, i) => i !== index);
        });
        setPendingAttachments(prev => prev.filter((_, i) => i !== index));
    }, [setPendingAttachments, setPendingAttachmentPreviewUrls]);

    const handleFilesSelected = useCallback((files: FileList | File[]) => {
        const fileList = Array.from(files);
        const MAX_SIZE = 100 * 1024 * 1024; // 100MB

        const validFiles: File[] = [];
        const newPreviewUrls: string[] = [];

        for (const file of fileList) {
            if (file.size > MAX_SIZE) {
                setAttachmentError(`File ${file.name} is too large (max 100MB)`);
                continue;
            }
            validFiles.push(file);
            newPreviewUrls.push(URL.createObjectURL(file));
        }

        if (validFiles.length > 0) {
            setPendingAttachments(prev => [...prev, ...validFiles]);
            setPendingAttachmentPreviewUrls(prev => [...prev, ...newPreviewUrls]);
            setAttachmentError(null);
        }
    }, [setPendingAttachments, setPendingAttachmentPreviewUrls, setAttachmentError]);

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
