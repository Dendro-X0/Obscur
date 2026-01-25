import { Attachment, AttachmentKind, UploadApiResponse } from "../../features/messaging/types";

export interface UploadService {
    uploadFile: (file: File) => Promise<Attachment>;
}

/**
 * Implementation of UploadService using the local /api/upload endpoint
 */
export class LocalUploadService implements UploadService {
    async uploadFile(file: File): Promise<Attachment> {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/upload", {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Upload failed with status ${response.status}`);
        }

        const result: UploadApiResponse = await response.json();

        if (!result.ok) {
            throw new Error(result.error || "Upload failed");
        }

        const kind: AttachmentKind = result.contentType.startsWith("video/") ? "video" : "image";

        return {
            kind,
            url: result.url,
            contentType: result.contentType,
            fileName: file.name,
        };
    }
}

/**
 * Hook to use the upload service
 */
import { useMemo } from "react";

export const useUploadService = (): UploadService => {
    return useMemo(() => new LocalUploadService(), []);
};
