"use client";

import React from "react";
import { AlertTriangle, Info, Loader2 } from "lucide-react";
import { Button } from "./button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "./dialog";
import { cn } from "../utils/cn";

export interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "danger" | "primary";
    isLoading?: boolean;
}

export function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    variant = "primary",
    isLoading = false,
}: ConfirmDialogProps) {
    const handleConfirm = async () => {
        await onConfirm();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open) {
                onClose();
            }
        }}>
            <DialogContent
                showCloseButton={false}
                className="z-[220] w-[min(30rem,calc(100vw-2rem))] gap-0 overflow-hidden rounded-[28px] border border-zinc-200/50 bg-white p-0 text-zinc-900 shadow-2xl ring-1 ring-zinc-200 dark:border-white/12 dark:bg-[#0b0b10] dark:text-zinc-50 dark:shadow-[0_30px_120px_rgba(0,0,0,0.6)] dark:ring-white/8"
            >
                <div className="absolute inset-0 bg-white dark:bg-[#0b0b10]" aria-hidden="true" />
                <div className="absolute inset-[1px] rounded-[27px] bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] dark:bg-[linear-gradient(180deg,#151626_0%,#10111b_100%)]" aria-hidden="true" />

                <div className="relative">
                    <DialogHeader className="items-center border-b border-zinc-200/50 px-8 pb-6 pt-7 text-center dark:border-white/8">
                        <div
                            className={cn(
                                "mb-4 flex h-14 w-14 items-center justify-center rounded-full border",
                                variant === "danger"
                                    ? "border-red-500/25 bg-red-500/12 text-red-400"
                                    : "border-violet-500/25 bg-violet-500/12 text-violet-300",
                            )}
                        >
                            {variant === "danger"
                                ? <AlertTriangle className="h-7 w-7" />
                                : <Info className="h-7 w-7" />}
                        </div>
                        <DialogTitle className="text-[1.45rem] font-black tracking-tight text-zinc-900 dark:text-zinc-50">
                            {title}
                        </DialogTitle>
                        <DialogDescription className="mt-2 max-w-[24rem] text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                            {description}
                        </DialogDescription>
                    </DialogHeader>

                    <DialogFooter className="flex-row gap-3 px-8 py-6 sm:justify-center">
                        <Button
                            variant="secondary"
                            className="h-12 min-w-[11rem] rounded-2xl border border-zinc-200 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:border-white/10 dark:bg-[#1a1b27] dark:text-zinc-100 dark:hover:bg-[#232537]"
                            onClick={onClose}
                            disabled={isLoading}
                        >
                            {cancelLabel}
                        </Button>
                        <Button
                            variant={variant === "danger" ? "danger" : "primary"}
                            className="h-12 min-w-[12rem] rounded-2xl gap-2 shadow-lg shadow-red-500/20"
                            onClick={handleConfirm}
                            disabled={isLoading}
                        >
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            {confirmLabel}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
