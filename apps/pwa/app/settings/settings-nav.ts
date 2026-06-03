import {
  User,
  Shield,
  Network,
  Palette,
  Lock,
  Database,
  EyeOff,
  RefreshCcw,
  Bell,
  ShieldAlert,
} from "lucide-react";
import type { SettingsTabId } from "@/app/features/settings/services/settings-search-index";

export type SettingsTabType = SettingsTabId;

export type { SettingsTabId };

export const SETTINGS_VALID_TABS: ReadonlyArray<SettingsTabType> = [
  "profile",
  "identity",
  "relays",
  "notifications",
  "appearance",
  "blocklist",
  "privacy",
  "security",
  "storage",
  "updates",
];

export const SETTINGS_NAV_GROUPS = [
  {
    id: "general",
    labelKey: "settings.groups.general",
    items: [
      { id: "profile", labelKey: "settings.tabs.profile", icon: User },
      { id: "appearance", labelKey: "settings.tabs.appearance", icon: Palette },
      { id: "notifications", labelKey: "settings.tabs.notifications", icon: Bell },
    ],
  },
  {
    id: "account",
    labelKey: "settings.groups.account",
    items: [
      { id: "identity", labelKey: "settings.tabs.identity", icon: Shield },
      { id: "security", labelKey: "settings.tabs.security", icon: Lock },
    ],
  },
  {
    id: "network",
    labelKey: "settings.groups.network",
    items: [
      { id: "relays", labelKey: "settings.tabs.relays", icon: Network },
      { id: "storage", labelKey: "settings.tabs.storage", icon: Database },
    ],
  },
  {
    id: "moderation",
    labelKey: "settings.groups.moderation",
    items: [
      { id: "blocklist", labelKey: "settings.tabs.blocklist", icon: EyeOff },
      { id: "privacy", labelKey: "settings.tabs.privacy", icon: ShieldAlert },
    ],
  },
  {
    id: "system",
    labelKey: "settings.groups.system",
    items: [
      { id: "updates", labelKey: "settings.tabs.updates", icon: RefreshCcw },
    ],
  },
] as const;

export function getSettingsTabNavMeta(tabId: SettingsTabType): Readonly<{
    groupLabelKey: string;
    tabLabelKey: string;
}> {
    const match = findSettingsNavItem(tabId);
    if (match) {
        return { groupLabelKey: match.group.labelKey, tabLabelKey: match.item.labelKey };
    }
    return { groupLabelKey: "settings.title", tabLabelKey: `settings.tabs.${tabId}` };
}

export function findSettingsNavItem(tabId: SettingsTabType): Readonly<{
    group: (typeof SETTINGS_NAV_GROUPS)[number];
    item: (typeof SETTINGS_NAV_GROUPS)[number]["items"][number];
}> | null {
    for (const group of SETTINGS_NAV_GROUPS) {
        const item = group.items.find((entry) => entry.id === tabId);
        if (item) {
            return { group, item };
        }
    }
    return null;
}
