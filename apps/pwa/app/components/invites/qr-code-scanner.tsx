"use client";

import { useState, useRef } from "react";
import { qrGenerator } from "../../lib/invites/qr-generator";
import { inviteManager } from "../../lib/invites/invite-manager";
import type { ContactRequest } from "../../lib/invites/types";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

type ScannerState =
  | { status: "idle" }
  | { status: "scanning" }
  | { status: "processing" }
  | { status: "success"; contactRequest: ContactRequest }
  | { status: "error"; error: string };

export const QRCodeScanner = () => {
  const [state, setState] = useState<ScannerState>({ status: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setState({ status: "scanning" });

    try {
      // Create image element to load the file
      const img = new Image();
      const reader = new FileReader();

      reader.onload = async (e) => {
        if (!e.target?.result) {
          setState({ status: "error", error: "Failed to read file" });
          return;
        }

        img.onload = async () => {
          try {
            // Create canvas to extract image data
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");

            if (!ctx) {
              setState({ status: "error", error: "Failed to create canvas context" });
              return;
            }

            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            setState({ status: "processing" });

            // Scan QR code from image data
            const qrData = await qrGenerator.scanQR(imageData);

            // Process the QR invite
            const contactRequest = await inviteManager.processQRInvite(qrData.rawData || JSON.stringify(qrData));

            setState({ status: "success", contactRequest });
          } catch (error) {
            setState({
              status: "error",
              error: error instanceof Error ? error.message : "Failed to scan QR code"
            });
          }
        };

        img.onerror = () => {
          setState({ status: "error", error: "Failed to load image" });
        };

        img.src = e.target.result as string;
      };

      reader.onerror = () => {
        setState({ status: "error", error: "Failed to read file" });
      };

      reader.readAsDataURL(file);
    } catch (error) {
      setState({
        status: "error",
        error: error instanceof Error ? error.message : "Failed to process file"
      });
    }
  };

  const handleScanClick = () => {
    fileInputRef.current?.click();
  };

  const handleReset = () => {
    setState({ status: "idle" });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Card title="Scan QR Code" description="Scan a QR code to connect with someone">
      <div className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {state.status === "idle" && (
          <Button onClick={handleScanClick} className="w-full">
            Select QR Code Image
          </Button>
        )}

        {state.status === "scanning" && (
          <div className="text-center text-sm text-zinc-600 dark:text-zinc-400">
            Loading image...
          </div>
        )}

        {state.status === "processing" && (
          <div className="text-center text-sm text-zinc-600 dark:text-zinc-400">
            Processing QR code...
          </div>
        )}

        {state.status === "error" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-red-500/30 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/25 dark:text-red-300">
              {state.error}
            </div>
            <Button onClick={handleReset} variant="secondary" className="w-full">
              Try Again
            </Button>
          </div>
        )}

        {state.status === "success" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-50 px-3 py-2 dark:bg-emerald-950/25">
              <div className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                QR Code Scanned Successfully!
              </div>
              <div className="mt-2 space-y-1 text-xs text-emerald-700 dark:text-emerald-300">
                <div>
                  <span className="font-medium">From:</span>{" "}
                  {state.contactRequest.profile.displayName || 
                   `User ${state.contactRequest.senderPublicKey.slice(0, 8)}...`}
                </div>
                {state.contactRequest.message && (
                  <div>
                    <span className="font-medium">Message:</span> {state.contactRequest.message}
                  </div>
                )}
                <div>
                  <span className="font-medium">Status:</span> {state.contactRequest.status}
                </div>
              </div>
            </div>
            <Button onClick={handleReset} variant="secondary" className="w-full">
              Scan Another
            </Button>
          </div>
        )}

        <div className="text-xs text-zinc-600 dark:text-zinc-400">
          Select an image file containing a QR code to scan and process the connection request
        </div>
      </div>
    </Card>
  );
};
