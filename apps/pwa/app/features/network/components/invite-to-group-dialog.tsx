"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { Users, Search, Loader2 } from "lucide-react";
import { Button } from "@dweb/ui-kit";
import { Card } from "@dweb/ui-kit";
import { Input } from "@dweb/ui-kit";
import { useGroups } from "@/app/features/groups/providers/group-provider";
import type { GroupConversation } from "@/app/features/messaging/types";
import { cn } from "@/app/lib/utils";

interface InviteToGroupDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onInvite: (group: GroupConversation) => void;
}

export function InviteToGroupDialog({ isOpen, onClose, onInvite }: InviteToGroupDialogProps) {
    const { t } = useTranslation();
    const { createdGroups } = useGroups();
    const [searchQuery, setSearchQuery] = React.useState("");

    const filteredGroups = React.useMemo(() => {
        return createdGroups.filter(g =>
            g.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            g.groupId.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [createdGroups, searchQuery]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <Card
                title={t("network.inviteTitle", "Invite to Group")}
                description={t("network.inviteDesc", "Select a group to invite this connection to.")}
                className="w-full max-w-md shadow-2xl border-white/10"
            >
                <div className="space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t("groups.searchPlaceholder", "Search groups...")}
                            className="pl-9 bg-zinc-50 dark:bg-zinc-900/50 border-black/5 dark:border-white/5 focus:bg-white dark:focus:bg-zinc-900 transition-all rounded-xl"
                        />
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                        {filteredGroups.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center bg-zinc-50 dark:bg-white/5 rounded-2xl border border-dashed border-zinc-200 dark:border-white/10">
                                <Users className="h-8 w-8 text-zinc-300 dark:text-zinc-700 mb-2" />
                                <p className="text-sm font-medium text-zinc-500">{t("groups.noGroupsFound", "No groups found")}</p>
                            </div>
                        ) : (
                            filteredGroups.map(group => (
                                <button
                                    key={group.id}
                                    onClick={() => onInvite(group)}
                                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors border border-transparent hover:border-black/5 dark:hover:border-white/5 group text-left"
                                >
                                    <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                        <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold text-zinc-900 dark:text-zinc-50 truncate">
                                            {group.displayName}
                                        </div>
                                        <div className="text-[10px] text-zinc-500 truncate font-mono opacity-60">
                                            {group.groupId}
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>

                    <div className="pt-2">
                        <Button
                            type="button"
                            variant="secondary"
                            className="w-full rounded-xl"
                            onClick={onClose}
                        >
                            {t("common.cancel")}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
