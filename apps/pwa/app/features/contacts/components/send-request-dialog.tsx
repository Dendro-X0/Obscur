"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Textarea } from "@/app/components/ui/textarea";
import { Label } from "@/app/components/ui/label";
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
                title={t("contacts.sendRequestTitle", "Send Connection Request")}
                description={t("contacts.sendRequestDesc", `Introduce yourself to ${recipientName}`)}
                className="w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200"
            >
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="intro-message">{t("contacts.introMessage", "Introduction (optional)")}</Label>
                        <Textarea
                            id="intro-message"
                            placeholder={t("contacts.introPlaceholder", "Hi! I'd like to connect with you...")}
                            value={introMessage}
                            onChange={(e) => setIntroMessage(e.target.value)}
                            className="h-32 resize-none rounded-xl"
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
                            {t("contacts.sendRequest", "Send Request")}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
