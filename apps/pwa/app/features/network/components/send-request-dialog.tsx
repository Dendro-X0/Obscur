"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@dweb/ui-kit";
import { Button } from "@dweb/ui-kit";
import { Textarea } from "@dweb/ui-kit";
import { Label } from "@dweb/ui-kit";
import { UserPlus, Loader2 } from "lucide-react";

interface SendRequestDialogProps {
    isOpen: boolean;
    onClose: () => void;
    recipientName: string;
    onSend: (introMessage: string) => Promise<void>;
}

export function SendRequestDialog({
    isOpen,
    onClose,
    recipientName,
    onSend
}: SendRequestDialogProps) {
    const { t } = useTranslation();
    const [introMessage, setIntroMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const recipientLabel: string = recipientName.length > 48
        ? `${recipientName.slice(0, 20)}…${recipientName.slice(-12)}`
        : recipientName;

    if (!isOpen) return null;

    const handleSend = async () => {
        setIsSending(true);
        try {
            await onSend(introMessage);
            onClose();
        } catch (error) {
            console.error("Failed to send connection request:", error);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <Card
                title={t("network.sendRequestTitle", "Send Connection Request")}
                description={t("network.sendRequestDesc", { name: recipientLabel })}
                className="w-full max-w-md shadow-2xl border-white/10 bg-white dark:bg-zinc-950 dark:border-zinc-800 modal-transition"
            >
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="intro-message" className="text-zinc-500 dark:text-zinc-400 font-bold">{t("network.introMessage", "Introduction (optional)")}</Label>
                        <Textarea
                            id="intro-message"
                            placeholder={t("network.introPlaceholder", "Hi! I'd like to connect with you...")}
                            value={introMessage}
                            onChange={(e) => setIntroMessage(e.target.value)}
                            className="h-32 resize-none rounded-xl bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus:bg-white dark:focus:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 transition-all shadow-sm"
                            maxLength={280}
                        />
                        <div className="flex justify-end">
                            <span className="text-[10px] text-zinc-400 font-medium">
                                {introMessage.length}/280
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button
                            variant="secondary"
                            className="flex-1 rounded-xl h-12"
                            onClick={onClose}
                            disabled={isSending}
                        >
                            {t("common.cancel", "Cancel")}
                        </Button>
                        <Button
                            className="flex-1 rounded-xl h-12 gap-2"
                            onClick={handleSend}
                            disabled={isSending}
                        >
                            {isSending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <UserPlus className="h-4 w-4" />
                            )}
                            {t("network.sendRequest", "Send Request")}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
