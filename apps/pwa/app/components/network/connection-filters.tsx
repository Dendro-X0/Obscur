"use client";

import type React from "react";
import { Search, Filter, Users } from "lucide-react";
import { Input } from "../ui/input";
import { SelectField } from "../ui/select";
import type { ConnectionGroup, TrustLevel } from "@/app/features/invites/utils/types";

interface ConnectionFiltersProps {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    trustLevel: TrustLevel | "all";
    onTrustLevelChange: (level: TrustLevel | "all") => void;
    groupId: string | "all";
    onGroupChange: (id: string | "all") => void;
    groups: ConnectionGroup[];
}

import { useTranslation } from "react-i18next";

export const ConnectionFilters = ({
    searchQuery,
    onSearchChange,
    trustLevel,
    onTrustLevelChange,
    groupId,
    onGroupChange,
    groups
}: ConnectionFiltersProps) => {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col gap-4">
            {/* Search Input */}
            <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                    <Search className="h-4 w-4" />
                </div>
                <Input
                    type="text"
                    placeholder={t("network.searchPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="pl-10"
                />
            </div>

            {/* Filter Row */}
            <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[140px]">
                    <div className="flex items-center gap-2 mb-1">
                        <Filter className="h-3 w-3 text-zinc-400" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{t("invites.trustLevel")}</span>
                    </div>
                    <SelectField
                        value={trustLevel}
                        onValueChange={(value) => onTrustLevelChange(value as TrustLevel | "all")}
                        size="compact"
                        className="text-xs"
                        options={[
                            { value: "all", label: t("invites.trustFilter.all", "All Levels") },
                            { value: "trusted", label: t("invites.trustFilter.trusted", "Trusted Only") },
                            { value: "neutral", label: t("invites.trustFilter.neutral", "Neutral") },
                            { value: "blocked", label: t("invites.trustFilter.blocked", "Blocked") },
                        ]}
                    />
                </div>

                <div className="flex-1 min-w-[140px]">
                    <div className="flex items-center gap-2 mb-1">
                        <Users className="h-3 w-3 text-zinc-400" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Group</span>
                    </div>
                    <SelectField
                        value={groupId}
                        onValueChange={onGroupChange}
                        size="compact"
                        className="text-xs"
                        options={[
                            { value: "all", label: t("invites.groupFilter.all", "All Groups") },
                            ...groups.map((group) => ({ value: group.id, label: group.name })),
                        ]}
                    />
                </div>
            </div>
        </div>
    );
};
