"use client";

/**
 * Community Mode Badge Component
 *
 * Displays community mode (Sovereign Room / Managed Workspace) with
 * relay capability tier and honest guarantees.
 *
 * Part of v1.4.7 Goal 5: Relay Capability Badges
 */

import React from "react";
import { cn } from "@/app/lib/cn";
import {
  assessRelayCapability,
  getCommunityModeDefinition,
} from "../services/community-mode-contract";
import type { CommunityMode, RelayCapabilityTier } from "../types/community-mode";
import { Shield, Users, Lock, Wifi, Server, AlertTriangle, CheckCircle2 } from "lucide-react";

interface CommunityModeBadgeProps {
  mode: CommunityMode | null | undefined;
  enabledRelayUrls: ReadonlyArray<string>;
  selectedRelayHost?: string | null;
  className?: string;
  compact?: boolean;
  showGuarantees?: boolean;
}

const tierColors: Record<RelayCapabilityTier, string> = {
  unconfigured: "bg-zinc-100 dark:bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-500/20",
  public_default: "bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-500/30",
  trusted_private: "bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/30",
  managed_intranet: "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30",
};

const tierIcons: Record<RelayCapabilityTier, React.ReactNode> = {
  unconfigured: <Wifi className="w-4 h-4" />,
  public_default: <Shield className="w-4 h-4" />,
  trusted_private: <Lock className="w-4 h-4" />,
  managed_intranet: <Server className="w-4 h-4" />,
};

const modeIcons: Record<CommunityMode, React.ReactNode> = {
  sovereign_room: <Shield className="w-4 h-4" />,
  managed_workspace: <Users className="w-4 h-4" />,
};

export const CommunityModeBadge: React.FC<CommunityModeBadgeProps> = ({
  mode,
  enabledRelayUrls,
  selectedRelayHost,
  className,
  compact = false,
  showGuarantees = true,
}) => {
  // Assess relay capability based on current configuration
  const assessment = React.useMemo(() => {
    return assessRelayCapability({
      enabledRelayUrls,
      selectedRelayHost,
    });
  }, [enabledRelayUrls, selectedRelayHost]);

  // Use provided mode or fall back to recommended mode
  const effectiveMode = mode || assessment.recommendedMode;
  const modeDef = getCommunityModeDefinition(effectiveMode);

  if (compact) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 px-2.5 py-1 rounded-full border",
          tierColors[assessment.tier],
          className
        )}
        title={`${modeDef.label} — ${assessment.label}`}
      >
        {modeIcons[effectiveMode]}
        <span className="text-[10px] font-black uppercase tracking-wider">
          {modeDef.label}
        </span>
        <span className="text-[9px] opacity-70">•</span>
        {tierIcons[assessment.tier]}
        <span className="text-[9px] font-bold uppercase">
          {assessment.label}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/5 dark:bg-[#0E0E10]",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "shrink-0 rounded-xl p-2",
            effectiveMode === "sovereign_room"
              ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400"
              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
          )}
        >
          {modeIcons[effectiveMode]}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              {modeDef.label}
            </h3>
            <p className="mt-0.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              {modeDef.shortDescription}
            </p>
          </div>
          <div
            className={cn(
              "inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1",
              tierColors[assessment.tier]
            )}
          >
            {tierIcons[assessment.tier]}
            <span className="truncate text-[10px] font-semibold uppercase tracking-wide">
              {assessment.label}
            </span>
          </div>
        </div>
      </div>

      {showGuarantees ? (
        <div className="mt-3 space-y-1.5 border-t border-zinc-100 pt-3 dark:border-white/5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Honest guarantees
          </p>
          <ul className="space-y-1">
            {modeDef.guarantees.map((guarantee, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-xs text-zinc-700 dark:text-zinc-300"
              >
                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                <span>{guarantee}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 dark:border-amber-500/20 dark:bg-amber-500/10">
        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-[10px] leading-relaxed text-amber-800 dark:text-amber-400">
          {modeDef.caution}
        </p>
      </div>

      {assessment.settingsHint && mode !== effectiveMode ? (
        <p className="mt-2 text-[10px] italic text-zinc-500">
          {assessment.settingsHint}
        </p>
      ) : null}
    </div>
  );
};

/**
 * Inline compact version for community headers
 */
export const CommunityModeBadgeInline: React.FC<
  Pick<CommunityModeBadgeProps, "mode" | "enabledRelayUrls" | "selectedRelayHost" | "className">
> = ({ mode, enabledRelayUrls, selectedRelayHost, className }) => {
  const assessment = React.useMemo(() => {
    return assessRelayCapability({
      enabledRelayUrls,
      selectedRelayHost,
    });
  }, [enabledRelayUrls, selectedRelayHost]);

  const effectiveMode = mode || assessment.recommendedMode;
  const modeDef = getCommunityModeDefinition(effectiveMode);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[10px]",
        "text-zinc-500 dark:text-zinc-400",
        className
      )}
    >
      {modeIcons[effectiveMode]}
      <span className="font-medium">{modeDef.label}</span>
      <span className="opacity-50">•</span>
      <span
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border",
          tierColors[assessment.tier]
        )}
      >
        {tierIcons[assessment.tier]}
        <span className="font-bold uppercase">{assessment.label}</span>
      </span>
    </span>
  );
};

export default CommunityModeBadge;
