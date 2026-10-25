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
    confirmDisabled?: boolean;
    children?: React.ReactNode;
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
    confirmDisabled = false,
    children,
}: ConfirmDialogProps) {
    const handleConfirm = async () => {
        await onConfirm();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open && !isLoading) {
                onClose();
            }
        }}>
            <DialogContent
                showCloseButton={false}
                data-testid="confirm-dialog"
                className={cn(
                    "w-[min(30rem,calc(100vw-2rem))] gap-0 overflow-hidden rounded-[28px] border border-zinc-200/50 bg-white p-0 text-zinc-900 shadow-2xl ring-1 ring-zinc-200 dark:border-white/12 dark:bg-[#0b0b10] dark:text-zinc-50 dark:shadow-[0_30px_120px_rgba(0,0,0,0.6)] dark:ring-white/8",
                    // Mobile: bottom sheet — clears cramped center card + side-by-side min-widths.
                    "max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-[24px]",
                )}
            >
                <div className="absolute inset-0 bg-white dark:bg-[#0b0b10]" aria-hidden="true" />
                <div
                    className="absolute inset-[1px] rounded-[27px] bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] max-sm:rounded-b-none max-sm:rounded-t-[23px] dark:bg-[linear-gradient(180deg,#151626_0%,#10111b_100%)]"
                    aria-hidden="true"
                />

                <div className="relative max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom,0px),var(--obscur-safe-area-inset-bottom,0px))]">
                    <DialogHeader className="items-center border-b border-zinc-200/50 px-5 pb-4 pt-5 text-center dark:border-white/8 sm:px-8 sm:pb-6 sm:pt-7">
                        <div
                            className={cn(
                                "mb-3 flex h-12 w-12 items-center justify-center rounded-full border sm:mb-4 sm:h-14 sm:w-14",
                                variant === "danger"
                                    ? "border-red-500/25 bg-red-500/12 text-red-400"
                                    : "border-violet-500/25 bg-violet-500/12 text-violet-300",
                            )}
                        >
                            {variant === "danger"
                                ? <AlertTriangle className="h-6 w-6 sm:h-7 sm:w-7" />
                                : <Info className="h-6 w-6 sm:h-7 sm:w-7" />}
                        </div>
                        <DialogTitle className="text-[1.25rem] font-black tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-[1.45rem]">
                            {title}
                        </DialogTitle>
                        <DialogDescription className="mt-2 max-w-[24rem] text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                            {description}
                        </DialogDescription>
                    </DialogHeader>

                    {children ? (
                        <div className="relative px-5 pb-2 sm:px-8">
                            {children}
                        </div>
                    ) : null}

                    <DialogFooter className="flex flex-col-reverse gap-3 px-5 py-5 sm:flex-row sm:justify-center sm:px-8 sm:py-6">
                        <Button
                            variant="secondary"
                            className="h-12 w-full min-w-0 rounded-2xl border border-zinc-200 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:border-white/10 dark:bg-[#1a1b27] dark:text-zinc-100 dark:hover:bg-[#232537] sm:w-auto sm:min-w-[11rem]"
                            onClick={onClose}
                            disabled={isLoading}
                        >
                            {cancelLabel}
                        </Button>
                        <Button
                            variant={variant === "danger" ? "danger" : "primary"}
                            className="h-12 w-full min-w-0 rounded-2xl gap-2 shadow-lg shadow-red-500/20 sm:w-auto sm:min-w-[12rem]"
                            onClick={handleConfirm}
                            disabled={isLoading || confirmDisabled}
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
