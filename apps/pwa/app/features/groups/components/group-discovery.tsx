"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import { Search, Globe, Users, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Card } from "@/app/components/ui/card";
import { useTranslation } from "react-i18next";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { toast } from "@/app/components/ui/toast";
import type { GroupConversation } from "@/app/features/messaging/types";
import { useGroups } from "../providers/group-provider";
import { cn } from "@/app/lib/cn";

interface DiscoveredGroup {
    groupId: string;
    relayUrl: string;
    name?: string;
    about?: string;
    picture?: string;
    memberCount?: number;
}

export function GroupDiscovery() {
    const { t } = useTranslation();
    const { relayPool } = useRelay();
    const { addGroup, createdGroups } = useGroups();
    const [searchRelay, setSearchRelay] = useState("wss://relay.nostr.band");
    const [groups, setGroups] = useState<DiscoveredGroup[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const fetchGroups = useCallback(async (relayUrl: string) => {
        setIsLoading(true);
        setGroups([]);
        try {
            const cleanUrl = relayUrl.startsWith("ws") ? relayUrl : `wss://${relayUrl}`;
            relayPool.addTransientRelay(cleanUrl);
            await relayPool.waitForConnection(3000);

            const subId = `discovery-${Math.random().toString(36).substring(7)}`;
            const filter = { kinds: [39000], limit: 50 };

            const cleanup = relayPool.subscribeToMessages(({ message }) => {
                try {
                    const parsed = JSON.parse(message);
                    if (parsed[0] === "EVENT" && parsed[1] === subId) {
                        const event = parsed[2];
                        if (event.kind === 39000) {
                            const groupId = event.tags.find((t: string[]) => t[0] === "d")?.[1];
                            if (!groupId) return;

                            const name = event.tags.find((t: string[]) => t[0] === "name")?.[1];
                            const about = event.tags.find((t: string[]) => t[0] === "about")?.[1];
                            const picture = event.tags.find((t: string[]) => t[0] === "picture")?.[1];

                            setGroups(prev => {
                                if (prev.some(g => g.groupId === groupId && g.relayUrl === cleanUrl)) return prev;
                                return [...prev, { groupId, relayUrl: cleanUrl, name, about, picture }];
                            });
                        }
                    }
                } catch (err) {
                    console.error("Discovery message parse failed:", err);
                }
            });

            relayPool.sendToOpen(JSON.stringify(["REQ", subId, filter]));

            // Set a timeout to stop loading and cleanup
            setTimeout(() => {
                cleanup();
                try { relayPool.sendToOpen(JSON.stringify(["CLOSE", subId])); } catch { }
                setIsLoading(false);
            }, 5000);

        } catch (error) {
            console.error("Discovery failed:", error);
            toast.error("Failed to connect to relay for discovery");
            setIsLoading(false);
        }
    }, [relayPool]);

    useEffect(() => {
        queueMicrotask(() => {
            fetchGroups(searchRelay);
        });
    }, [fetchGroups, searchRelay]);

    const filteredGroups = useMemo(() => {
        if (!searchQuery.trim()) return groups;
        const q = searchQuery.toLowerCase();
        return groups.filter(g =>
            g.name?.toLowerCase().includes(q) ||
            g.about?.toLowerCase().includes(q) ||
            g.groupId.toLowerCase().includes(q)
        );
    }, [groups, searchQuery]);

    const handleJoin = (group: DiscoveredGroup) => {
        const newGroup: GroupConversation = {
            kind: 'group',
            id: `group:${group.groupId}:${group.relayUrl}`,
            groupId: group.groupId,
            relayUrl: group.relayUrl,
            displayName: group.name || group.groupId,
            memberPubkeys: [],
            lastMessage: 'Joined via discovery',
            unreadCount: 0,
            lastMessageTime: new Date()
        };
        addGroup(newGroup);
        toast.success(t("groups.notifications.joined", { name: group.name || group.groupId }));
    };

    return (
        <div className="flex flex-col h-full space-y-6 max-w-5xl mx-auto px-4 sm:px-6">
            {/* Header & Search */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 group-focus-within:text-purple-500 transition-colors" />
                        <Input
                            placeholder={t("groups.discovery.searchPlaceholder", "Find communities by name, topic or ID...")}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-11 h-12 bg-white/50 dark:bg-zinc-900/50 border-black/5 dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-purple-500/20"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2 p-1.5 bg-zinc-100/50 dark:bg-zinc-900/50 rounded-2xl w-fit">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-black/5 dark:border-white/5">
                        <Globe className="h-4 w-4 text-zinc-400" />
                        <input
                            type="text"
                            value={searchRelay}
                            onChange={(e) => setSearchRelay(e.target.value)}
                            className="bg-transparent text-sm font-medium border-none focus:ring-0 p-0 w-48 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                            onKeyDown={(e) => e.key === 'Enter' && fetchGroups(searchRelay)}
                        />
                    </div>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => fetchGroups(searchRelay)}
                        disabled={isLoading}
                        className="rounded-xl px-4 hover:bg-white dark:hover:bg-zinc-800"
                    >
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("common.refresh", "Refresh")}
                    </Button>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredGroups.map(group => {
                    const isJoined = createdGroups.some(g => g.groupId === group.groupId && g.relayUrl === group.relayUrl);

                    return (
                        <Card key={`${group.relayUrl}-${group.groupId}`} className="group relative overflow-hidden bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl border-black/5 dark:border-white/5 rounded-[32px] hover:border-purple-500/30 transition-all duration-500">
                            <div className="p-6 flex flex-col items-center text-center space-y-4">
                                <div className="h-20 w-20 rounded-[28px] bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 flex items-center justify-center shadow-inner overflow-hidden ring-1 ring-black/5 dark:ring-white/5">
                                    {group.picture ? (
                                        <Image
                                            src={group.picture}
                                            alt={group.name || group.groupId}
                                            width={80}
                                            height={80}
                                            className="h-full w-full object-cover"
                                            unoptimized
                                        />
                                    ) : (
                                        <Users className="h-10 w-10 text-zinc-400" />
                                    )}
                                </div>

                                <div className="space-y-1 w-full">
                                    <h3 className="font-black text-lg text-zinc-900 dark:text-zinc-50 truncate">
                                        {group.name || group.groupId}
                                    </h3>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 font-mono truncate">
                                        {group.groupId}@{new URL(group.relayUrl).hostname}
                                    </p>
                                </div>

                                <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 min-h-[40px]">
                                    {group.about || t("groups.discovery.noDescription", "No description provided.")}
                                </p>

                                <Button
                                    onClick={() => handleJoin(group)}
                                    disabled={isJoined}
                                    className={cn(
                                        "w-full h-12 rounded-2xl font-black uppercase tracking-widest text-xs gap-2 shadow-xl transition-all",
                                        isJoined
                                            ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-default"
                                            : "bg-purple-600 hover:bg-purple-700 text-white shadow-purple-500/20"
                                    )}
                                >
                                    {isJoined ? (
                                        t("groups.status.member", "Member")
                                    ) : (
                                        <>
                                            {t("groups.actions.joinCommunity", "Join Community")}
                                            <ArrowRight className="h-4 w-4" />
                                        </>
                                    )}
                                </Button>
                            </div>
                        </Card>
                    );
                })}

                {filteredGroups.length === 0 && !isLoading && (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center space-y-4 text-center">
                        <div className="h-20 w-20 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
                            <Globe className="h-10 w-10 text-zinc-300" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{t("groups.discovery.noCommunities", "No communities found")}</h3>
                            <p className="text-sm text-zinc-500 max-w-xs">{t("groups.discovery.tryDifferentRelay", "Try searching on a different relay or check the relay URL.")}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
