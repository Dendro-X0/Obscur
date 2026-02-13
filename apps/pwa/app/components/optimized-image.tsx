"use client";

import React, { useState } from "react";
import Image from "next/image";
import { cn } from "../lib/cn";
import { ImageOff, Loader2 } from "lucide-react";

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

    return (
        <div className={cn("relative overflow-hidden bg-zinc-100 dark:bg-zinc-800", containerClassName)}>
            {!isLoaded && !isError && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                </div>
            )}

            {isError ? (
                <div className="flex flex-col items-center justify-center p-8 text-zinc-400 gap-2">
                    <ImageOff className="h-8 w-8" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Load Failed</span>
                </div>
            ) : (
                <Image
                    src={src}
                    alt={alt}
                    fill
                    priority={priority}
                    unoptimized={unoptimized}
                    onLoad={() => setIsLoaded(true)}
                    onError={() => setIsError(true)}
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
