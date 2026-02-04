"use client";

import React, { useState } from "react";
import { cn } from "../lib/cn";
import { ImageOff, Loader2 } from "lucide-react";

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src: string;
    alt: string;
    className?: string;
    containerClassName?: string;
}

export function OptimizedImage({ src, alt, className, containerClassName, ...props }: OptimizedImageProps) {
    const [isLoaded, setIsLoaded] = useState(false);
    const [isError, setIsError] = useState(false);

    return (
        <div className={cn("relative overflow-hidden bg-zinc-100 dark:bg-zinc-800", containerClassName)}>
            {!isLoaded && !isError && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                </div>
            )}

            {isError ? (
                <div className="flex flex-col items-center justify-center p-8 text-zinc-400 gap-2">
                    <ImageOff className="h-8 w-8" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Load Failed</span>
                </div>
            ) : (
                <img
                    src={src}
                    alt={alt}
                    loading="lazy"
                    onLoad={() => setIsLoaded(true)}
                    onError={() => setIsError(true)}
                    className={cn(
                        "transition-all duration-700 ease-in-out",
                        isLoaded ? "opacity-100 scale-100 blur-0" : "opacity-0 scale-105 blur-lg",
                        className
                    )}
                    {...props}
                />
            )}
        </div>
    );
}
