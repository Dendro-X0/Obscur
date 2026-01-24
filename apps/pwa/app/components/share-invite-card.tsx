"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Copy, Share2, Check, Sparkles, QrCode } from "lucide-react";
import { useUserInviteCode } from "../lib/use-user-invite-code";
import { useIdentity } from "../lib/use-identity";
import QRCode from "qrcode";

export const ShareInviteCard = (): React.JSX.Element => {
    const identity = useIdentity();
    const { publicKeyHex, privateKeyHex } = identity.state;
    const { inviteCode, publishCode, isPublishing } = useUserInviteCode({
        publicKeyHex: publicKeyHex as any,
        privateKeyHex: privateKeyHex as any
    });

    const [copied, setCopied] = useState(false);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [showQr, setShowQr] = useState(false);

    useEffect(() => {
        if (inviteCode) {
            QRCode.toDataURL(inviteCode, {
                width: 400,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                }
            })
                .then(setQrDataUrl)
                .catch(err => console.error("QR Generation failed", err));
        }
    }, [inviteCode]);

    const handleCopy = () => {
        if (!inviteCode) return;
        void navigator.clipboard.writeText(inviteCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleShare = async () => {
        if (!inviteCode) return;
        const shareData = {
            title: 'Join me on Obscur',
            text: `Chat with me on Obscur using my invite code: ${inviteCode}`,
            url: window.location.origin
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                console.error('Share failed:', err);
            }
        } else {
            handleCopy();
        }
    };

    if (!inviteCode) return <></>;

    return (
        <Card className="overflow-hidden bg-white/50 backdrop-blur-sm dark:bg-zinc-900/50 dark:border-white/10">
            <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400">
                            <Sparkles className="h-4 w-4" />
                        </div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">My Invite Code</h3>
                    </div>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void publishCode()}
                        disabled={isPublishing}
                        className="h-7 py-0 px-2 text-[10px] bg-zinc-100 dark:bg-zinc-800"
                    >
                        {isPublishing ? "Publishing..." : "Sync to Relays"}
                    </Button>
                </div>

                <div className="flex flex-col items-center justify-center space-y-4 py-2">
                    {showQr && qrDataUrl ? (
                        <div className="relative group cursor-pointer" onClick={() => setShowQr(false)}>
                            <img
                                src={qrDataUrl}
                                alt="Invite QR Code"
                                className="h-40 w-40 rounded-xl border-4 border-white shadow-xl dark:border-zinc-800 animate-in zoom-in-95 duration-200"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                                <span className="text-[10px] font-bold uppercase text-zinc-600 bg-white/90 px-2 py-1 rounded-full shadow-sm">Hide QR</span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center space-y-2">
                            <div className="text-4xl font-black tracking-tighter text-zinc-900 dark:text-zinc-50 font-mono">
                                {inviteCode}
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowQr(true)}
                                className="h-6 text-[10px] text-zinc-500 hover:text-purple-600 dark:hover:text-purple-400"
                            >
                                <QrCode className="mr-1 h-3 w-3" /> Show QR Code
                            </Button>
                        </div>
                    )}

                    <p className="text-center text-xs text-zinc-600 dark:text-zinc-400 max-w-[200px]">
                        Share this code with a friend. They can use it to find you instantly.
                    </p>
                </div>

                <div className="mt-6 flex gap-2">
                    <Button onClick={handleCopy} className="flex-1 h-10 shadow-sm" variant={copied ? "secondary" : "primary"}>
                        {copied ? (
                            <><Check className="mr-2 h-4 w-4" /> Copied</>
                        ) : (
                            <><Copy className="mr-2 h-4 w-4" /> Copy Code</>
                        )}
                    </Button>
                    <Button onClick={() => void handleShare()} variant="secondary" className="px-3 h-10 border-zinc-200 dark:border-zinc-800">
                        <Share2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </Card>
    );
};
