"use client";

import type React from "react";
import { useState } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Copy, Share2, Check, Sparkles } from "lucide-react";
import { useUserInviteCode } from "../lib/use-user-invite-code";
import { useIdentity } from "../lib/use-identity";

export const ShareInviteCard = (): React.JSX.Element => {
    const identity = useIdentity();
    const { publicKeyHex, privateKeyHex } = identity.state;
    const { inviteCode, publishCode, isPublishing } = useUserInviteCode({
        publicKeyHex: publicKeyHex as any,
        privateKeyHex: privateKeyHex as any
    });

    const [copied, setCopied] = useState(false);

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
        <Card className="overflow-hidden bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-black">
            <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/10 text-purple-600">
                            <Sparkles className="h-4 w-4" />
                        </div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500">My Invite Code</h3>
                    </div>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void publishCode()}
                        disabled={isPublishing}
                        className="h-8 py-0 px-2 text-[10px]"
                    >
                        {isPublishing ? "Publishing..." : "Sync to Relays"}
                    </Button>
                </div>

                <div className="flex flex-col items-center justify-center space-y-4 py-2">
                    <div className="text-3xl font-black tracking-tighter text-zinc-900 dark:text-zinc-50">
                        {inviteCode}
                    </div>
                    <p className="text-center text-xs text-zinc-600 dark:text-zinc-400">
                        Share this code with a friend. They can paste it in the Search tab to find you instantly.
                    </p>
                </div>

                <div className="mt-6 flex gap-2">
                    <Button onClick={handleCopy} className="flex-1" variant={copied ? "secondary" : "primary"}>
                        {copied ? (
                            <><Check className="mr-2 h-4 w-4" /> Copied</>
                        ) : (
                            <><Copy className="mr-2 h-4 w-4" /> Copy Code</>
                        )}
                    </Button>
                    <Button onClick={() => void handleShare()} variant="secondary" className="px-3">
                        <Share2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </Card>
    );
};
