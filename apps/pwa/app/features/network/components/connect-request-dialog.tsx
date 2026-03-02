"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { Send, UserPlus, Loader2 } from "lucide-react";
import { Button, Card, Textarea } from "@dweb/ui-kit";


interface ConnectRequestDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSend: (message: string) => Promise<void>;
    displayName: string;
}

export function ConnectRequestDialog({ isOpen, onClose, onSend, displayName }: ConnectRequestDialogProps) {
    const { t } = useTranslation();
    const [message, setMessage] = React.useState(`${t("network.connect.defaultMessage", "Hello! I'd like to connect with you.")}`);
    const [isSending, setIsSending] = React.useState(false);

    if (!isOpen) return null;

    const handleSend = async () => {
        setIsSending(true);
        try {
            await onSend(message);
        } catch (error) {
            console.error("Error in handleSend:", error);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <Card
                title={t("network.connect.title", "Connect with {{name}}", { name: displayName })}
                className="w-full max-w-md shadow-2xl border-white/10"
            >
                <div className="space-y-6 pt-4">
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-zinc-500 ml-1">
                            {t("network.connect.messageLabel", "Introductory Message")}
                        </label>
                        <Textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder={t("network.connect.placeholder", "Write an introductory message...")}
                            className="min-h-[120px] bg-zinc-50 dark:bg-zinc-900/50 border-black/5 dark:border-white/5 focus:bg-white dark:focus:bg-zinc-900 transition-all rounded-2xl resize-none p-4 text-sm leading-relaxed"
                            disabled={isSending}
                        />
                        <p className="text-[10px] text-zinc-500 font-medium px-1">
                            {t("network.connect.hint", "This message will be sent along with your connection request.")}
                        </p>
                    </div>

                    <div className="flex gap-4 pt-2">
                        <Button
                            variant="secondary"
                            className="flex-1 h-12 rounded-xl font-bold"
                            onClick={onClose}
                            disabled={isSending}
                        >
                            {t("common.cancel", "Cancel")}
                        </Button>
                        <Button
                            className="flex-1 h-12 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold gap-2 shadow-lg shadow-purple-500/20 transition-all active:scale-95"
                            onClick={handleSend}
                            disabled={isSending}
                        >
                            {isSending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                            {isSending ? t("common.sending", "Sending...") : t("network.connect.send", "Send Request")}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
