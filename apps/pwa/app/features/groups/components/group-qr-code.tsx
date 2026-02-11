"use client";

import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/app/components/ui/button";
import { Copy, Check, Share2 } from "lucide-react";
import { toast } from "@/app/components/ui/toast";

interface GroupQRCodeProps {
    groupId: string;
    relayUrl: string;
    groupName: string;
}

/**
 * QR Code Generator for NIP-29 Groups
 */
export function GroupQRCode({ groupId, relayUrl, groupName }: GroupQRCodeProps) {
    const [copied, setCopied] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const relayHost = new URL(relayUrl).hostname;
    const universalUrl = `https://obscur-pwa.vercel.app/groups/${groupId}?relay=${encodeURIComponent(relayUrl)}`;

    useEffect(() => {
        if (canvasRef.current) {
            QRCode.toCanvas(canvasRef.current, universalUrl, {
                width: 256,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#ffffff',
                }
            }, (error) => {
                if (error) console.error("QR Code Error:", error);
            });
        }
    }, [universalUrl]);

    const handleCopy = () => {
        navigator.clipboard.writeText(universalUrl);
        setCopied(true);
        toast.success("Invite link copied");
        setTimeout(() => setCopied(false), 2000);
    };

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Join ${groupName} on Obscur`,
                    text: `You've been invited to join the ${groupName} community!`,
                    url: universalUrl
                });
            } catch (err) {
                console.error("Share failed:", err);
            }
        } else {
            handleCopy();
        }
    };

    return (
        <div className="flex flex-col items-center gap-6 p-6">
            <div className="bg-white p-5 rounded-[32px] shadow-2xl border border-black/5 ring-4 ring-zinc-50 dark:ring-zinc-900/50">
                <canvas ref={canvasRef} className="max-w-full h-auto rounded-xl" />
            </div>

            <div className="text-center space-y-2">
                <h3 className="font-black text-xl tracking-tight text-zinc-900 dark:text-zinc-100">{groupName}</h3>
                <div className="flex flex-col items-center gap-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 px-3 py-1 rounded-full border border-purple-100 dark:border-purple-900/30">
                        {relayHost}
                    </p>
                    <p className="text-[10px] text-zinc-400 font-mono mt-1 break-all max-w-[200px]">
                        {groupId}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full">
                <Button
                    variant="secondary"
                    className="rounded-2xl gap-2 font-bold h-11"
                    onClick={handleCopy}
                >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    Copy Link
                </Button>
                <Button
                    className="rounded-2xl gap-2 font-bold h-11 shadow-lg bg-zinc-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-100 dark:text-black"
                    onClick={handleShare}
                >
                    <Share2 className="h-4 w-4" />
                    Share
                </Button>
            </div>
        </div>
    );
}
