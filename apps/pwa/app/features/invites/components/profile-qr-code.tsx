import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/app/components/ui/button";
import { Copy, Check } from "lucide-react";

interface ProfileQRCodeProps {
    nprofile: string;
    displayName?: string;
}

export function ProfileQRCode({ nprofile, displayName }: ProfileQRCodeProps) {
    const [copied, setCopied] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (canvasRef.current) {
            QRCode.toCanvas(canvasRef.current, nprofile, {
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
    }, [nprofile]);

    const handleCopy = () => {
        navigator.clipboard.writeText(nprofile);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex flex-col items-center gap-4 p-4">
            <div className="bg-white p-4 rounded-xl shadow-lg border border-border">
                <canvas ref={canvasRef} className="max-w-full h-auto" />
            </div>

            <div className="text-center space-y-1">
                <h3 className="font-bold text-lg">{displayName || "Your Profile"}</h3>
                <p className="text-xs text-muted-foreground break-all max-w-[200px] font-mono">
                    {nprofile.slice(0, 32)}...
                </p>
            </div>

            <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={handleCopy}
            >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied!" : "Copy nprofile"}
            </Button>
        </div>
    );
}
