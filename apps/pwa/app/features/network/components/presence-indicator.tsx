"use client";

import React, { useMemo } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { useNetwork } from "../providers/network-provider";

// Utility for combining class names
const cn = (...classes: (string | false | undefined)[]) =>
  classes.filter(Boolean).join(" ");

interface PresenceIndicatorProps {
  /**
   * Public key of the peer to show presence for
   */
  publicKeyHex: PublicKeyHex;

  /**
   * Optional current time (passed to avoid impure Date.now in render)
   */
  currentTime?: number;

  /**
   * Size variant for the indicator
   */
  size?: "sm" | "md" | "lg";

  /**
   * Whether to show the dot indicator
   */
  showDot?: boolean;

  /**
   * Whether to show the text label
   */
  showText?: boolean;

  /**
   * Additional class names
   */
  className?: string;
}

/**
 * Formats a timestamp into a "Seen X ago" string
 * Uses P2P-appropriate thresholds that acknowledge network delays
 */
export const formatLastSeen = (
  lastSeenAtMs: number,
  currentTimeMs: number
): string => {
  const age = currentTimeMs - lastSeenAtMs;

  if (age < 0) return "just now";
  if (age < 30000) return "online";
  if (age < 60000) return `seen ${Math.floor(age / 1000)}s ago`;
  if (age < 300000) return `seen ${Math.floor(age / 60000)}m ago`;
  if (age < 3600000) return `seen ${Math.floor(age / 60000)}m ago`;
  if (age < 86400000) return `seen ${Math.floor(age / 3600000)}h ago`;
  if (age < 604800000) return `seen ${Math.floor(age / 86400000)}d ago`;

  return "offline";
};

/**
 * Gets the status color based on freshness
 * More nuanced than simple "online/offline" binary
 */
const getStatusColor = (lastSeenAtMs: number, currentTimeMs: number): string => {
  const age = currentTimeMs - lastSeenAtMs;

  if (age < 30000) return "bg-emerald-500"; // Active (online)
  if (age < 300000) return "bg-amber-500"; // Recent (seen within 5 min)
  if (age < 3600000) return "bg-orange-500"; // Away (seen within hour)
  return "bg-zinc-500"; // Offline
};

/**
 * Gets the status text color for the label
 */
const getStatusTextColor = (lastSeenAtMs: number, currentTimeMs: number): string => {
  const age = currentTimeMs - lastSeenAtMs;

  if (age < 30000) return "text-emerald-500";
  if (age < 300000) return "text-amber-500";
  if (age < 3600000) return "text-orange-500";
  return "text-zinc-500";
};

/**
 * PresenceIndicator - Displays peer presence as "Seen X ago"
 *
 * This component embraces the reality of P2P networks where
 * "online/offline" is not a binary state but a continuum of
 * "how recently have we heard from this peer."
 *
 * Instead of promising "User is Online" (which is often a lie in P2P),
 * we honestly show "User was seen 30s ago" which sets proper expectations.
 */
export const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({
  publicKeyHex,
  currentTime,
  size = "md",
  showDot = true,
  showText = true,
  className,
}) => {
  const { presence } = useNetwork();

  const lastSeenAtMs = useMemo(() => {
    return presence.getLastSeenAtMs(publicKeyHex);
  }, [presence, publicKeyHex]);

  const display = useMemo(() => {
    if (lastSeenAtMs === null || !currentTime) {
      return {
        text: "unknown",
        dotColor: "bg-zinc-500",
        textColor: "text-zinc-500",
      };
    }

    return {
      text: formatLastSeen(lastSeenAtMs, currentTime),
      dotColor: getStatusColor(lastSeenAtMs, currentTime),
      textColor: getStatusTextColor(lastSeenAtMs, currentTime),
    };
  }, [lastSeenAtMs, currentTime]);

  const sizeClasses = {
    sm: { dot: "w-2 h-2", text: "text-[10px]" },
    md: { dot: "w-2.5 h-2.5", text: "text-xs" },
    lg: { dot: "w-3 h-3", text: "text-sm" },
  };

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {showDot && (
        <span
          className={cn(
            "rounded-full shrink-0",
            sizeClasses[size].dot,
            display.dotColor
          )}
          title={`Last seen: ${
            lastSeenAtMs ? new Date(lastSeenAtMs).toLocaleString() : "never"
          }`}
        />
      )}

      {showText && (
        <span
          className={cn(
            "font-black uppercase tracking-[0.08em]",
            sizeClasses[size].text,
            display.textColor
          )}
        >
          {display.text}
        </span>
      )}
    </span>
  );
};

/**
 * Compact version for tight spaces (sidebar, etc.)
 */
export const PresenceIndicatorCompact: React.FC<
  Pick<PresenceIndicatorProps, "publicKeyHex" | "currentTime" | "className">
> = ({ publicKeyHex, currentTime, className }) => {
  const { presence } = useNetwork();

  const lastSeenAtMs = useMemo(() => {
    return presence.getLastSeenAtMs(publicKeyHex);
  }, [presence, publicKeyHex]);

  const time = currentTime;

  const display = useMemo(() => {
    if (lastSeenAtMs === null || !time) {
      return { text: "—", color: "text-zinc-500" };
    }

    const age = time - lastSeenAtMs;

    if (age < 30000) return { text: "online", color: "text-emerald-500" };
    if (age < 60000)
      return { text: `${Math.floor(age / 1000)}s`, color: "text-emerald-400" };
    if (age < 300000)
      return { text: `${Math.floor(age / 60000)}m`, color: "text-amber-500" };
    if (age < 3600000)
      return { text: `${Math.floor(age / 60000)}m`, color: "text-amber-400" };

    return { text: "offline", color: "text-zinc-500" };
  }, [lastSeenAtMs, time]);

  return (
    <span className={cn("text-[10px] font-black uppercase", display.color, className)}>
      {display.text}
    </span>
  );
};

/**
 * Badge variant - for displaying presence as a badge/pill
 */
export const PresenceBadge: React.FC<
  Pick<PresenceIndicatorProps, "publicKeyHex" | "currentTime" | "className">
> = ({ publicKeyHex, currentTime, className }) => {
  const { presence } = useNetwork();

  const lastSeenAtMs = useMemo(() => {
    return presence.getLastSeenAtMs(publicKeyHex);
  }, [presence, publicKeyHex]);

  const time = currentTime;

  const status = useMemo(() => {
    if (lastSeenAtMs === null) {
      return {
        label: "Unknown",
        bgColor: "bg-zinc-500/10",
        textColor: "text-zinc-500",
        borderColor: "border-zinc-500/20",
      };
    }

    if (!time || !lastSeenAtMs) {
      return {
        label: "Unknown",
        bgColor: "bg-zinc-500/10",
        textColor: "text-zinc-500",
        borderColor: "border-zinc-500/20",
      };
    }

    const age = time - lastSeenAtMs;

    if (age < 30000) {
      return {
        label: "Online",
        bgColor: "bg-emerald-500/10",
        textColor: "text-emerald-500",
        borderColor: "border-emerald-500/20",
      };
    }

    if (age < 300000) {
      return {
        label: `Seen ${Math.floor(age / 60000)}m ago`,
        bgColor: "bg-amber-500/10",
        textColor: "text-amber-500",
        borderColor: "border-amber-500/20",
      };
    }

    if (age < 3600000) {
      return {
        label: `Seen ${Math.floor(age / 60000)}m ago`,
        bgColor: "bg-orange-500/10",
        textColor: "text-orange-500",
        borderColor: "border-orange-500/20",
      };
    }

    return {
      label: "Offline",
      bgColor: "bg-zinc-500/10",
      textColor: "text-zinc-500",
      borderColor: "border-zinc-500/20",
    };
  }, [lastSeenAtMs, time]);

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full border",
        "text-[10px] font-black uppercase tracking-[0.08em]",
        status.bgColor,
        status.textColor,
        status.borderColor,
        className
      )}
    >
      {status.label}
    </span>
  );
};

export default PresenceIndicator;
