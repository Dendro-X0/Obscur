"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import { Search, Globe, Users, Loader2, ArrowRight, Lock, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { Button } from "@dweb/ui-kit";
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@dweb/ui-kit";
import { Input } from "@dweb/ui-kit";
import { Card } from "@dweb/ui-kit";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { toast } from "@dweb/ui-kit";
import type { GroupConversation } from "@/app/features/messaging/types";
import { useGroups } from "../providers/group-provider";
import { cn } from "@dweb/ui-kit";
import { toGroupConversationId } from "../utils/group-conversation-id";
import { getPublicGroupHref } from "@/app/features/navigation/public-routes";

interface DiscoveredGroup {
    groupId: string;
    relayUrl: string;
    name?: string;
    about?: string;
    avatar?: string;
    access?: "open" | "invite-only" | "discoverable";
    memberCount?: number;
}

interface GroupDiscoveryProps {
    searchQuery?: string;
}

export function GroupDiscovery({ searchQuery = "" }: GroupDiscoveryProps) {
    const { t } = useTranslation();
    const router = useRouter();
    const { relayPool } = useRelay();
    const { addGroup, createdGroups } = useGroups();
    const [searchRelay, setSearchRelay] = useState("wss://relay.nostr.band");
    const [groups, setGroups] = useState<DiscoveredGroup[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 6;

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
                            const avatar = event.tags.find((t: string[]) => t[0] === "picture")?.[1];

                            const isPrivate = event.tags.some((t: string[]) => t[0] === "private");
                            const isClosed = event.tags.some((t: string[]) => t[0] === "closed");
                            const access = isClosed ? "invite-only" : isPrivate ? "invite-only" : "open";

                            setGroups(prev => {
                                if (prev.some(g => g.groupId === groupId && g.relayUrl === cleanUrl)) return prev;
                                return [...prev, { groupId, relayUrl: cleanUrl, name, about, avatar, access }];
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

    const totalPages = Math.ceil(filteredGroups.length / itemsPerPage);
    const paginatedGroups = useMemo(() => {
        return filteredGroups.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    }, [filteredGroups, currentPage, itemsPerPage]);

    // Reset page when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, searchRelay]);

    const handleJoin = (group: DiscoveredGroup) => {
        const newGroup: GroupConversation = {
            kind: 'group',
            id: toGroupConversationId({ groupId: group.groupId, relayUrl: group.relayUrl }),
            groupId: group.groupId,
            relayUrl: group.relayUrl,
            displayName: group.name || group.groupId,
            memberPubkeys: [],
            lastMessage: 'Joined via discovery',
            unreadCount: 0,
            lastMessageTime: new Date(),
            access: group.access || "open",
            memberCount: group.memberCount || 0,
            adminPubkeys: [], // Will be hydrated from relay
            avatar: group.avatar
        };
        addGroup(newGroup, { allowRevive: true });
        toast.success(t("groups.notifications.joined", { name: group.name || group.groupId }));
    };

    const handlePreview = (group: DiscoveredGroup): void => {
        const groupToken = toGroupConversationId({
            groupId: group.groupId,
            relayUrl: group.relayUrl,
        });
        router.push(getPublicGroupHref(groupToken, group.relayUrl));
    };

    return (
        <div className="flex flex-col h-full space-y-6 max-w-6xl mx-auto">
            {/* Header & Relay Control */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-1">
                <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                        Community Discovery
                    </h3>
                </div>

                <div className="flex items-center gap-2 p-1 bg-muted/80 backdrop-blur-md rounded-xl border border-border shadow-xl">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-transparent focus-within:border-primary/30 transition-all">
                        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                        <input
                            type="text"
                            value={searchRelay}
                            onChange={(e) => setSearchRelay(e.target.value)}
                            className="bg-transparent text-xs font-bold border-none focus:ring-0 p-0 w-44 text-foreground placeholder:text-muted-foreground/60"
                            placeholder="Relay URL..."
                            onKeyDown={(e) => e.key === 'Enter' && fetchGroups(searchRelay)}
                        />
                    </div>
                    <div className="w-px h-4 bg-border mx-1" />
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => fetchGroups(searchRelay)}
                        disabled={isLoading}
                        className="h-8 rounded-lg px-3 text-[10px] font-black uppercase tracking-widest hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground transition-all"
                    >
                        {isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
                        {t("common.refresh", "Refresh")}
                    </Button>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {paginatedGroups.map(group => {
                    const isJoined = createdGroups.some(g => g.groupId === group.groupId && g.relayUrl === group.relayUrl);

                    return (
                        <Card key={`${group.relayUrl}-${group.groupId}`} className="group relative overflow-hidden bg-card/40 backdrop-blur-xl border-border rounded-[32px] hover:border-primary/30 transition-all duration-500 shadow-sm">
                            <div className="p-6 flex flex-col items-center text-center space-y-4">
                                <div className="h-20 w-20 rounded-[28px] bg-muted flex items-center justify-center shadow-inner overflow-hidden ring-1 ring-border">
                                    {group.avatar ? (
                                        <Image
                                            src={group.avatar}
                                            alt={group.name || group.groupId}
                                            width={80}
                                            height={80}
                                            className="h-full w-full object-cover"
                                            unoptimized
                                        />
                                    ) : (
                                        <Users className="h-10 w-10 text-muted-foreground" />
                                    )}
                                </div>

                                <div className="space-y-1 w-full">
                                    <h3 className="font-black text-lg text-foreground truncate">
                                        {group.name || group.groupId}
                                    </h3>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground font-mono truncate">
                                        {group.groupId}@{new URL(group.relayUrl).hostname}
                                    </p>
                                </div>

                                <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">
                                    {group.about || t("groups.discovery.noDescription", "No description provided.")}
                                </p>

                                <Button
                                    onClick={() => handleJoin(group)}
                                    disabled={isJoined}
                                    className={cn(
                                        "w-full h-12 rounded-2xl font-black uppercase tracking-widest text-xs gap-2 shadow-xl transition-all",
                                        isJoined
                                            ? "bg-muted text-muted-foreground cursor-default"
                                            : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20"
                                    )}
                                >
                                    {isJoined ? (
                                        t("groups.status.member", "Member")
                                    ) : (
                                        <>
                                            {group.access === "invite-only" ? "Request Access" : t("groups.actions.joinCommunity", "Join Community")}
                                            <ArrowRight className="h-4 w-4" />
                                        </>
                                    )}
                                </Button>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => handlePreview(group)}
                                    className="h-10 w-full rounded-xl border border-border/70 bg-card/75 text-[11px] font-black uppercase tracking-widest text-foreground hover:bg-accent gap-2"
                                >
                                    <Eye className="h-3.5 w-3.5" />
                                    {t("groups.actions.previewCommunity", "Preview Community")}
                                </Button>
                                {group.access && group.access !== "open" && (
                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
                                        <Users className="h-3 w-3 text-amber-500" />
                                        <span className="text-[10px] font-bold text-amber-500 capitalize">
                                            {group.access === "invite-only" ? "Restricted" : "Listed"}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </Card>
                    );
                })}

                {paginatedGroups.length === 0 && !isLoading && (
                    <div className="col-span-full flex-1 flex flex-col items-center justify-center p-8 min-h-[45vh] text-center space-y-4">
                        <div className="h-20 w-20 rounded-[24px] bg-muted flex items-center justify-center border border-border/50 shadow-inner">
                            <Globe className="h-10 w-10 text-muted-foreground/30" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="font-bold text-foreground">{t("groups.discovery.noCommunities", "No communities found")}</h3>
                            <p className="text-sm text-muted-foreground max-w-xs">{t("groups.discovery.tryDifferentRelay", "Try searching on a different relay or check the relay URL.")}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="pt-4 pb-8">
                    <Pagination>
                        <PaginationContent>
                            <PaginationItem>
                                <PaginationPrevious
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className={currentPage === 1 ? "opacity-30 pointer-events-none" : "cursor-pointer"}
                                />
                            </PaginationItem>

                            {/* Page Numbers */}
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                                // Simple logic to show current, first, last and surrounding pages
                                if (
                                    page === 1 ||
                                    page === totalPages ||
                                    (page >= currentPage - 1 && page <= currentPage + 1)
                                ) {
                                    return (
                                        <PaginationItem key={page}>
                                            <PaginationLink
                                                onClick={() => setCurrentPage(page)}
                                                isActive={currentPage === page}
                                                className="cursor-pointer"
                                            >
                                                {page}
                                            </PaginationLink>
                                        </PaginationItem>
                                    );
                                }
                                if (page === currentPage - 2 || page === currentPage + 2) {
                                    return (
                                        <PaginationItem key={page}>
                                            <PaginationEllipsis />
                                        </PaginationItem>
                                    );
                                }
                                return null;
                            })}

                            <PaginationItem>
                                <PaginationNext
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className={currentPage === totalPages ? "opacity-30 pointer-events-none" : "cursor-pointer"}
                                />
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>
                </div>
            )}
        </div>
    );
}
