
import React from "react";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { useTranslation } from "react-i18next";

interface NewChatDialogProps {
    isOpen: boolean;
    onClose: () => void;
    pubkey: string;
    setPubkey: (val: string) => void;
    displayName: string;
    setDisplayName: (val: string) => void;
    onCreate: () => void;
}

export function NewChatDialog({ isOpen, onClose, pubkey, setPubkey, displayName, setDisplayName, onCreate }: NewChatDialogProps) {
    const { t } = useTranslation();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <Card title={t("messaging.newChat")} description={t("messaging.startConvByPubkey")} className="w-full max-w-md">
                <div className="space-y-3">
                    <div className="space-y-2">
                        <Label htmlFor="new-chat-pubkey">{t("messaging.publicKey")}</Label>
                        <Input
                            id="new-chat-pubkey"
                            value={pubkey}
                            onChange={(e) => setPubkey(e.target.value)}
                            placeholder="npub..."
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="new-chat-name">{t("messaging.displayName")}</Label>
                        <Input
                            id="new-chat-name"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Optional"
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
                            {t("common.cancel")}
                        </Button>
                        <Button type="button" className="flex-1" onClick={onCreate}>
                            {t("common.create")}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
