"use client";

import React from "react";
import { Zap, Upload, FileJson, Wifi, WifiOff, AlertCircle } from "lucide-react";

// Utility for combining class names
const cn = (...classes: (string | false | undefined)[]) =>
  classes.filter(Boolean).join(" ");

export type RelayCapability =
  | "relay_socket"      // Basic WebSocket connection
  | "relay_publish"     // Can publish events
  | "relay_subscribe"   // Can subscribe to events
  | "nip11_fetch"       // NIP-11 relay info document
  | "nip96_discovery"   // NIP-96 file upload support
  | "nip96_auth_precheck"; // NIP-96 auth check

export type CapabilityStatus = "ok" | "degraded" | "failed" | "unsupported" | "unknown";

export interface RelayCapabilityInfo {
  capability: RelayCapability;
  status: CapabilityStatus;
  latencyMs?: number;
  message?: string;
}

interface RelayCapabilityBadgeProps {
  capabilities: RelayCapabilityInfo[];
  relayUrl: string;
  isLoading?: boolean;
  className?: string;
  compact?: boolean;
}

const capabilityConfig: Record<
  RelayCapability,
  { label: string; icon: React.ReactNode; description: string }
> = {
  relay_socket: {
    label: "Socket",
    icon: <Wifi className="h-3 w-3" />,
    description: "WebSocket connection available",
  },
  relay_publish: {
    label: "Publish",
    icon: <Zap className="h-3 w-3" />,
    description: "Can publish events to relay",
  },
  relay_subscribe: {
    label: "Subscribe",
    icon: <Zap className="h-3 w-3" />,
    description: "Can subscribe to events from relay",
  },
  nip11_fetch: {
    label: "NIP-11",
    icon: <FileJson className="h-3 w-3" />,
    description: "Relay info document (NIP-11) supported",
  },
  nip96_discovery: {
    label: "NIP-96",
    icon: <Upload className="h-3 w-3" />,
    description: "File upload (NIP-96) supported",
  },
  nip96_auth_precheck: {
    label: "Auth",
    icon: <AlertCircle className="h-3 w-3" />,
    description: "NIP-96 authentication check",
  },
};

const statusColors: Record<CapabilityStatus, string> = {
  ok: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30",
  degraded: "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/30",
  failed: "bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-500/30",
  unsupported: "bg-zinc-100 dark:bg-zinc-500/20 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-500/30",
  unknown: "bg-zinc-50 dark:bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-500/20",
};

const statusDotColors: Record<CapabilityStatus, string> = {
  ok: "bg-emerald-500",
  degraded: "bg-amber-500",
  failed: "bg-rose-500",
  unsupported: "bg-zinc-500",
  unknown: "bg-zinc-600",
};

/**
 * Displays relay capability badges with status indicators.
 * Shows which NIPs and basic features a relay supports.
 */
export const RelayCapabilityBadge: React.FC<RelayCapabilityBadgeProps> = ({
  capabilities,
  relayUrl,
  isLoading = false,
  className,
  compact = false,
}) => {
  if (isLoading) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-zinc-100 dark:bg-zinc-500/10 border-zinc-300 dark:border-zinc-500/20",
          className
        )}
      >
        <div className="h-2 w-2 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-pulse" />
        <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          Probing...
        </span>
      </div>
    );
  }

  // Count capabilities by status
  const okCount = capabilities.filter((c) => c.status === "ok").length;
  const hasFailures = capabilities.some((c) => c.status === "failed");

  if (compact) {
    // Compact view - just show summary dot and count
    const overallStatus: CapabilityStatus = hasFailures
      ? "failed"
      : okCount > 0
      ? "ok"
      : "unknown";

    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 px-2.5 py-1 rounded-full border",
          statusColors[overallStatus],
          className
        )}
        title={`${okCount}/${capabilities.length} capabilities available`}
      >
        <div className={cn("h-1.5 w-1.5 rounded-full", statusDotColors[overallStatus])} />
        <span className="text-[10px] font-black uppercase tracking-wider">
          {okCount}/{capabilities.length}
        </span>
      </div>
    );
  }

  // Full view - show all capabilities
  return (
    <div
      className={cn(
        "flex flex-wrap gap-2 p-3 rounded-2xl border border-zinc-200 dark:border-white/5 bg-white dark:bg-[#0E0E10] shadow-sm",
        className
      )}
    >
      <div className="w-full mb-2">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-500">
          Relay Capabilities
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-600 truncate mt-0.5" title={relayUrl}>
          {relayUrl.replace(/^wss?:\/\//, "")}
        </p>
      </div>

      {capabilities.map((cap) => {
        const config = capabilityConfig[cap.capability];
        return (
          <div
            key={cap.capability}
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border",
              statusColors[cap.status]
            )}
            title={`${config.description}${cap.latencyMs ? ` (${cap.latencyMs}ms)` : ""}${cap.message ? `: ${cap.message}` : ""}`}
          >
            {config.icon}
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {config.label}
            </span>
            {cap.latencyMs && cap.status === "ok" && (
              <span className="text-[9px] opacity-70">{cap.latencyMs}ms</span>
            )}
          </div>
        );
      })}

      {capabilities.length === 0 && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-zinc-100 dark:bg-zinc-500/10 border-zinc-300 dark:border-zinc-500/20 text-zinc-500 dark:text-zinc-400">
          <WifiOff className="h-3 w-3" />
          <span className="text-[10px] font-bold uppercase tracking-wider">
            No capabilities detected
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * Compact inline version for small spaces
 */
export const RelayCapabilityBadgeInline: React.FC<
  Pick<RelayCapabilityBadgeProps, "capabilities" | "isLoading" | "className">
> = ({ capabilities, isLoading, className }) => {
  if (isLoading) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-zinc-500", className)}>
        <div className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-pulse" />
        <span className="text-[10px] font-bold uppercase">...</span>
      </span>
    );
  }

  const okCount = capabilities.filter((c) => c.status === "ok").length;
  const hasFailures = capabilities.some((c) => c.status === "failed");
  const total = capabilities.length || 4; // Default to 4 basic capabilities

  const overallStatus: CapabilityStatus = hasFailures
    ? "failed"
    : okCount > 0
    ? "ok"
    : "unknown";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded border",
        statusColors[overallStatus],
        className
      )}
      title={`${okCount}/${total} relay capabilities available`}
    >
      <div className={cn("h-1 w-1 rounded-full", statusDotColors[overallStatus])} />
      <span className="text-[9px] font-black uppercase tracking-wider">
        {okCount}/{total}
      </span>
    </span>
  );
};

export default RelayCapabilityBadge;
