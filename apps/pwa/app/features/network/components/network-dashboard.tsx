"use client";

import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
    Users,
    UserPlus,
    MessageSquare,
    UserCheck,
    Ban,
    Search,
    PlusCircle,
    Check,
    X,
    Globe,
    Trash2,
    EyeOff,
    MailOpen,
    Clock,
    Settings,
} from "lucide-react";
import { useNetwork } from "../providers/network-provider";
import { useGroups } from "@/app/features/groups/providers/group-provider";
import { useMessaging } from "@/app/features/messaging/providers/messaging-provider";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { UserAvatar } from "@/app/features/profile/components/user-avatar";
import { Button } from "@dweb/ui-kit";
import { Input } from "@dweb/ui-kit";
import { Card } from "@dweb/ui-kit";
import { Avatar, AvatarFallback } from "@dweb/ui-kit";
import { cn } from "@dweb/ui-kit";
import { useRouter } from "next/navigation";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { RequestsInboxItem } from "@/app/features/messaging/types";
import { useProfileMetadata } from "@/app/features/profile/hooks/use-profile-metadata";
import { JoinGroupInputDialog } from "@/app/features/groups/components/join-group-input-dialog";
import { GroupJoinDialog } from "@/app/features/groups/components/group-join-dialog";
import { AddConnectionModal } from "./add-connection-modal";

import { ConnectionCard } from "./network-connection-card";
import { GroupCard } from "./group-card";
import { GroupDiscovery } from "@/app/features/groups/components/group-discovery";
import { Loader2 as LoaderIcon, QrCode, Scan, Download, Upload, User as UserIcon, Shield, Copy, CheckCircle2, ChevronRight } from "lucide-react";
import { parsePublicKeyInput } from "@/app/features/profile/utils/parse-public-key-input";
import { useInviteResolver } from "@/app/features/invites/utils/use-invite-resolver";
import { isValidInviteCode } from "@/app/features/invites/utils/invite-parser";
import { parseNip29GroupIdentifier } from "@/app/features/groups/utils/parse-nip29-group-identifier";
import Image from "next/image";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@dweb/ui-kit";
import { QRScanner } from "@/app/components/qr-scanner";
import { useToasts } from "@dweb/ui-kit";
import { ConnectionImportExport } from "@/app/components/invites/connection-import-export";

type TabId = "all" | "groups" | "discovery" | "invitations" | "blocked" | "manage";

export function NetworkDashboard() {
    const { t } = useTranslation();
    const { identity, peerTrust, requestsInbox, blocklist } = useNetwork();
    const { createdGroups, setIsNewGroupOpen } = useGroups();
    const {
        setIsNewChatOpen,
        createdConnections,
        hasHydrated,
    } = useMessaging();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<TabId>("all");
    const [viewMode, setViewMode] = useState<"list" | "grid">("list");
    const [searchQuery, setSearchQuery] = useState("");
    const [revealedByPubkey, setRevealedByPubkey] = useState<Readonly<Record<string, boolean>>>({});
    const [isAddConnectionOpen, setIsAddConnectionOpen] = useState(false);
    const { addToast } = useToasts();

    // Group Join State
    const [isJoinInputOpen, setIsJoinInputOpen] = useState(false);
    const [isJoinPreviewOpen, setIsJoinPreviewOpen] = useState(false);
    const [joinGroupId, setJoinGroupId] = useState("");
    const [joinRelayUrl, setJoinRelayUrl] = useState("");

    const publicKeyHex = (identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? null) as PublicKeyHex | null;
    const inviteResolver = useInviteResolver({ myPublicKeyHex: publicKeyHex });
    const { relayPool: pool } = useRelay();

    // Clear unread marks when switching to invitations tab
    React.useEffect(() => {
        if (activeTab === "invitations" && requestsInbox.state.items.some(i => i.unreadCount > 0)) {
            requestsInbox.markAllRead();
        }
    }, [activeTab, requestsInbox.markAllRead, requestsInbox.state.items]);

    const filteredRequests = useMemo(() => {
        return requestsInbox.state.items
            .filter(req => req.status === 'pending')
            .filter(req => (req.peerPublicKeyHex || "").toLowerCase().includes(searchQuery.toLowerCase()));
    }, [requestsInbox.state.items, searchQuery]);

    const filteredDeclined = useMemo(() => {
        return requestsInbox.state.items
            .filter(req => req.status === 'declined' || req.status === 'canceled')
            .filter(req => (req.peerPublicKeyHex || "").toLowerCase().includes(searchQuery.toLowerCase()));
    }, [requestsInbox.state.items, searchQuery]);

    const filteredBlocked = useMemo(() => {
        return blocklist.state.blockedPublicKeys.filter(pk =>
            (pk || "").toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [blocklist.state.blockedPublicKeys, searchQuery]);

    const filteredGroups = useMemo(() => {
        return createdGroups.filter(group => {
            const name = group.displayName || group.id || "";
            return name.toLowerCase().includes(searchQuery.toLowerCase());
        });
    }, [createdGroups, searchQuery]);

    const filteredAcceptedPeers = useMemo(() => {
        return peerTrust.state.acceptedPeers.filter(pk => {
            const connection = createdConnections.find(c => c.kind === 'dm' && c.pubkey === pk);
            const searchStr = (connection?.displayName || pk).toLowerCase();
            return searchStr.includes(searchQuery.toLowerCase());
        });
    }, [peerTrust.state.acceptedPeers, createdConnections, searchQuery]);

    const tabs: { id: TabId, label: string, icon: any, badge?: number }[] = [
        { id: "all", label: t("network.tabs.all"), icon: UserCheck, badge: filteredAcceptedPeers.length },
        { id: "groups", label: t("network.tabs.groups"), icon: Users, badge: filteredGroups.length },
        { id: "discovery", label: "Discovery", icon: Globe },
        { id: "invitations", label: t("network.tabs.invitations"), icon: MailOpen, badge: requestsInbox.state.items.filter(i => i.unreadCount > 0).length },
        { id: "blocked", label: t("network.tabs.blocked"), icon: Ban },
        { id: "manage", label: "Manage", icon: Settings },
    ];

    const handleGlobalSearch = async () => {
        const trimmedQuery = searchQuery.trim();
        if (!trimmedQuery) return;

        // Check for exact pubkey
        const parsed = parsePublicKeyInput(trimmedQuery);
        if (parsed.ok) {
            router.push(`/network/${parsed.publicKeyHex}`);
            return;
        }

        // Check for group identifier (only if specifically formatted as host'id)
        if (trimmedQuery.includes("'")) {
            const parsedGroup = parseNip29GroupIdentifier(trimmedQuery);
            if (parsedGroup.ok) {
                router.push(`/groups/${encodeURIComponent(parsedGroup.identifier)}`);
                return;
            }
        }

        // Redirect to the new dedicated search page for everything else
        router.push(`/search?q=${encodeURIComponent(trimmedQuery)}`);
    };

    const renderEmptyState = (title: string, description: string, icon: React.ElementType, action?: { label: string, onClick: () => void }) => (
        <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-[45vh] text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[24px] bg-muted border border-border shadow-inner">
                {React.createElement(icon, { className: "h-10 w-10 text-muted-foreground" })}
            </div>
            <h3 className="text-xl font-black text-foreground">{title}</h3>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground leading-relaxed">{description}</p>
            {action && (
                <Button
                    className="mt-8 gap-2 h-11 px-6 rounded-2xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 font-bold transition-all hover:scale-105 active:scale-95 text-primary-foreground"
                    onClick={action.onClick}
                >
                    <PlusCircle className="h-5 w-5" />
                    {action.label}
                </Button>
            )}
        </div>
    );

    return (
        <div className="w-full flex flex-col min-h-full">
            {/* Top Action Header - Premium Glassmorphism */}
            <div className="sticky top-0 z-20 bg-background/60 backdrop-blur-2xl border-b border-border px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xl shadow-black/5 dark:shadow-black/50">
                {/* Search Bar & View Toggle Group */}
                <div className="flex items-center gap-3 w-full sm:max-w-xl">
                    <div className="relative group w-full">
                        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder={t("network.searchPlaceholder")}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleGlobalSearch();
                            }}
                            className="pl-10 h-10 bg-muted/30 border-input text-foreground rounded-xl text-sm font-medium transition-all focus:ring-primary/30 focus:border-primary/30 w-full"
                        />

                    </div>

                    {/* View Toggle - Integrated next to search */}
                    <div className="flex items-center bg-muted/50 rounded-xl p-0.5 border border-border shrink-0 ml-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewMode("list")}
                            className={cn("h-8 w-8 rounded-lg transition-all", viewMode === "list" ? "bg-background/80 text-foreground shadow-sm border border-border/50" : "text-muted-foreground hover:text-foreground")}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewMode("grid")}
                            className={cn("h-8 w-8 rounded-lg transition-all", viewMode === "grid" ? "bg-background/80 text-foreground shadow-sm border border-border/50" : "text-muted-foreground hover:text-foreground")}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                        </Button>
                    </div>

                    {/* Global Search Results Popup - Removed, handled by /search page */}
                </div>

                {/* Compact Action Buttons */}
                <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto py-4 px-2 scrollbar-none shrink-0">
                    <Button
                        onClick={() => setIsAddConnectionOpen(true)}
                        size="sm"
                        className="h-10 px-5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 transition-all text-sm shrink-0"
                    >
                        <PlusCircle className="h-4 w-4 mr-2" />
                        <span>{t("network.addConnection", "Add Connection")}</span>
                    </Button>
                    <Button
                        onClick={() => setIsNewGroupOpen(true)}
                        size="sm"
                        className="h-10 px-4 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-bold border border-border transition-all text-sm shrink-0"
                    >
                        <Users className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">{t("groups.createButton")}</span>
                        <span className="sm:hidden">Group</span>
                    </Button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row flex-1 relative">
                {/* Left Sidebar Menu */}
                <div className="w-full lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-border bg-background lg:h-[calc(100vh-60px)] lg:sticky top-[60px] z-10 p-4 flex flex-row lg:flex-col gap-1 overflow-x-auto scrollbar-none">
                    <div className="hidden lg:block mb-8 px-3">
                        <div className="flex items-center gap-2 mb-1.5 opacity-80">
                            <div className="h-1 w-1 rounded-full bg-primary shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
                            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{t("network.directory", "Directory")}</h2>
                        </div>
                    </div>
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabId)}
                            className={cn(
                                "flex-shrink-0 lg:w-full relative flex items-center gap-3 h-10 px-4 rounded-xl text-xs font-bold transition-all duration-300",
                                activeTab === tab.id
                                    ? "bg-gradient-primary text-white shadow-lg shadow-primary/25 scale-[1.02] border-none active:scale-[0.98]"
                                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                            )}
                        >
                            <tab.icon className={cn("h-4 w-4 shrink-0", activeTab === tab.id ? "text-white" : "opacity-60")} />
                            <span className="whitespace-nowrap">{tab.label}</span>
                            {tab.badge ? (
                                <span className="ml-1.5 h-4 w-4 flex items-center justify-center rounded-full bg-rose-500/20 text-rose-500 text-[9px] font-black">
                                    {tab.badge}
                                </span>
                            ) : null}
                        </button>
                    ))}
                </div>

                {/* Main Content Pane */}
                <div className="flex-1 min-w-0 p-3 sm:p-6 lg:p-8 xl:px-12 pb-24 lg:pb-8 flex flex-col">
                    {activeTab === "all" && (
                        <div className="space-y-12 animate-in fade-in duration-700 flex-1 flex flex-col">
                            {/* Accepted Contacts Grid */}
                            <div className="space-y-6">
                                <div className="flex items-center justify-between px-2">
                                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground/80">
                                        {t("network.accepted", "Connections")}
                                    </h3>
                                    <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                        {filteredAcceptedPeers.length}
                                    </span>
                                </div>

                                {(!hasHydrated || !peerTrust.hasHydrated || !requestsInbox.hasHydrated) ? (
                                    <div className="flex-1 flex items-center justify-center p-12 min-h-[40vh]">
                                        <LoaderIcon className="h-8 w-8 animate-pulse text-primary/50" />
                                    </div>
                                ) : filteredAcceptedPeers.length === 0 ? (
                                    renderEmptyState(
                                        t("network.noConnectionsFound"),
                                        t("network.noConnectionsDesc"),
                                        UserCheck,
                                        { label: t("network.findPeople"), onClick: () => setIsNewChatOpen(true) }
                                    )
                                ) : (
                                    <div className={viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "flex flex-col"}>
                                        {filteredAcceptedPeers.map(pk => {
                                            const connection = createdConnections.find(c => c.kind === 'dm' && c.pubkey === pk);
                                            return (
                                                <ConnectionCard
                                                    key={pk}
                                                    pubkey={pk}
                                                    displayName={connection?.displayName}
                                                    onClick={() => router.push(`/network/${pk}`)}
                                                    viewMode={viewMode}
                                                />
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Recent Requests: Compact List */}
                            {requestsInbox.state.items.filter(r => r.status === 'pending').length > 0 && (
                                <div className="space-y-6">
                                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-amber-500 px-2 opacity-60">
                                        {t("network.pending", "Pending Invitations")}
                                    </h3>
                                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                                        {requestsInbox.state.items.filter(r => r.status === 'pending').map(req => (
                                            <PendingRequestCard
                                                key={req.peerPublicKeyHex}
                                                req={req}
                                                onAccept={() => {
                                                    peerTrust.acceptPeer({ publicKeyHex: req.peerPublicKeyHex as PublicKeyHex });
                                                    requestsInbox.setStatus({ peerPublicKeyHex: req.peerPublicKeyHex as PublicKeyHex, status: 'accepted' });
                                                }}
                                                onBlock={() => {
                                                    blocklist.addBlocked({ publicKeyInput: req.peerPublicKeyHex });
                                                    requestsInbox.setStatus({ peerPublicKeyHex: req.peerPublicKeyHex as PublicKeyHex, status: 'declined' });
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Recent Communities Section */}
                            {filteredGroups.length > 0 && (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between px-2">
                                        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-400/80">
                                            {t("messaging.communities", "Communities")}
                                        </h3>
                                        <Button
                                            variant="ghost"
                                            onClick={() => setActiveTab("groups")}
                                            className="text-[10px] font-black uppercase tracking-widest text-indigo-400 p-0 hover:bg-transparent hover:text-indigo-300"
                                        >
                                            {t("common.viewAll", "View All")}
                                        </Button>
                                    </div>
                                    <div className={viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "flex flex-col"}>
                                        {filteredGroups.slice(0, 4).map(group => (
                                            <GroupCard
                                                key={group.id}
                                                id={group.id}
                                                displayName={group.displayName}
                                                relayUrl={group.relayUrl}
                                                memberCount={group.memberCount}
                                                avatar={group.avatar}
                                                onClick={() => {
                                                    router.push(`/groups/${encodeURIComponent(group.id)}`);
                                                }}
                                                viewMode={viewMode}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "groups" && (
                        <div className="animate-in fade-in duration-700 flex-1 flex flex-col">
                            {filteredGroups.length === 0 ? (
                                renderEmptyState(
                                    t("network.noGroupsFound"),
                                    t("network.noGroupsDesc"),
                                    Users,
                                    { label: t("messaging.newGroup"), onClick: () => setIsNewGroupOpen(true) }
                                )
                            ) : (
                                <div className={viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "flex flex-col"}>
                                    {filteredGroups.map(group => (
                                        <GroupCard
                                            key={group.id}
                                            id={group.id}
                                            displayName={group.displayName}
                                            relayUrl={group.relayUrl}
                                            memberCount={group.memberCount}
                                            avatar={group.avatar}
                                            onClick={() => {
                                                router.push(`/groups/${encodeURIComponent(group.id)}`);
                                            }}
                                            viewMode={viewMode}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "discovery" && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 h-full flex-1 flex flex-col">
                            <GroupDiscovery searchQuery={searchQuery} />
                        </div>
                    )}

                    {activeTab === "invitations" && (
                        <div className="space-y-10 max-w-3xl mx-auto w-full animate-in fade-in duration-700 flex-1 flex flex-col">
                            {filteredRequests.length === 0 && filteredDeclined.length === 0 ? (
                                renderEmptyState(
                                    t("network.noRequestsFound"),
                                    t("network.noRequestsDesc"),
                                    MessageSquare
                                )
                            ) : (
                                <>
                                    {filteredRequests.length > 0 && (
                                        <div className="space-y-4">
                                            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground px-6">
                                                {t("network.pending", "Pending Invitations")}
                                            </h3>
                                            <div className="space-y-4">
                                                {filteredRequests.map(req => (
                                                    <InvitationCard
                                                        key={req.peerPublicKeyHex}
                                                        req={req}
                                                        isRevealed={!!revealedByPubkey[req.peerPublicKeyHex]}
                                                        onReveal={() => setRevealedByPubkey(prev => ({ ...prev, [req.peerPublicKeyHex]: true }))}
                                                        onAccept={() => {
                                                            peerTrust.acceptPeer({ publicKeyHex: req.peerPublicKeyHex as PublicKeyHex });
                                                            requestsInbox.setStatus({ peerPublicKeyHex: req.peerPublicKeyHex as PublicKeyHex, status: 'accepted' });
                                                        }}
                                                        onBlock={() => {
                                                            blocklist.addBlocked({ publicKeyInput: req.peerPublicKeyHex });
                                                            requestsInbox.setStatus({ peerPublicKeyHex: req.peerPublicKeyHex as PublicKeyHex, status: 'declined' });
                                                        }}
                                                        onMute={() => {
                                                            peerTrust.mutePeer({ publicKeyHex: req.peerPublicKeyHex as PublicKeyHex });
                                                            requestsInbox.setStatus({ peerPublicKeyHex: req.peerPublicKeyHex as PublicKeyHex, status: 'declined' });
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {filteredDeclined.length > 0 && (
                                        <div className="space-y-4 opacity-60 hover:opacity-100 transition-opacity">
                                            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground px-6">
                                                {t("network.archived", "Archived / Declined")}
                                            </h3>
                                            <div className="space-y-2">
                                                {filteredDeclined.map(req => (
                                                    <DeclinedRequestRow
                                                        key={req.peerPublicKeyHex}
                                                        req={req}
                                                        onRestore={(pk: PublicKeyHex) => requestsInbox.setStatus({ peerPublicKeyHex: pk, status: 'pending' })}
                                                        onRemove={(pk: PublicKeyHex) => requestsInbox.remove({ peerPublicKeyHex: pk })}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === "blocked" && (
                        <div className="max-w-3xl mx-auto w-full animate-in fade-in duration-700 flex-1 flex flex-col">
                            {filteredBlocked.length === 0 ? (
                                renderEmptyState(
                                    t("network.noBlockedFound"),
                                    t("network.noBlockedDesc"),
                                    Ban
                                )
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {filteredBlocked.map(pk => (
                                        <div key={pk} className="group relative flex flex-col items-center p-6 bg-red-500/[0.02] backdrop-blur-xl border border-red-500/10 rounded-[32px] transition-all duration-300 hover:border-red-500/30 shadow-sm">
                                            <div className="relative mb-4">
                                                <Avatar className="h-20 w-20 rounded-[24px] bg-red-500/10 border-2 border-background shadow-inner">
                                                    <AvatarFallback className="bg-transparent">
                                                        <Ban className="h-10 w-10 text-red-500/50" />
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-red-500 border-4 border-background flex items-center justify-center">
                                                    <EyeOff className="h-3 w-3 text-white" />
                                                </div>
                                            </div>

                                            <div className="text-center w-full space-y-1 mb-6">
                                                <h4 className="font-black text-sm text-foreground truncate w-full px-4">
                                                    {pk.slice(0, 12)}...{pk.slice(-12)}
                                                </h4>
                                                <p className="text-[10px] text-red-500/60 font-black uppercase tracking-widest">
                                                    {t("contacts.status.blocked", "Blocked")}
                                                </p>
                                            </div>

                                            <Button
                                                variant="secondary"
                                                className="w-full h-11 rounded-xl font-bold bg-white/50 dark:bg-zinc-800/50 hover:bg-red-500 hover:text-white border-zinc-200 dark:border-white/5 transition-all text-xs"
                                                onClick={() => blocklist.removeBlocked({ publicKeyHex: pk as PublicKeyHex })}
                                            >
                                                {t("contacts.actions.unblock", "Unblock")}
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "manage" && (
                        <div className="max-w-3xl w-full animate-in fade-in duration-700 pb-10">
                            <div className="mb-6 px-2">
                                <h3 className="text-xl font-black text-foreground">{t("network.settingsTitle", "Network Settings")}</h3>
                                <p className="text-sm text-muted-foreground mt-1">Manage your connections, import backups, and configure trust.</p>
                            </div>

                            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                                {/* Row 1: My Passport */}
                                <div className="flex items-center justify-between p-4 border-b border-border hover:bg-accent/50 transition-colors group">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                                            <QrCode className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-foreground text-sm">{t("network.myPassport", "My Passport")}</h4>
                                            <p className="text-xs text-muted-foreground">View your QR code to connect instantly.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            onClick={() => setIsAddConnectionOpen(true)}
                                            className="h-8 px-4 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-bold"
                                        >
                                            Show Code
                                        </Button>
                                    </div>
                                </div>

                                {/* Row 2: Scan QR */}
                                <div className="flex items-center justify-between p-4 border-b border-border hover:bg-accent/50 transition-colors group">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
                                            <Scan className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-foreground text-sm">Scan Code</h4>
                                            <p className="text-xs text-muted-foreground">Scan someone else's passport to connect.</p>
                                        </div>
                                    </div>
                                    <Button size="sm" variant="outline" onClick={() => setIsAddConnectionOpen(true)} className="h-8 px-4 rounded-lg border-border hover:bg-primary/5 font-bold">
                                        Scan QR
                                    </Button>
                                </div>

                                {/* Row 3: Import Contacts */}
                                <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => setIsAddConnectionOpen(true)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') setIsAddConnectionOpen(true); }}
                                    className="flex items-center justify-between p-4 border-b border-border hover:bg-accent/50 cursor-pointer transition-colors group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-pink-500/10 text-pink-400">
                                            <Upload className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-foreground text-sm">Import Connections</h4>
                                            <p className="text-xs text-muted-foreground">Restore your social graph (NIP-02).</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                                </div>

                                {/* Row 4: Export Backup */}
                                <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => setIsAddConnectionOpen(true)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') setIsAddConnectionOpen(true); }}
                                    className="flex items-center justify-between p-4 border-b border-border hover:bg-accent/50 cursor-pointer transition-colors group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                                            <Download className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-foreground text-sm">Export Backup</h4>
                                            <p className="text-xs text-muted-foreground">Save your contacts locally (JSON).</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                                </div>

                                {/* Row 5: Trust Settings */}
                                <div className="flex items-center justify-between p-4 hover:bg-accent/50 cursor-pointer transition-colors group">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                                            <Shield className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-foreground text-sm">Trust & Verification</h4>
                                            <p className="text-xs text-muted-foreground">Manage Web of Trust rules.</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                                </div>
                            </div>

                            <div className="mt-4 px-2">
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Manage your decentralized social graph. Import following lists from other relays or export your local connections to take them with you.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Background Spotlights for Premium Look */}
            <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
                <div className="absolute top-[10%] left-[15%] w-[40%] h-[40%] bg-purple-500/5 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[20%] right-[10%] w-[30%] h-[30%] bg-indigo-500/5 blur-[120px] rounded-full delay-700" />
            </div>

            <JoinGroupInputDialog
                open={isJoinInputOpen}
                onOpenChange={setIsJoinInputOpen}
                onJoin={(groupId, relayUrl) => {
                    setJoinGroupId(groupId);
                    setJoinRelayUrl(relayUrl);
                    setIsJoinPreviewOpen(true);
                }}
            />

            <GroupJoinDialog
                open={isJoinPreviewOpen}
                onOpenChange={setIsJoinPreviewOpen}
                groupId={joinGroupId}
                relayUrl={joinRelayUrl}
                onSuccess={() => { }}
            />

            {isAddConnectionOpen && (
                <AddConnectionModal
                    open={isAddConnectionOpen}
                    onOpenChange={setIsAddConnectionOpen}
                />
            )}


        </div >
    );
}

function MyPassportDialog({ open, onOpenChange, qrDataUrl, pubkey }: { open: boolean, onOpenChange: (open: boolean) => void, qrDataUrl: string, pubkey: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(pubkey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-popover border-border rounded-[40px] p-0 overflow-hidden shadow-2xl">
                <div className="bg-gradient-to-br from-primary to-indigo-600/90 p-10 flex flex-col items-center text-center gap-6">
                    <div className="bg-white p-4 rounded-[32px] shadow-2xl ring-8 ring-white/10">
                        {qrDataUrl && <img src={qrDataUrl} alt="QR Code" className="w-48 h-48" />}
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-black text-white">Your Identity</h2>
                        <p className="text-white/60 text-xs font-bold uppercase tracking-widest">Secure Decentralized Passport</p>
                    </div>
                </div>
                <div className="p-8 space-y-6">
                    <div className="bg-muted border border-border rounded-2xl p-4 flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1">Public Key</p>
                            <p className="text-xs font-mono text-foreground truncate">{pubkey}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={handleCopy} className="text-muted-foreground hover:text-foreground">
                            {copied ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Copy className="h-5 w-5" />}
                        </Button>
                    </div>
                    <Button onClick={() => onOpenChange(false)} className="w-full h-14 rounded-2xl bg-secondary hover:bg-secondary/80 text-foreground font-black">
                        Done
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function PendingRequestCard({
    req,
    onAccept,
    onBlock,
}: {
    req: RequestsInboxItem;
    onAccept: () => void;
    onBlock: () => void;
}) {
    const { t } = useTranslation();
    const metadata = useProfileMetadata(req.peerPublicKeyHex);
    const displayName = metadata?.displayName || `${req.peerPublicKeyHex.slice(0, 8)}...`;

    return (
        <Card className="p-4 border-amber-500/10 bg-amber-500/5 backdrop-blur-sm rounded-[24px]">
            <div className="flex items-center gap-4">
                <UserAvatar pubkey={req.peerPublicKeyHex} size="sm" className="rounded-xl border-2 border-amber-500/20" />
                <div className="flex-1 overflow-hidden">
                    <h4 className="font-bold text-sm truncate text-foreground">{displayName}</h4>
                    <p className="text-[10px] text-amber-600/80 font-black uppercase tracking-tighter">
                        {t("network.pendingRequest", "Incoming Request")}
                    </p>
                </div>
                <div className="flex gap-2">
                    {req.isOutgoing ? (
                        <div className="flex items-center gap-1.5 bg-muted border border-border px-4 py-2 rounded-xl">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                {t("network.sent", "Sent")}
                            </span>
                        </div>
                    ) : (
                        <>
                            <Button
                                size="sm"
                                className="h-9 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl"
                                onClick={onAccept}
                            >
                                {t("common.accept")}
                            </Button>
                            <Button
                                size="sm"
                                variant="secondary"
                                className="h-9 px-4 text-muted-foreground hover:text-red-500 hover:bg-red-500/5 font-black rounded-xl border-border"
                                onClick={onBlock}
                            >
                                {t("common.block", "Block")}
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </Card>
    );
}

function InvitationCard({ req, isRevealed, onReveal, onAccept, onBlock, onMute }: {
    req: RequestsInboxItem,
    isRevealed: boolean,
    onReveal: () => void,
    onAccept: () => void,
    onBlock: () => void,
    onMute: () => void
}) {
    const { t } = useTranslation();
    const metadata = useProfileMetadata(req.peerPublicKeyHex);
    const displayName = metadata?.displayName || `${req.peerPublicKeyHex.slice(0, 10)}...`;

    return (
        <Card className="p-6 border-border bg-card/40 backdrop-blur-xl rounded-[32px] hover:border-primary/40 transition-all duration-500 group relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative shrink-0">
                    <UserAvatar pubkey={req.peerPublicKeyHex} size="lg" className="rounded-[24px] border-2 border-background shadow-inner" />
                    {req.unreadCount > 0 && (
                        <div className="absolute -top-3 -right-3">
                            <span className="flex items-center gap-1.5 bg-primary text-primary-foreground text-[10px] font-black px-4 py-1.5 rounded-full shadow-lg shadow-primary/40 uppercase tracking-widest ring-4 ring-background">
                                New
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex-1 text-center sm:text-left min-w-0">
                    <h4 className="font-black text-xl text-foreground truncate mb-1">
                        {displayName}
                    </h4>
                    <div className="flex flex-col gap-2">
                        {isRevealed ? (
                            <div className="inline-flex items-center gap-2 p-2 px-4 rounded-full bg-muted border border-border">
                                <p className="text-xs text-muted-foreground italic font-medium truncate max-w-xs">
                                    &quot;{req.lastMessagePreview || t("messaging.noMessagesYet")}&quot;
                                </p>
                            </div>
                        ) : (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onReveal}
                                className="w-fit text-[10px] font-black uppercase tracking-widest text-primary bg-primary/5 hover:bg-primary/10 px-4 rounded-full"
                            >
                                <EyeOff className="h-3 w-3 mr-2" />
                                Reveal Message
                            </Button>
                        )}
                    </div>
                </div>

                <div className="flex gap-3 shrink-0">
                    {req.isOutgoing ? (
                        <div className="flex items-center gap-2 px-6 h-14 rounded-[20px] bg-muted border border-border">
                            <Clock className="h-5 w-5 text-muted-foreground" />
                            <span className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                                {t("network.pendingConfirmation", "Pending Confirmation")}
                            </span>
                        </div>
                    ) : (
                        <>
                            <Button
                                size="lg"
                                className="h-14 px-8 bg-emerald-500 hover:bg-emerald-600 text-white shadow-xl shadow-emerald-500/30 border-none text-sm font-black rounded-[20px] transition-all"
                                onClick={onAccept}
                            >
                                <Check className="mr-2 h-6 w-6" />
                                {t("common.accept")}
                            </Button>
                            <Button
                                size="icon"
                                variant="secondary"
                                className="h-14 w-14 bg-secondary/50 text-muted-foreground hover:text-amber-500 hover:bg-amber-500/5 rounded-[20px] border-border transition-all"
                                onClick={onMute}
                                title="Mute"
                            >
                                <Clock className="h-7 w-7" />
                            </Button>
                            <Button
                                size="icon"
                                variant="secondary"
                                className="h-14 w-14 bg-secondary/50 text-muted-foreground hover:text-red-500 hover:bg-red-500/5 rounded-[20px] border-border transition-all"
                                onClick={onBlock}
                                title="Block"
                            >
                                <X className="h-7 w-7" />
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </Card>
    );
}
function DeclinedRequestRow({ req, onRestore, onRemove }: { req: RequestsInboxItem, onRestore: (pk: PublicKeyHex) => void, onRemove: (pk: PublicKeyHex) => void }) {
    const { t } = useTranslation();
    const metadata = useProfileMetadata(req.peerPublicKeyHex);
    const displayName = metadata?.displayName || `${req.peerPublicKeyHex.slice(0, 8)}...${req.peerPublicKeyHex.slice(-8)}`;

    return (
        <div key={req.peerPublicKeyHex} className="flex items-center justify-between p-4 bg-muted/30 border border-border rounded-[24px]">
            <div className="flex items-center gap-3">
                <UserAvatar
                    pubkey={req.peerPublicKeyHex}
                    size="sm"
                    className="opacity-50"
                />
                <div>
                    <p className="text-sm font-bold text-muted-foreground">{displayName}</p>
                    <p className="text-[10px] uppercase font-black tracking-tighter text-muted-foreground/60">{req.status}</p>
                </div>
            </div>
            <div className="flex gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs font-bold text-primary hover:bg-primary/10 px-4 rounded-xl"
                    onClick={() => onRestore(req.peerPublicKeyHex)}
                >
                    {t("common.restore", "Restore")}
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-red-500 p-2"
                    onClick={() => onRemove(req.peerPublicKeyHex)}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
