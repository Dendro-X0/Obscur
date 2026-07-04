import type { LucideIcon } from "lucide-react";
import { Scale, Shield, SlidersHorizontal, Users } from "lucide-react";

export type GroupManagementTabId = "general" | "members" | "governance" | "settings";

export const GROUP_MANAGEMENT_TABS: ReadonlyArray<{
    id: GroupManagementTabId;
    labelKey: string;
    icon: LucideIcon;
}> = [
    { id: "general", labelKey: "groups.management.tabs.general", icon: SlidersHorizontal },
    { id: "members", labelKey: "groups.management.tabs.members", icon: Users },
    { id: "governance", labelKey: "groups.management.tabs.governance", icon: Scale },
    { id: "settings", labelKey: "groups.management.tabs.settings", icon: Shield },
] as const;

export const GROUP_MANAGEMENT_TAB_COPY: Record<GroupManagementTabId, Readonly<{ titleKey: string; descriptionKey: string }>> = {
    general: {
        titleKey: "groups.management.tabCopy.general.title",
        descriptionKey: "groups.management.tabCopy.general.description",
    },
    members: {
        titleKey: "groups.management.tabCopy.members.title",
        descriptionKey: "groups.management.tabCopy.members.description",
    },
    governance: {
        titleKey: "groups.management.tabCopy.governance.title",
        descriptionKey: "groups.management.tabCopy.governance.description",
    },
    settings: {
        titleKey: "groups.management.tabCopy.settings.title",
        descriptionKey: "groups.management.tabCopy.settings.description",
    },
};

export function formatParticipantLabel(count: number): string {
    return count === 1 ? "1 participant" : `${count} participants`;
}

/** Shared form controls — light default, dark via `html.dark`. */
export const mgmtFieldClass =
    "h-11 rounded-lg border border-zinc-300 bg-white text-zinc-900 shadow-none placeholder:text-zinc-500 focus-visible:border-violet-500 focus-visible:ring-2 focus-visible:ring-violet-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500";

export const mgmtTextareaClass =
    "min-h-[120px] resize-none rounded-lg border border-zinc-300 bg-white text-zinc-900 shadow-none placeholder:text-zinc-500 focus-visible:border-violet-500 focus-visible:ring-2 focus-visible:ring-violet-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500";

export const mgmtSectionClass =
    "rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900/50";

export const mgmtCompactSectionClass =
    "rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/50";
