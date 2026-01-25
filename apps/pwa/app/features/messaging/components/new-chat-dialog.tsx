import React, { useState, useEffect } from "react";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { useTranslation } from "react-i18next";
import { Loader2, UserCheck, UserX, AlertCircle } from "lucide-react";
import { parsePublicKeyInput } from "../../../lib/parse-public-key-input";

interface NewChatDialogProps {
    isOpen: boolean;
    onClose: () => void;
    pubkey: string;
    setPubkey: (val: string) => void;
    displayName: string;
    setDisplayName: (val: string) => void;
    onCreate: () => void;
    verifyRecipient: (pubkeyHex: string) => Promise<{ exists: boolean; profile?: any }>;
}

export function NewChatDialog({
    isOpen,
    onClose,
    pubkey,
    setPubkey,
    displayName,
    setDisplayName,
    onCreate,
    verifyRecipient
}: NewChatDialogProps) {
    const { t } = useTranslation();
    const [isVerifying, setIsVerifying] = useState(false);
    const [verificationStatus, setVerificationStatus] = useState<'idle' | 'found' | 'not_found'>('idle');
    const [foundProfile, setFoundProfile] = useState<any>(null);

    const trimmedPubkey = pubkey.trim();
    const parsed = parsePublicKeyInput(trimmedPubkey);

    useEffect(() => {
        setVerificationStatus('idle');
        setFoundProfile(null);
    }, [pubkey]);

    const handleVerify = async () => {
        if (!parsed.ok) return;
        setIsVerifying(true);
        try {
            const result = await verifyRecipient(parsed.publicKeyHex);
            if (result.exists) {
                setVerificationStatus('found');
                setFoundProfile(result.profile);
                if (result.profile?.display_name || result.profile?.name) {
                    setDisplayName(result.profile.display_name || result.profile.name);
                }
            } else {
                setVerificationStatus('not_found');
            }
        } catch (e) {
            setVerificationStatus('not_found');
        } finally {
            setIsVerifying(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <Card title={t("messaging.newChat")} description={t("messaging.startConvByPubkey")} className="w-full max-w-md shadow-2xl">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="new-chat-pubkey">{t("messaging.publicKey")}</Label>
                        <div className="flex gap-2">
                            <Input
                                id="new-chat-pubkey"
                                value={pubkey}
                                onChange={(e) => setPubkey(e.target.value)}
                                placeholder="npub... or hex"
                                className="font-mono flex-1"
                            />
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={!parsed.ok || isVerifying}
                                onClick={handleVerify}
                            >
                                {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                            </Button>
                        </div>

                        {verificationStatus === 'found' && (
                            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded-lg border border-emerald-200 dark:border-emerald-900/50">
                                <UserCheck className="h-3.5 w-3.5" />
                                <span>User found: @{foundProfile?.name || foundProfile?.display_name || "Unknown"}</span>
                            </div>
                        )}

                        {verificationStatus === 'not_found' && (
                            <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-lg border border-amber-200 dark:border-amber-900/50">
                                <UserX className="h-3.5 w-3.5 mt-0.5" />
                                <div>
                                    <p className="font-semibold">User not found on relays.</p>
                                    <p>They might be new or haven't published a profile. You can still create the chat, but delivery isn't guaranteed.</p>
                                </div>
                            </div>
                        )}
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

                    <div className="flex gap-2 pt-2">
                        <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
                            {t("common.cancel")}
                        </Button>
                        <Button
                            type="button"
                            className="flex-1"
                            onClick={onCreate}
                            disabled={!parsed.ok}
                        >
                            {t("common.create")}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
