"use client";

import { useEffect, useMemo, useState } from "react";
import { nativeErrorStore, type NativeError } from "../lib/native-error-store";
import { X, WifiOff, RefreshCcw, ChevronDown } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { isMobileShellProduct } from "@/app/features/runtime/shell-contract";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const isRelaySoftWarning = (code: string): boolean => code.startsWith("RELAY_");

const titleForError = (error: NativeError): string => {
    if (error.code === "RELAY_CONNECT_FAILED" || error.code === "RELAY_INIT_FAILED") {
        return "Relay connection issue";
    }
    if (error.code === "RELAY_SEND_FAILED") {
        return "Couldn't send via relay";
    }
    if (isRelaySoftWarning(error.code)) {
        return "Relay issue";
    }
    return error.code.replaceAll("_", " ");
};

export function useNativeErrors() {
    const [errors, setErrors] = useState<NativeError[]>(() => [...nativeErrorStore.getErrors()]);

    useEffect(() => {
        setErrors([...nativeErrorStore.getErrors()]);
        const unsubscribe = nativeErrorStore.subscribe((newErrors) => {
            setErrors([...newErrors]);
        });
        return () => { unsubscribe(); };
    }, []);

    const removeError = (id: string) => {
        nativeErrorStore.removeError(id);
    };

    /** X dismiss — soft relay warnings snooze so unstable remotes do not re-nag. */
    const dismissError = (id: string) => {
        nativeErrorStore.dismissError(id);
    };

    return { errors, removeError, dismissError };
}

export function ErrorPanel() {
    const { errors, removeError, dismissError } = useNativeErrors();
    const hideRelayOnMobile = isMobileShellProduct();
    const visibleErrors = useMemo(
        () => (hideRelayOnMobile ? errors.filter((error) => !isRelaySoftWarning(error.code)) : errors),
        [errors, hideRelayOnMobile],
    );

    if (visibleErrors.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none">
            {visibleErrors.map((error) => {
                const soft = isRelaySoftWarning(error.code);
                return (
                    <div
                        key={error.id}
                        className={cn(
                            "p-4 rounded-lg shadow-lg flex flex-col gap-2 animate-in slide-in-from-right-5 fade-in pointer-events-auto border",
                            soft
                                ? "bg-amber-50 text-amber-950 border-amber-500/35 dark:bg-amber-950/90 dark:text-amber-50 dark:border-amber-400/30"
                                : "bg-destructive text-destructive-foreground border-destructive/50",
                        )}
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 font-semibold text-sm">
                                {soft ? <WifiOff className="w-4 h-4 shrink-0" /> : null}
                                <span>{titleForError(error)}</span>
                                {error.occurrenceCount > 1 && (
                                    <span
                                        className={cn(
                                            "rounded px-1.5 py-0.5 text-[10px] font-bold",
                                            soft
                                                ? "bg-amber-900/10 dark:bg-amber-50/15"
                                                : "bg-destructive-foreground/20",
                                        )}
                                    >
                                        x{error.occurrenceCount}
                                    </span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => dismissError(error.id)}
                                className={cn(
                                    "p-1 rounded transition-colors",
                                    soft
                                        ? "hover:bg-amber-900/10 dark:hover:bg-amber-50/10"
                                        : "hover:bg-destructive-foreground/20",
                                )}
                                aria-label="Dismiss"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <p className="text-sm opacity-90 leading-snug">{error.message}</p>

                        {error.detail ? (
                            <details className="text-[11px] opacity-70">
                                <summary className="cursor-pointer list-none flex items-center gap-1 select-none">
                                    <ChevronDown className="w-3 h-3" />
                                    Technical details
                                </summary>
                                <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-words rounded bg-black/5 dark:bg-black/30 p-2 font-mono">
                                    {error.detail}
                                </pre>
                            </details>
                        ) : null}

                        {error.retryable && error.retry && (
                            <button
                                type="button"
                                onClick={async () => {
                                    try {
                                        await error.retry!();
                                        removeError(error.id);
                                    } catch (e) {
                                        console.error("Retry failed", e);
                                    }
                                }}
                                className={cn(
                                    "text-xs flex items-center gap-1 mt-1 w-fit px-2 py-1 rounded transition-colors font-medium",
                                    soft
                                        ? "bg-amber-900/10 hover:bg-amber-900/15 dark:bg-amber-50/10 dark:hover:bg-amber-50/15"
                                        : "bg-background/20 hover:bg-background/30",
                                )}
                            >
                                <RefreshCcw className="w-3 h-3" />
                                Retry
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
