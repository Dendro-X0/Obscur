"use client";

/**
 * Message Header Component
 *
 * Displays sender information with identicon for identity verification.
 * Part of v1.4.7 Goal 4: Security Integration.
 */

import React from "react";
import { Identicon, getContactVerificationStatus, type KeyChangeResult } from "@/app/features/security";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { cn } from "@/app/lib/cn";
import { ShieldCheck, ShieldAlert, Clock } from "lucide-react";

export interface MessageHeaderProps {
  senderPublicKeyHex: PublicKeyHex;
  senderDisplayName?: string;
  timestamp: number;
  className?: string;
  keyChangeWarning?: KeyChangeResult | null;
}

export const MessageHeader: React.FC<MessageHeaderProps> = ({
  senderPublicKeyHex,
  senderDisplayName,
  timestamp,
  className,
  keyChangeWarning,
}) => {
  const verificationStatus = getContactVerificationStatus(senderPublicKeyHex);
  const isVerified = verificationStatus.isVerified;

  const formatTime = (ts: number): string => {
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (ts: number): string => {
    const date = new Date(ts);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    if (isToday) {
      return "Today";
    }

    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-2 rounded-lg",
        "bg-zinc-50 dark:bg-zinc-900/50",
        "border border-zinc-200 dark:border-zinc-800",
        className
      )}
    >
      {/* Identicon with verification badge */}
      <div className="relative flex-shrink-0">
        <Identicon
          publicKeyHex={senderPublicKeyHex}
          size={40}
          verified={isVerified}
          showKeyFragment={false}
        />
      </div>

      {/* Sender info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-zinc-900 dark:text-white truncate">
            {senderDisplayName || "Unknown"}
          </span>

          {/* Verification status badge */}
          {isVerified ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-3 h-3" />
              <span className="hidden sm:inline">Verified</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
              <ShieldAlert className="w-3 h-3" />
              <span className="hidden sm:inline">Unverified</span>
            </span>
          )}
        </div>

        {/* Timestamp */}
        <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          <Clock className="w-3 h-3" />
          <span>{formatDate(timestamp)}, {formatTime(timestamp)}</span>
        </div>

        {/* Key change warning */}
        {keyChangeWarning && (
          <div className={cn(
            "mt-1.5 px-2 py-1 rounded text-xs",
            keyChangeWarning.severity === "critical"
              ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
              : keyChangeWarning.severity === "warning"
              ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
          )}>
            <span className="font-medium">⚠️ Key Change Detected:</span>{" "}
            {keyChangeWarning.message}
            {keyChangeWarning.recommendation && (
              <span className="block mt-0.5 text-zinc-500 dark:text-zinc-400">
                {keyChangeWarning.recommendation}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageHeader;
