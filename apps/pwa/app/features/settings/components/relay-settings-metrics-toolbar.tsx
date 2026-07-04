"use client";
import type React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/app/lib/utils";
import { SettingsToggleCard } from "@/app/settings/settings-tab-panel-shared";
import { RELAY_SETTINGS_CATEGORY_ORDER, type RelaySettingsCategory, } from "@/app/features/relays/services/relay-settings-node-filter";
const CATEGORY_LABEL_KEYS: Record<Exclude<RelaySettingsCategory, "all">, string> = {
    nostr: "settings.relays.categoryNostr",
    intranet: "settings.relays.categoryIntranet",
    workspace: "settings.relays.categoryWorkspace",
};
const CATEGORY_DEFAULTS: Record<Exclude<RelaySettingsCategory, "all">, string> = {
    nostr: "Nostr",
    intranet: "Intranet & LAN",
    workspace: "Workspace / team",
};
export function RelaySettingsMetricsToolbar(params: Readonly<{
    category: RelaySettingsCategory;
    onCategoryChange: (category: RelaySettingsCategory) => void;
    availableOnly: boolean;
    onAvailableOnlyChange: (enabled: boolean) => void;
}>): React.JSX.Element {
    const { t } = useTranslation();
    return (<div className="space-y-3 px-1">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("settings.relays.categoryTabs")}>
        {RELAY_SETTINGS_CATEGORY_ORDER.map((tab) => {
            const isActive = params.category === tab;
            const label = tab === "all"
                ? t("settings.relays.categoryAll")
                : t(CATEGORY_LABEL_KEYS[tab], CATEGORY_DEFAULTS[tab]);
            return (<button key={tab} type="button" role="tab" aria-selected={isActive} onClick={() => params.onCategoryChange(tab)} className={cn("rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors", isActive
                    ? "bg-purple-600 text-white shadow-sm"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700")}>
              {label}
            </button>);
        })}
      </div>
      <SettingsToggleCard title={t("settings.relays.availableOnlyTitle")} description={t("settings.relays.availableOnlyDesc")} checked={params.availableOnly} onChange={params.onAvailableOnlyChange}/>
    </div>);
}
