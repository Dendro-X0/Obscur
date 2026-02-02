import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Card } from "./card";
import { Button } from "./button";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Info, Loader2 } from "lucide-react";
import { cn } from "../../lib/cn";

interface ConfirmDialogProps {
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
    confirmLabel,
    cancelLabel,
    variant = "primary",
    isLoading = false,
}: ConfirmDialogProps) {
    const { t } = useTranslation();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    if (!isOpen || !mounted) return null;

    const handleConfirm = async () => {
        await onConfirm();
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] grid place-items-center p-4 sm:p-0">
            <div
                className="fixed inset-0 bg-black/40 backdrop-blur-xl transition-all animate-in fade-in duration-300"
                aria-hidden="true"
                onClick={onClose}
            />
            <Card
                className="relative w-full max-w-sm z-10 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-2 duration-200 border-white/10"
            >
                <div className="space-y-6">
                    <div className="flex flex-col items-center text-center space-y-3">
                        <div className={cn(
                            "flex h-12 w-12 items-center justify-center rounded-full bg-opacity-20",
                            variant === "danger" ? "bg-red-500 text-red-500" : "bg-purple-500 text-purple-500"
                        )}>
                            {variant === "danger" ? <AlertTriangle className="h-6 w-6" /> : <Info className="h-6 w-6" />}
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                {description}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button
                            variant="secondary"
                            className="flex-1 rounded-2xl h-12 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            onClick={onClose}
                            disabled={isLoading}
                        >
                            {cancelLabel || t("common.cancel", "Cancel")}
                        </Button>
                        <Button
                            variant={variant === "danger" ? "danger" : "primary"}
                            className="flex-1 rounded-2xl h-12 gap-2 shadow-lg shadow-red-500/20"
                            onClick={handleConfirm}
                            disabled={isLoading}
                        >
                            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                            {confirmLabel || t("common.confirm", "Confirm")}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>,
        document.body
    );
}
