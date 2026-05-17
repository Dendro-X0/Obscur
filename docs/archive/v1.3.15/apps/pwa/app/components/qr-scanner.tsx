"use client";

import React, { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import { X, Camera, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";

interface QRScannerProps {
    onScan: (result: string) => void;
    onClose: () => void;
}

export const QRScanner = ({ onScan, onClose }: QRScannerProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const scannerRef = useRef<QrScanner | null>(null);
    const [hasCamera, setHasCamera] = useState<boolean | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const checkCamera = async () => {
            const has = await QrScanner.hasCamera();
            setHasCamera(has);
            if (!has) {
                setError("No camera found on this device");
            }
        };
        void checkCamera();

        return () => {
            if (scannerRef.current) {
                scannerRef.current.destroy();
            }
        };
    }, []);

    useEffect(() => {
        if (hasCamera && videoRef.current) {
            scannerRef.current = new QrScanner(
                videoRef.current,
                (result) => {
                    onScan(result.data);
                },
                {
                    highlightScanRegion: true,
                    highlightCodeOutline: true,
                }
            );

            scannerRef.current.start().catch((err) => {
                console.error("Failed to start scanner:", err);
                setError("Failed to access camera. Please check permissions.");
            });
        }
    }, [hasCamera, onScan]);

    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black">
            <div className="absolute top-4 right-4 z-10">
                <Button variant="ghost" size="sm" onClick={onClose} className="text-white hover:bg-white/20">
                    <X className="h-6 w-6" />
                </Button>
            </div>

            <div className="relative w-full max-w-lg aspect-square overflow-hidden bg-zinc-900 rounded-2xl shadow-2xl">
                {error ? (
                    <div className="flex h-full flex-col items-center justify-center p-8 text-center bg-zinc-900">
                        <div className="mb-4 rounded-full bg-red-500/10 p-4">
                            <Camera className="h-8 w-8 text-red-500" />
                        </div>
                        <p className="text-sm font-medium text-white">{error}</p>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={onClose}
                            className="mt-6"
                        >
                            Go Back
                        </Button>
                    </div>
                ) : (
                    <>
                        <video ref={videoRef} className="h-full w-full object-cover" />
                        <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute inset-0 border-[40px] border-black/50"></div>
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-purple-500 rounded-lg">
                                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-purple-500"></div>
                                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-purple-500"></div>
                                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-purple-500"></div>
                                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-purple-500"></div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            <div className="mt-8 px-6 text-center">
                <h3 className="text-lg font-bold text-white">Scan Invite Code</h3>
                <p className="mt-2 text-sm text-zinc-400">Position the QR code within the frame to scan</p>
            </div>

            <div className="absolute bottom-10">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => scannerRef.current?.setCamera('environment')}
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                    <RefreshCw className="mr-2 h-4 w-4" /> Switch Camera
                </Button>
            </div>
        </div>
    );
};
