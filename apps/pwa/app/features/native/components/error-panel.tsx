"use client";

import { useEffect, useState } from "react";
import { nativeErrorStore, type NativeError } from "../lib/native-error-store";
import { X, SearchX, RefreshCcw } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function useNativeErrors() {
    const [errors, setErrors] = useState<NativeError[]>([]);

    useEffect(() => {
        const unsubscribe = nativeErrorStore.subscribe((newErrors) => {
            setErrors([...newErrors]);
        });
        return () => { unsubscribe(); };
    }, []);

    const removeError = (id: string) => {
        nativeErrorStore.removeError(id);
    };

    return { errors, removeError };
}

export function ErrorPanel() {
    const { errors, removeError } = useNativeErrors();

    if (errors.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none">
            {errors.map((error) => (
                <div
                    key={error.id}
                    className="bg-destructive text-destructive-foreground p-4 rounded-lg shadow-lg flex flex-col gap-2 animate-in slide-in-from-right-5 fade-in pointer-events-auto border border-destructive/50"
                >
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 font-semibold">
                            <SearchX className="w-4 h-4" />
                            <span>Error: {error.code}</span>
                        </div>
                        <button
                            onClick={() => removeError(error.id)}
                            className="hover:bg-destructive-foreground/20 p-1 rounded transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <p className="text-sm opacity-90">{error.message}</p>

                    {error.retryable && error.retry && (
                        <button
                            onClick={async () => {
                                try {
                                    await error.retry!();
                                    removeError(error.id);
                                } catch (e) {
                                    console.error("Retry failed", e);
                                }
                            }}
                            className="text-xs flex items-center gap-1 mt-1 bg-background/20 hover:bg-background/30 w-fit px-2 py-1 rounded transition-colors font-medium"
                        >
                            <RefreshCcw className="w-3 h-3" />
                            Retry
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
}
