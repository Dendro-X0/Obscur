import React, { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import { Button } from "@/app/components/ui/button";
import { X, Camera } from "lucide-react";

interface QRScannerProps {
    onScan: (result: string) => void;
    onClose: () => void;
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const scannerRef = useRef<QrScanner | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!videoRef.current) return;

        const scanner = new QrScanner(
            videoRef.current,
            (result) => {
                onScan(result.data);
                scanner.stop();
                onClose();
            },
            {
                highlightScanRegion: true,
                highlightCodeOutline: true,
            }
        );

        scanner.start().catch((err) => {
            console.error("Scanner error:", err);
            setError("Could not start camera. Please check permissions.");
        });

        scannerRef.current = scanner;

        return () => {
            scanner.destroy();
        };
    }, [onScan, onClose]);

    return (
        <div className="flex flex-col items-center gap-4 bg-black rounded-xl overflow-hidden relative min-h-[300px] w-full max-w-sm mx-auto">
            <video
                ref={videoRef}
                className="w-full h-full object-cover rounded-xl"
            />

            <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 bg-black/50 hover:bg-black text-white rounded-full z-10 w-10 h-10 p-0"
                onClick={onClose}
            >
                <X className="h-5 w-5" />
            </Button>

            {error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white p-6 text-center gap-4">
                    <Camera className="h-10 w-10 text-muted-foreground" />
                    <p className="text-sm">{error}</p>
                    <Button variant="secondary" onClick={onClose}>Close</Button>
                </div>
            ) : (
                <div className="absolute bottom-4 left-0 right-0 text-center">
                    <p className="text-white/70 text-xs px-4 py-1 bg-black/40 rounded-full inline-block backdrop-blur-md">
                        Center the QR code in the frame
                    </p>
                </div>
            )}
        </div>
    );
}
