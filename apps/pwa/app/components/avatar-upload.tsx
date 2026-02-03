"use client";

import React, { useRef, useState } from "react";
import { Upload, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "./ui/toast";
import { useUploadService } from "@/app/features/messaging/lib/upload-service";
import { cn } from "@/app/lib/utils";

interface AvatarUploadProps {
    currentAvatarUrl?: string;
    onUploadSuccess: (url: string) => void;
    className?: string;
}

export function AvatarUpload({ currentAvatarUrl, onUploadSuccess, className }: AvatarUploadProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const uploadService = useUploadService();

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validation
        if (!file.type.startsWith("image/")) {
            toast.error("Please select an image file.");
            return;
        }

        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            toast.error("Image size must be less than 10MB.");
            return;
        }

        // Local preview
        const localUrl = URL.createObjectURL(file);
        setPreviewUrl(localUrl);
        setStatus('uploading');
        setIsUploading(true);

        try {
            const attachment = await uploadService.uploadFile(file);
            onUploadSuccess(attachment.url);
            setStatus('success');
            toast.success("Avatar uploaded successfully!");
        } catch (error) {
            console.error("Upload failed:", error);
            setStatus('error');
            const message = error instanceof Error ? error.message : "Failed to upload avatar. Please try again.";
            toast.error(message);
        } finally {
            setIsUploading(false);
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const clearPreview = () => {
        setPreviewUrl(null);
        setStatus('idle');
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const displayUrl = previewUrl || currentAvatarUrl;

    return (
        <div className={cn("flex flex-col items-center gap-4", className)}>
            <div className="relative group">
                <div
                    className={cn(
                        "h-24 w-24 rounded-full overflow-hidden border-2 transition-all flex items-center justify-center bg-zinc-100 dark:bg-zinc-800",
                        status === 'uploading' ? "border-purple-500 animate-pulse" :
                            status === 'success' ? "border-emerald-500" :
                                status === 'error' ? "border-red-500" : "border-zinc-200 dark:border-zinc-700"
                    )}
                >
                    {displayUrl ? (
                        <img
                            src={displayUrl}
                            alt="Avatar Preview"
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <Upload className="h-8 w-8 text-zinc-400" />
                    )}

                    {isUploading && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <Loader2 className="h-8 w-8 text-white animate-spin" />
                        </div>
                    )}
                </div>

                {status === 'success' && (
                    <div className="absolute -bottom-1 -right-1 bg-white dark:bg-zinc-900 rounded-full p-0.5">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 fill-emerald-500/10" />
                    </div>
                )}

                {status === 'error' && (
                    <div className="absolute -bottom-1 -right-1 bg-white dark:bg-zinc-900 rounded-full p-0.5">
                        <AlertCircle className="h-5 w-5 text-red-500 fill-red-500/10" />
                    </div>
                )}
            </div>

            <div className="flex gap-2">
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={triggerFileInput}
                    disabled={isUploading}
                >
                    {displayUrl ? "Change Image" : "Upload Image"}
                </Button>
                {previewUrl && !isUploading && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clearPreview}
                        className="text-zinc-500"
                    >
                        <X className="h-4 w-4 mr-1" /> Clear
                    </Button>
                )}
            </div>

            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
            />
        </div>
    );
}
