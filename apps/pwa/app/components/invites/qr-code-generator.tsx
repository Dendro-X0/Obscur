"use client";

import { useState, useEffect } from "react";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { qrGenerator } from "@/app/features/invites/utils/qr-generator";
import type { QRCode, QRInviteOptions } from "@/app/features/invites/utils/types";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

type QRGeneratorState = 
  | { status: "idle" }
  | { status: "generating" }
  | { status: "success"; qrCode: QRCode }
  | { status: "error"; error: string };

export const QRCodeGenerator = () => {
  const identity = useIdentity();
  const [state, setState] = useState<QRGeneratorState>({ status: "idle" });
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [expirationHours, setExpirationHours] = useState("24");
  const [includeProfile, setIncludeProfile] = useState(true);

  const canGenerate = identity.state.status === "unlocked" && identity.state.privateKeyHex && identity.state.publicKeyHex;

  const handleGenerate = async () => {
    if (!canGenerate || !identity.state.privateKeyHex || !identity.state.publicKeyHex) {
      return;
    }

    setState({ status: "generating" });

    try {
      const options: QRInviteOptions = {
        displayName: displayName.trim() || undefined,
        message: message.trim() || undefined,
        expirationHours: parseInt(expirationHours, 10),
        includeProfile
      };

      const qrCode = await qrGenerator.createInviteQR(
        identity.state.publicKeyHex,
        identity.state.privateKeyHex,
        options
      );

      setState({ status: "success", qrCode });
    } catch (error) {
      setState({ 
        status: "error", 
        error: error instanceof Error ? error.message : "Failed to generate QR code" 
      });
    }
  };

  const handleCopy = async () => {
    if (state.status !== "success") return;

    try {
      await navigator.clipboard.writeText(state.qrCode.rawData);
      // TODO: Show toast notification
    } catch (error) {
      console.error("Failed to copy QR data:", error);
    }
  };

  const handleDownload = () => {
    if (state.status !== "success") return;

    const link = document.createElement("a");
    link.href = state.qrCode.dataUrl;
    link.download = `obscur-invite-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async () => {
    if (state.status !== "success") return;

    if (navigator.share) {
      try {
        // Convert data URL to blob
        const response = await fetch(state.qrCode.dataUrl);
        const blob = await response.blob();
        const file = new File([blob], "obscur-invite.png", { type: "image/png" });

        await navigator.share({
          title: "Obscur Invite",
          text: "Scan this QR code to connect with me on Obscur",
          files: [file]
        });
      } catch (error) {
        console.error("Failed to share:", error);
      }
    } else {
      // Fallback to copy
      await handleCopy();
    }
  };

  if (identity.state.status !== "unlocked") {
    return (
      <Card title="Generate QR Code" description="Create a QR code to share your connection information">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          Please unlock your identity to generate QR codes
        </div>
      </Card>
    );
  }

  return (
    <Card title="Generate QR Code" description="Create a QR code to share your connection information">
      <div className="space-y-4">
        <div>
          <Label htmlFor="displayName">Display Name (optional)</Label>
          <Input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            disabled={state.status === "generating"}
          />
        </div>

        <div>
          <Label htmlFor="message">Personal Message (optional)</Label>
          <Input
            id="message"
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Hi, let's connect!"
            disabled={state.status === "generating"}
          />
        </div>

        <div>
          <Label htmlFor="expiration">Expiration (hours)</Label>
          <Input
            id="expiration"
            type="number"
            min="1"
            max="168"
            value={expirationHours}
            onChange={(e) => setExpirationHours(e.target.value)}
            disabled={state.status === "generating"}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="includeProfile"
            type="checkbox"
            checked={includeProfile}
            onChange={(e) => setIncludeProfile(e.target.checked)}
            disabled={state.status === "generating"}
            className="h-4 w-4 rounded border-black/10 dark:border-white/10"
          />
          <Label htmlFor="includeProfile" className="cursor-pointer">
            Include profile information
          </Label>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={!canGenerate || state.status === "generating"}
          className="w-full"
        >
          {state.status === "generating" ? "Generating..." : "Generate QR Code"}
        </Button>

        {state.status === "error" && (
          <div className="rounded-xl border border-red-500/30 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/25 dark:text-red-300">
            {state.error}
          </div>
        )}

        {state.status === "success" && (
          <div className="space-y-4">
            <div className="flex justify-center rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950/60">
              <img
                src={state.qrCode.dataUrl}
                alt="QR Code"
                className="h-64 w-64"
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={handleCopy} variant="secondary" className="flex-1">
                Copy Data
              </Button>
              <Button onClick={handleDownload} variant="secondary" className="flex-1">
                Download
              </Button>
              <Button onClick={handleShare} variant="secondary" className="flex-1">
                Share
              </Button>
            </div>

            <div className="text-xs text-zinc-600 dark:text-zinc-400">
              This QR code will expire in {expirationHours} hours
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
