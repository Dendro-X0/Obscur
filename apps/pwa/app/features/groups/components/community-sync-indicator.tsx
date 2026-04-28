"use client";

import React from "react";
import { Loader2, Users, WifiOff } from "lucide-react";
// Utility for combining class names
const cn = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(" ");

export type SyncConfidenceLevel =
  | "seed_only"
  | "warming_up"
  | "partial_eose"
  | "steady_state";

interface CommunitySyncIndicatorProps {
  /**
   * Current confidence level based on relay evidence
   */
  confidenceLevel: SyncConfidenceLevel;

  /**
   * Number of members found so far
   */
  memberCount: number;

  /**
   * Number of peers we've gossiped with
   */
  peersContacted?: number;

  /**
   * Time since last event received
   */
  lastEventAt?: number;

  /**
   * Current timestamp (passed to avoid impure Date.now() in render)
   */
  currentTime?: number;

  /**
   * Whether we're currently connected to relays
   */
  isConnected: boolean;

  /**
   * Additional class names
   */
  className?: string;
}

/**
 * Displays synchronization status for community member lists.
 *
 * This component embraces eventual consistency by showing users
 * the actual sync progress instead of pretending everything is
 * immediately available (which leads to confusion when members "disappear").
 *
 * Educational tooltips explain why P2P systems require patience.
 */
export const CommunitySyncIndicator: React.FC<CommunitySyncIndicatorProps> = ({
  confidenceLevel,
  memberCount,
  peersContacted = 0,
  lastEventAt,
  currentTime,
  isConnected,
  className,
}) => {
  // Don't show if we're in steady state and have members
  if (confidenceLevel === "steady_state" && memberCount > 0) {
    return null;
  }

  // Calculate time since last event if both timestamps provided
  const timeSinceLastEvent =
    lastEventAt && currentTime ? currentTime - lastEventAt : null;

  // Don't show if we've been stable for more than 10 seconds
  if (timeSinceLastEvent && timeSinceLastEvent > 10000 && memberCount > 0) {
    return null;
  }

  const getStatusConfig = () => {
    switch (confidenceLevel) {
      case "seed_only":
        return {
          icon: <WifiOff className="h-5 w-5 text-amber-400" />,
          title: "Connecting to network...",
          description: "Finding peers to sync with",
          color: "text-amber-400",
          bgColor: "bg-amber-500/10 border-amber-500/20",
        };

      case "warming_up":
        return {
          icon: <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />,
          title: "Synchronizing with peers...",
          description: `Found ${memberCount} member${memberCount !== 1 ? "s" : ""} so far`,
          color: "text-indigo-400",
          bgColor: "bg-indigo-500/10 border-indigo-500/20",
        };

      case "partial_eose":
        return {
          icon: <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />,
          title: "Almost there...",
          description: `Found ${memberCount} members, verifying with ${peersContacted} peers`,
          color: "text-emerald-400",
          bgColor: "bg-emerald-500/10 border-emerald-500/20",
        };

      case "steady_state":
        if (memberCount === 0) {
          return {
            icon: <Users className="h-5 w-5 text-zinc-400" />,
            title: "No members found yet",
            description: "You may be the first member, or still syncing",
            color: "text-zinc-400",
            bgColor: "bg-zinc-500/10 border-zinc-500/20",
          };
        }
        return null; // Don't show in steady state with members

      default:
        return {
          icon: <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />,
          title: "Synchronizing...",
          description: "Discovering community members",
          color: "text-zinc-400",
          bgColor: "bg-zinc-500/10 border-zinc-500/20",
        };
    }
  };

  const config = getStatusConfig();
  if (!config) return null;

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 mb-4",
        config.bgColor,
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{config.icon}</div>

        <div className="flex-1 min-w-0">
          <h4 className={cn("font-black text-sm", config.color)}>
            {config.title}
          </h4>

          <p className="text-xs text-zinc-400 mt-1">{config.description}</p>

          {isConnected && confidenceLevel !== "seed_only" && (
            <div className="mt-3 space-y-2">
              {/* Progress bar showing sync progress */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-black/20 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      confidenceLevel === "warming_up"
                        ? "bg-indigo-400 w-1/3"
                        : confidenceLevel === "partial_eose"
                        ? "bg-emerald-400 w-2/3"
                        : "bg-zinc-400 w-1/4"
                    )}
                  />
                </div>
                <span className="text-[10px] text-zinc-500 font-black uppercase">
                  {confidenceLevel === "warming_up"
                    ? "Warming Up"
                    : confidenceLevel === "partial_eose"
                    ? "Nearly Done"
                    : "Starting"}
                </span>
              </div>

              {/* Educational tooltip */}
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                <span className="text-zinc-400">Privacy Note:</span> In a
                decentralized system, member discovery takes time. We&apos;re
                gossiping with peers instead of asking a central server.
                This is slower, but keeps your data sovereign.
              </p>
            </div>
          )}

          {!isConnected && (
            <p className="text-[10px] text-amber-400 mt-2">
              Not connected to relays. Checking connection...
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Compact version for smaller spaces (sidebar, etc.)
 */
export const CommunitySyncIndicatorCompact: React.FC<
  Pick<CommunitySyncIndicatorProps, "confidenceLevel" | "memberCount" | "className">
> = ({ confidenceLevel, memberCount, className }) => {
  if (confidenceLevel === "steady_state" || memberCount > 1) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-2 text-xs", className)}>
      <Loader2 className="h-3 w-3 animate-spin text-indigo-400" />
      <span className="text-zinc-400">
        {confidenceLevel === "seed_only"
          ? "Connecting..."
          : confidenceLevel === "warming_up"
          ? `Found ${memberCount} member${memberCount !== 1 ? "s" : ""}...`
          : "Syncing..."}
      </span>
    </div>
  );
};

export default CommunitySyncIndicator;
