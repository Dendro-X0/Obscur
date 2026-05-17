"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, XCircle, Info, ShieldAlert } from "lucide-react";
import { cn } from "@/app/lib/utils";

/**
 * Type of flash message
 */
export type FlashMessageType = "error" | "warning" | "info" | "success";

interface FlashMessageProps {
    /** The message to display */
    message: string | null;
    /** The type of message (default: error) */
    type?: FlashMessageType;
    /** Optional callback when the user closes the message */
    onClose?: () => void;
    /** Additional CSS classes */
    className?: string;
}

/**
 * A lightweight, animated component for displaying feedback messages.
 */
export function FlashMessage({
    message,
    type = "error",
    onClose,
    className
}: FlashMessageProps): React.JSX.Element | null {
    if (!message) return null;

    const icons = {
        error: <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />,
        warning: <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />,
        info: <Info className="h-5 w-5 shrink-0 mt-0.5" />,
        success: <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" /> // Defaulting to AlertCircle for now
    };

    const themes = {
        error: "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400",
        warning: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",
        info: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
        success: "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
    };

    const glows = {
        error: "bg-red-500",
        warning: "bg-amber-500",
        info: "bg-blue-500",
        success: "bg-emerald-500"
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -5 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className={cn(
                    "relative flex items-start gap-3 p-4 rounded-2xl border backdrop-blur-md overflow-hidden",
                    themes[type],
                    className
                )}
            >
                {/* Visual Glow Effect */}
                <div className={cn(
                    "absolute -left-6 -top-6 w-16 h-16 rounded-full blur-2xl opacity-20 pointer-events-none",
                    glows[type]
                )} />

                {icons[type]}

                <div className="flex-1">
                    <p className="text-sm font-bold leading-relaxed">{message}</p>
                </div>

                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 -mr-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors opacity-50 hover:opacity-100"
                    >
                        <XCircle className="h-4 w-4" />
                    </button>
                )}
            </motion.div>
        </AnimatePresence>
    );
}
