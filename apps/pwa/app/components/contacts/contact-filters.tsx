"use client";

import type React from "react";
import { Search, Filter, Users } from "lucide-react";
import { Input } from "../ui/input";
import type { ContactGroup, TrustLevel } from "@/app/features/invites/utils/types";

interface ContactFiltersProps {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    trustLevel: TrustLevel | "all";
    onTrustLevelChange: (level: TrustLevel | "all") => void;
    groupId: string | "all";
    onGroupChange: (id: string | "all") => void;
    groups: ContactGroup[];
}

export const ContactFilters = ({
    searchQuery,
    onSearchChange,
    trustLevel,
    onTrustLevelChange,
    groupId,
    onGroupChange,
    groups
}: ContactFiltersProps) => {
    return (
        <div className="flex flex-col gap-4">
            {/* Search Input */}
            <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                    <Search className="h-4 w-4" />
                </div>
                <Input
                    type="text"
                    placeholder="Search contacts..."
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
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Trust Level</span>
                    </div>
                    <select
                        value={trustLevel}
                        onChange={(e) => onTrustLevelChange(e.target.value as TrustLevel | "all")}
                        className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs dark:border-white/10 dark:bg-zinc-900"
                    >
                        <option value="all">All Levels</option>
                        <option value="trusted">Trusted Only</option>
                        <option value="neutral">Neutral</option>
                        <option value="blocked">Blocked</option>
                    </select>
                </div>

                <div className="flex-1 min-w-[140px]">
                    <div className="flex items-center gap-2 mb-1">
                        <Users className="h-3 w-3 text-zinc-400" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Group</span>
                    </div>
                    <select
                        value={groupId}
                        onChange={(e) => onGroupChange(e.target.value)}
                        className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs dark:border-white/10 dark:bg-zinc-900"
                    >
                        <option value="all">All Groups</option>
                        {groups.map((group) => (
                            <option key={group.id} value={group.id}>
                                {group.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
};
