"use client";

import React, { useState } from "react";
import Image from "next/image";
import { cn } from "@dweb/ui-kit";
import { ExternalLink, ImageOff, Loader2, RefreshCw } from "lucide-react";
import { classifyMediaError } from "@/app/features/messaging/components/media-error-state";
import { logRuntimeEvent } from "@/app/shared/runtime-log-classification";

interface OptimizedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt' | 'onLoad' | 'onError' | 'width' | 'height'> {
    src: string;
    alt: string;
    className?: string;
    containerClassName?: string;
    priority?: boolean;
    unoptimized?: boolean;
}

export function OptimizedImage({
    src,
    alt,
    className,
    containerClassName,
    priority,
    unoptimized = true,
    ...props
}: OptimizedImageProps) {
    const [isLoaded, setIsLoaded] = useState(false);
    const [isError, setIsError] = useState(false);
    const [retryKey, setRetryKey] = useState(0);

    const openExternally = (): void => {
        if (typeof window === "undefined") return;
        window.open(src, "_blank", "noopener,noreferrer");
    };

    return (
        <div className={cn("relative overflow-hidden bg-zinc-100 dark:bg-zinc-800", containerClassName)}>
            {!isLoaded && !isError && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                </div>
            )}

            {isError ? (
                <div className="flex flex-col items-center justify-center p-4 text-zinc-400 gap-2">
                    <ImageOff className="h-8 w-8" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Load Failed</span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-md border border-black/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-600 hover:bg-black/5 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/10"
                            onClick={() => {
                                setIsError(false);
                                setIsLoaded(false);
                                setRetryKey((prev) => prev + 1);
                            }}
                        >
                            <RefreshCw className="h-3 w-3" />
                            Retry
                        </button>
                        <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-md border border-black/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-600 hover:bg-black/5 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/10"
                            onClick={openExternally}
                        >
                            <ExternalLink className="h-3 w-3" />
                            Open
                        </button>
                    </div>
                </div>
            ) : (
                <Image
                    key={`${src}:${retryKey}`}
                    src={src}
                    alt={alt}
                    fill
                    priority={priority}
                    unoptimized={unoptimized}
                    onLoad={() => setIsLoaded(true)}
                    onError={(event) => {
                        setIsError(true);
                        const classification = classifyMediaError(new Error("image_load_failed"));
                        logRuntimeEvent(
                            `image_player.media_error.${classification.reasonCode}`,
                            classification.recoverable ? "degraded" : "actionable",
                            ["[ImagePlayer] image load failed", { src, eventType: event.type }]
                        );
                    }}
                    className={cn(
                        "transition-all duration-700 ease-in-out object-cover",
                        isLoaded ? "opacity-100 scale-100 blur-0" : "opacity-0 scale-105 blur-lg",
                        className
                    )}
                    {...props}
                />
            )}
        </div>
    );
}
