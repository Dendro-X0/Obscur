"use client";

import type React from "react";
import { Check, Globe, Home, Layers, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MeshTorRuntimeState } from "@obscur/conduit-mesh-contracts/tor-policy";

import { Button } from "@dweb/ui-kit/button";
import { cn } from "@/app/lib/utils";
import {
  getTransportPresetGroupsForDepth,
  getTransportPresetsForGroup,
  isStandardTransportPresetId,
  type TransportPresetCatalogDepth,
  type TransportPresetCategory,
  type TransportPresetId,
} from "./transport-preset-catalog";
import {
  isTorPresetApplyBlocked,
  resolveTorPresetBadgeKind,
} from "./transport-preset-apply-policy";
import type { ActiveTransportMix, TransportPresetMatchState } from "./transport-preset-match";

const CATEGORY_META: Readonly<
  Record<TransportPresetCategory, Readonly<{ icon: typeof Globe; accent: string }>>
> = {
  public_nostr: {
    icon: Globe,
    accent: "border-sky-500/25 bg-sky-500/5",
  },
  private_mesh: {
    icon: Home,
    accent: "border-indigo-500/30 bg-indigo-500/5",
  },
  hybrid_adapters: {
    icon: Layers,
    accent: "border-emerald-500/25 bg-emerald-500/5",
  },
  tor: {
    icon: Shield,
    accent: "border-violet-500/30 bg-violet-500/5",
  },
};

const MATCH_BADGE_CLASS: Readonly<Record<TransportPresetMatchState, string>> = {
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  partial: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  available: "bg-zinc-500/10 text-zinc-500 dark:text-zinc-400",
};

export type TransportPresetCatalogPanelProps = Readonly<{
  onApplyPreset: (presetId: TransportPresetId) => void;
  translatePresetLabel: (presetId: TransportPresetId) => string;
  presetMatches: Readonly<Record<TransportPresetId, TransportPresetMatchState>>;
  activeMix: ActiveTransportMix;
  activePresetId?: TransportPresetId;
  onScrollToCustomEndpoint?: () => void;
  torState?: MeshTorRuntimeState;
  onNavigateToSecurity?: () => void;
  /** Messaging protocol (Nostr / Matrix) lives on Settings → Protocols — not in this catalog. */
  onNavigateToProtocols?: () => void;
  /** Standard = four paths; Advanced = full pack catalog. */
  catalogDepth?: TransportPresetCatalogDepth;
}>;

export function TransportPresetCatalogPanel({
  onApplyPreset,
  translatePresetLabel,
  presetMatches,
  activeMix,
  activePresetId,
  onScrollToCustomEndpoint,
  torState,
  onNavigateToSecurity,
  onNavigateToProtocols,
  catalogDepth = "standard",
}: TransportPresetCatalogPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const resolvedTorState = torState ?? { configured: false, ready: false };
  const presetGroups = getTransportPresetGroupsForDepth(catalogDepth);
  const activeIsAdvancedOnly = Boolean(
    activePresetId && catalogDepth === "standard" && !isStandardTransportPresetId(activePresetId),
  );

  const matchLabel = (state: TransportPresetMatchState): string => {
    if (state === "active") {
      return t("settings.relays.presetMatch.active");
    }
    if (state === "partial") {
      return t("settings.relays.presetMatch.partial");
    }
    return t("settings.relays.presetMatch.available");
  };

  return (
    <section
      id="transport-preset-catalog"
      className="space-y-4 rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/5 via-white to-indigo-50/40 p-5 shadow-sm dark:border-primary/20 dark:from-primary/10 dark:via-zinc-950 dark:to-indigo-950/20"
    >
      <div className="space-y-2">
        <h3 className="text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {t("settings.relays.transportCatalogTitle")}
        </h3>
        <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
          {catalogDepth === "standard"
            ? t("settings.relays.transportCatalogDescStandard", {
              defaultValue: "Four paths — pick one threat model. Open Advanced settings for more packs (redundancy, LAN templates, SSH).",
            })
            : t("settings.relays.transportCatalogDesc")}
        </p>
        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
          {t("settings.relays.encryptionNote")}
        </p>
        {onNavigateToProtocols ? (
          <div className="flex flex-col gap-2 rounded-xl border border-indigo-500/25 bg-indigo-500/5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-200">
              {t("settings.relays.protocolsNavHint", {
                defaultValue: "Want Matrix (or to switch messaging protocol)? That is under Settings → Protocols/Network — this page only configures Nostr/mesh relay endpoints.",
              })}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0"
              data-testid="relays-open-protocols"
              onClick={onNavigateToProtocols}
            >
              {t("settings.relays.protocolsNavCta", { defaultValue: "Open Protocols/Network" })}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-black/5 bg-white/70 px-3 py-2.5 text-xs leading-relaxed text-zinc-600 dark:border-white/10 dark:bg-black/25 dark:text-zinc-300">
        {activeMix.totalEnabled === 0
          ? t("settings.relays.activeMixEmpty")
          : t("settings.relays.activeMixSummary", {
            publicNostr: activeMix.publicNostr,
            privateMesh: activeMix.privateMesh,
            tor: activeMix.tor,
            total: activeMix.totalEnabled,
            redundancy: activeMix.redundancyMode
              ? t("settings.relays.activeMixRedundancyOn")
              : t("settings.relays.activeMixRedundancyOff"),
          })}
        {activePresetId ? (
          <span className="mt-1 block font-medium text-zinc-800 dark:text-zinc-100">
            {t("settings.relays.activePackLabel", {
              label: translatePresetLabel(activePresetId),
            })}
          </span>
        ) : null}
        {activeIsAdvancedOnly ? (
          <span className="mt-1 block text-[11px] text-amber-700 dark:text-amber-300">
            {t("settings.relays.activePackAdvancedOnly", {
              defaultValue: "This pack is Advanced-only — open Advanced settings to see every pack.",
            })}
          </span>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2" data-testid={`transport-catalog-depth-${catalogDepth}`}>
        {presetGroups.map((group) => {
          const meta = CATEGORY_META[group.category];
          const Icon = meta.icon;
          const presets = getTransportPresetsForGroup(group);

          return (
            <div
              key={group.category}
              className={cn(
                "flex flex-col gap-3 rounded-xl border p-4",
                meta.accent,
                "dark:border-white/10",
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-lg bg-white/70 p-2 text-zinc-700 shadow-sm dark:bg-black/30 dark:text-zinc-200">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {t(group.titleKey)}
                  </p>
                  <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {t(group.descriptionKey)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {presets.map((preset) => {
                  const matchState = presetMatches[preset.id] ?? "available";
                  const isActive = matchState === "active";
                  const torBlocked = isTorPresetApplyBlocked(preset, resolvedTorState);
                  const applyDisabled = isActive || torBlocked;

                  return (
                    <div
                      key={preset.id}
                      className={cn(
                        "flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between",
                        isActive
                          ? "border-emerald-500/40 bg-emerald-500/5 dark:border-emerald-500/30"
                          : "border-black/5 bg-white/80 dark:border-white/10 dark:bg-black/25",
                      )}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                            {translatePresetLabel(preset.id)}
                          </span>
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                              MATCH_BADGE_CLASS[matchState],
                            )}
                          >
                            {matchLabel(matchState)}
                          </span>
                          {(() => {
                            const torBadge = resolveTorPresetBadgeKind(preset, resolvedTorState);
                            if (!torBadge) {
                              return null;
                            }
                            const badgeClass = torBadge === "ready"
                              ? "bg-sky-500/15 text-sky-700 dark:text-sky-300"
                              : torBadge === "off"
                                ? "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400"
                                : "bg-amber-500/15 text-amber-700 dark:text-amber-300";
                            const badgeLabel = torBadge === "ready"
                              ? t("settings.conduits.torReadyBadge", { defaultValue: "Tor ready" })
                              : torBadge === "off"
                                ? t("settings.conduits.torOffBadge", { defaultValue: "Tor off" })
                                : t("settings.conduits.torNotReadyBadge", { defaultValue: "Tor not ready" });
                            return (
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                                  badgeClass,
                                )}
                              >
                                {badgeLabel}
                              </span>
                            );
                          })()}
                          {preset.isUrlTemplate ? (
                            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                              {t("settings.relays.presetTemplateBadge")}
                            </span>
                          ) : null}
                          {preset.sshTunnel ? (
                            <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                              {t("settings.relays.presetSshBadge", { defaultValue: "SSH" })}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                          {t(preset.descriptionKey)}
                        </p>
                        {torBlocked && onNavigateToSecurity ? (
                          <button
                            type="button"
                            className="text-left text-[10px] font-medium text-violet-700 underline underline-offset-2 hover:text-violet-900 dark:text-violet-300 dark:hover:text-violet-100"
                            onClick={onNavigateToSecurity}
                          >
                            {t("settings.relays.torGateSecurityLink")}
                          </button>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={isActive ? "secondary" : group.category === "public_nostr" ? "outline" : "secondary"}
                        className="shrink-0"
                        disabled={applyDisabled}
                        onClick={() => onApplyPreset(preset.id)}
                      >
                        {isActive ? (
                          <>
                            <Check className="mr-1.5 h-3.5 w-3.5" />
                            {t("settings.relays.presetMatch.active")}
                          </>
                        ) : (
                          t("settings.relays.applyPreset")
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-dashed border-zinc-300/80 bg-white/60 p-4 dark:border-zinc-600 dark:bg-black/20 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">
            {t("settings.relays.customPoolTitle")}
          </p>
          <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            {t("settings.relays.customPoolDesc")}
          </p>
        </div>
        {onScrollToCustomEndpoint ? (
          <Button type="button" size="sm" variant="outline" onClick={onScrollToCustomEndpoint}>
            {t("settings.relays.customPoolCta")}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
