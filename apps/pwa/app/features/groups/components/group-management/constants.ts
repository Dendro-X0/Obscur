import type { LucideIcon } from "lucide-react";
import { Scale, Shield, SlidersHorizontal, Users } from "lucide-react";

export type GroupManagementTabId = "general" | "members" | "governance" | "settings";

export const GROUP_MANAGEMENT_TABS: ReadonlyArray<{
    id: GroupManagementTabId;
    label: string;
    icon: LucideIcon;
}> = [
    { id: "general", label: "General", icon: SlidersHorizontal },
    { id: "members", label: "Participants", icon: Users },
    { id: "governance", label: "Governance", icon: Scale },
    { id: "settings", label: "Safety", icon: Shield },
] as const;

export const GROUP_MANAGEMENT_TAB_COPY: Record<GroupManagementTabId, Readonly<{ title: string; description: string }>> = {
    general: {
        title: "General",
        description: "Community name, avatar, description, and discovery settings.",
    },
    members: {
        title: "Participants",
        description: "Active members can chat. Left or expelled members stay listed as history until they rejoin or post in the room again.",
    },
    governance: {
        title: "Governance",
        description: "Open votes on renames and member removals.",
    },
    settings: {
        title: "Safety",
        description: "Notifications, backup, keys, and leaving the community.",
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
