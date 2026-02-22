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
    MailOpen
} from "lucide-react";
import { useContacts } from "../providers/contacts-provider";
import { useGroups } from "@/app/features/groups/providers/group-provider";
import { useMessaging } from "@/app/features/messaging/providers/messaging-provider";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { UserAvatar } from "@/app/features/profile/components/user-avatar";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Card } from "@/app/components/ui/card";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import { cn } from "@/app/lib/cn";
import { useRouter } from "next/navigation";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { RequestsInboxItem } from "@/app/features/messaging/types";
import { useProfileMetadata } from "@/app/features/profile/hooks/use-profile-metadata";
import { JoinGroupInputDialog } from "@/app/features/groups/components/join-group-input-dialog";
import { GroupJoinDialog } from "@/app/features/groups/components/group-join-dialog";

import { ContactCard } from "./contact-card";
import { GroupCard } from "./group-card";
import { GroupDiscovery } from "@/app/features/groups/components/group-discovery";

type TabId = "all" | "groups" | "discovery" | "invitations" | "blocked";

export const ContactsDashboard = () => {
    const { t } = useTranslation();
    const { peerTrust, requestsInbox, blocklist } = useContacts();
    const { createdGroups, setIsNewGroupOpen } = useGroups();
    const {
        setIsNewChatOpen,
        createdContacts,
        hasHydrated,
    } = useMessaging();
    useRelay();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<TabId>("all");
    const [searchQuery, setSearchQuery] = useState("");

    // Group Join State
    const [isJoinInputOpen, setIsJoinInputOpen] = useState(false);
    const [isJoinPreviewOpen, setIsJoinPreviewOpen] = useState(false);
    const [joinGroupId, setJoinGroupId] = useState("");
    const [joinRelayUrl, setJoinRelayUrl] = useState("");

    const tabs: { id: TabId, label: string, icon: any, badge?: number }[] = [
        { id: "all", label: t("contacts.tabs.all"), icon: UserCheck },
        { id: "groups", label: t("contacts.tabs.groups"), icon: Users },
        { id: "discovery", label: "Discovery", icon: Globe },
        { id: "invitations", label: t("contacts.tabs.invitations"), icon: MailOpen, badge: requestsInbox.state.items.filter(i => i.status === 'pending' || !i.status).length },
        { id: "blocked", label: t("contacts.tabs.blocked"), icon: Ban },
    ];

    const filteredRequests = useMemo(() => {
        return requestsInbox.state.items
            .filter(req => req.status === 'pending')
            .filter(req => req.peerPublicKeyHex.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [requestsInbox.state.items, searchQuery]);

    const filteredDeclined = useMemo(() => {
        return requestsInbox.state.items
            .filter(req => req.status === 'declined' || req.status === 'canceled')
            .filter(req => req.peerPublicKeyHex.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [requestsInbox.state.items, searchQuery]);

    const filteredBlocked = useMemo(() => {
        return blocklist.state.blockedPublicKeys.filter(pk =>
            pk.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [blocklist.state.blockedPublicKeys, searchQuery]);

    const filteredGroups = useMemo(() => {
        return createdGroups.filter(group =>
            group.displayName.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [createdGroups, searchQuery]);

    const filteredAcceptedPeers = useMemo(() => {
        return peerTrust.state.acceptedPeers.filter(pk => {
            const contact = createdContacts.find(c => c.kind === 'dm' && c.pubkey === pk);
            const searchStr = (contact?.displayName || pk).toLowerCase();
            return searchStr.includes(searchQuery.toLowerCase());
        });
    }, [peerTrust.state.acceptedPeers, createdContacts, searchQuery]);

    const renderEmptyState = (title: string, description: string, icon: React.ElementType, action?: { label: string, onClick: () => void }) => (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[24px] bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-inner">
                {React.createElement(icon, { className: "h-10 w-10 text-zinc-400" })}
            </div>
            <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-50">{title}</h3>
            <p className="mt-2 max-w-xs text-sm text-zinc-500 leading-relaxed">{description}</p>
            {action && (
                <Button
                    className="mt-8 gap-2 h-11 px-6 rounded-2xl bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-500/20 font-bold transition-all hover:scale-105 active:scale-95"
                    onClick={action.onClick}
                >
                    <PlusCircle className="h-5 w-5" />
                    {action.label}
                </Button>
            )}
        </div>
    );

    return (
        <div className="mx-auto max-w-7xl w-full flex flex-col gap-10 pb-20 px-6">
            {/* Redesigned Header: Symmetrical & Centered */}
            <div className="flex flex-col items-center gap-10 pt-10">
                <div className="text-center space-y-3">
                    <h1 className="text-5xl font-black tracking-tighter text-white">
                        {t("contacts.title", "Network")}
                    </h1>
                    <p className="text-zinc-500 font-bold uppercase tracking-[0.2em] text-[10px]">
                        {t("contacts.subtitle", "Secure Connections & Decentralized Groups")}
                    </p>
                </div>

                <div className="w-full max-w-2xl flex flex-col gap-8">
                    {/* Search Bar: Centered Deep Dark */}
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-purple-500/20 to-indigo-500/20 rounded-[32px] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
                        <Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-600 group-focus-within:text-purple-400 transition-colors" />
                        <Input
                            placeholder={t("contacts.searchPlaceholder")}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-14 h-16 bg-[#0E0E10] border-[#1A1A1E] text-white rounded-[28px] text-lg font-bold shadow-2xl transition-all focus:ring-purple-500/30 focus:border-purple-500/50"
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center justify-center gap-4">
                        <Button
                            onClick={() => setIsNewChatOpen(true)}
                            className="h-12 px-6 rounded-2xl bg-[#1A1A1E] hover:bg-[#222226] text-white font-black border border-white/5 transition-all hover:scale-105"
                        >
                            <UserPlus className="h-5 w-5 mr-3 text-purple-400" />
                            {t("contacts.addFriend")}
                        </Button>
                        <Button
                            onClick={() => setIsNewGroupOpen(true)}
                            className="h-12 px-6 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white font-black shadow-lg shadow-indigo-500/20 transition-all hover:scale-105"
                        >
                            <PlusCircle className="h-5 w-5 mr-3" />
                            {t("groups.createButton")}
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => setIsJoinInputOpen(true)}
                            className="h-12 px-6 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] text-zinc-400 hover:text-white font-black border border-white/5"
                        >
                            <MessageSquare className="h-5 w-5 mr-3" />
                            {t("groups.joinButton")}
                        </Button>
                    </div>

                    {/* Navigation Tabs: Centered Pill */}
                    <div className="flex bg-[#0E0E10] p-1.5 rounded-[24px] border border-[#1A1A1E]">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as TabId)}
                                className={cn(
                                    "flex-1 min-w-[40px] relative flex items-center justify-center gap-3 h-12 rounded-[20px] text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all duration-300 px-2",
                                    activeTab === tab.id
                                        ? "bg-[#1A1A1E] text-white shadow-xl"
                                        : "text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.02]"
                                )}
                            >
                                <tab.icon className={cn("h-4 w-4", activeTab === tab.id ? "text-purple-400" : "opacity-50")} />
                                <span className="hidden sm:inline">{tab.label}</span>
                                {tab.badge ? (
                                    <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full bg-rose-500 text-[10px] text-white animate-pulse shadow-lg">
                                        {tab.badge}
                                    </span>
                                ) : null}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content Area: Grid-based */}
            <div className="min-h-[500px] px-4 sm:px-6">
                {activeTab === "all" && (
                    <div className="space-y-12 animate-in fade-in duration-700">
                        {/* Accepted Contacts Grid */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between px-2">
                                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-400/80">
                                    {t("contacts.accepted", "Connections")}
                                </h3>
                                <span className="text-[10px] font-black text-purple-500 bg-purple-500/10 px-2 py-0.5 rounded-full">
                                    {filteredAcceptedPeers.length}
                                </span>
                            </div>

                            {!hasHydrated ? (
                                <div className="flex items-center justify-center p-12">
                                    <MessageSquare className="h-8 w-8 animate-pulse text-purple-500/50" />
                                </div>
                            ) : filteredAcceptedPeers.length === 0 ? (
                                renderEmptyState(
                                    t("contacts.noContactsFound"),
                                    t("contacts.noContactsDesc"),
                                    UserCheck,
                                    { label: t("contacts.findPeople"), onClick: () => setIsNewChatOpen(true) }
                                )
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {filteredAcceptedPeers.map(pk => {
                                        const contact = createdContacts.find(c => c.kind === 'dm' && c.pubkey === pk);
                                        return (
                                            <ContactCard
                                                key={pk}
                                                pubkey={pk}
                                                displayName={contact?.displayName}
                                                onClick={() => router.push(`/contacts/${pk}`)}
                                            />
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Recent Requests: Compact List */}
                        {requestsInbox.state.items.filter(r => r.status === 'pending').length > 0 && (
                            <div className="space-y-6">
                                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-amber-500/60 px-2">
                                    {t("contacts.pending", "Pending Invitations")}
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
                                        Communities
                                    </h3>
                                    <Button
                                        variant="ghost"
                                        onClick={() => setActiveTab("groups")}
                                        className="text-[10px] font-black uppercase tracking-widest text-indigo-400 p-0 hover:bg-transparent hover:text-indigo-300"
                                    >
                                        View All
                                    </Button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "groups" && (
                    <div className="animate-in fade-in duration-700">
                        {filteredGroups.length === 0 ? (
                            renderEmptyState(
                                t("contacts.noGroupsFound"),
                                t("contacts.noGroupsDesc"),
                                Users,
                                { label: t("messaging.newGroup"), onClick: () => setIsNewGroupOpen(true) }
                            )
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "discovery" && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 h-full">
                        <GroupDiscovery />
                    </div>
                )}

                {activeTab === "invitations" && (
                    <div className="space-y-10 max-w-3xl mx-auto w-full animate-in fade-in duration-700">
                        {filteredRequests.length === 0 && filteredDeclined.length === 0 ? (
                            renderEmptyState(
                                t("contacts.noRequestsFound"),
                                t("contacts.noRequestsDesc"),
                                MessageSquare
                            )
                        ) : (
                            <>
                                {filteredRequests.length > 0 && (
                                    <div className="space-y-4">
                                        <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 px-6">
                                            {t("contacts.pending", "Pending Invitations")}
                                        </h3>
                                        <div className="space-y-4">
                                            {filteredRequests.map(req => (
                                                <InvitationCard
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

                                {filteredDeclined.length > 0 && (
                                    <div className="space-y-4 opacity-60 hover:opacity-100 transition-opacity">
                                        <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 px-6">
                                            {t("contacts.archived", "Archived / Declined")}
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
                    <div className="max-w-3xl mx-auto w-full animate-in fade-in duration-700">
                        {filteredBlocked.length === 0 ? (
                            renderEmptyState(
                                t("contacts.noBlockedFound"),
                                t("contacts.noBlockedDesc"),
                                Ban
                            )
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredBlocked.map(pk => (
                                    <div key={pk} className="group relative flex flex-col items-center p-6 bg-red-500/[0.02] dark:bg-red-500/[0.04] backdrop-blur-xl border border-red-500/10 dark:border-red-500/10 rounded-[32px] transition-all duration-300 hover:border-red-500/30 shadow-sm">
                                        <div className="relative mb-4">
                                            <Avatar className="h-20 w-20 rounded-[24px] bg-red-100 dark:bg-red-900/20 border-2 border-white/50 dark:border-white/10">
                                                <AvatarFallback className="bg-transparent">
                                                    <Ban className="h-10 w-10 text-red-500/50" />
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-red-500 border-4 border-white dark:border-zinc-950 flex items-center justify-center">
                                                <EyeOff className="h-3 w-3 text-white" />
                                            </div>
                                        </div>

                                        <div className="text-center w-full space-y-1 mb-6">
                                            <h4 className="font-black text-sm text-zinc-900 dark:text-zinc-50 truncate w-full px-4">
                                                {pk.slice(0, 12)}...{pk.slice(-12)}
                                            </h4>
                                            <p className="text-[10px] text-red-600/60 dark:text-red-400/60 font-black uppercase tracking-widest">
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
        </div>
    );
};

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
                    <h4 className="font-bold text-sm truncate">{displayName}</h4>
                    <p className="text-[10px] text-amber-600/80 font-black uppercase tracking-tighter">
                        {t("contacts.pending", "Incoming Request")}
                    </p>
                </div>
                <div className="flex gap-2">
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
                        className="h-9 px-4 text-zinc-500 hover:text-red-500 hover:bg-red-500/5 font-black rounded-xl"
                        onClick={onBlock}
                    >
                        {t("common.block", "Block")}
                    </Button>
                </div>
            </div>
        </Card>
    );
}

function InvitationCard({ req, onAccept, onBlock }: { req: RequestsInboxItem, onAccept: () => void, onBlock: () => void }) {
    const { t } = useTranslation();
    const metadata = useProfileMetadata(req.peerPublicKeyHex);
    const displayName = metadata?.displayName || `${req.peerPublicKeyHex.slice(0, 10)}...`;

    return (
        <Card className="p-6 border-zinc-200/50 dark:border-white/5 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl rounded-[32px] hover:border-purple-500/40 transition-all duration-500 group relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative shrink-0">
                    <UserAvatar pubkey={req.peerPublicKeyHex} size="lg" className="rounded-[24px] border-2 border-white/50 dark:border-white/10 shadow-inner" />
                    <div className="absolute -top-3 -right-3">
                        <span className="flex items-center gap-1.5 bg-purple-600 text-white text-[10px] font-black px-4 py-1.5 rounded-full shadow-lg shadow-purple-500/40 uppercase tracking-widest ring-4 ring-white dark:ring-zinc-900">
                            New
                        </span>
                    </div>
                </div>

                <div className="flex-1 text-center sm:text-left min-w-0">
                    <h4 className="font-black text-xl text-zinc-900 dark:text-zinc-50 truncate mb-1">
                        {displayName}
                    </h4>
                    <div className="inline-flex items-center gap-2 p-2 px-4 rounded-full bg-zinc-100/50 dark:bg-white/5 border border-zinc-200/30 dark:border-white/5">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 italic font-medium truncate max-w-xs">
                            &quot;{req.lastMessagePreview || t("messaging.noMessagesYet")}&quot;
                        </p>
                    </div>
                </div>

                <div className="flex gap-3 shrink-0">
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
                        className="h-14 w-14 bg-white/50 dark:bg-zinc-800/50 text-zinc-500 hover:text-red-500 hover:bg-red-500/5 rounded-[20px] border-zinc-200/50 dark:border-white/5 transition-all"
                        onClick={onBlock}
                    >
                        <X className="h-7 w-7" />
                    </Button>
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
        <div key={req.peerPublicKeyHex} className="flex items-center justify-between p-4 bg-zinc-100/30 dark:bg-zinc-900/30 border border-zinc-200 dark:border-white/5 rounded-[24px]">
            <div className="flex items-center gap-3">
                <UserAvatar
                    pubkey={req.peerPublicKeyHex}
                    size="sm"
                    className="opacity-50"
                />
                <div>
                    <p className="text-sm font-bold text-zinc-500">{displayName}</p>
                    <p className="text-[10px] uppercase font-black tracking-tighter text-zinc-400">{req.status}</p>
                </div>
            </div>
            <div className="flex gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs font-bold text-purple-600 hover:bg-purple-500/10 px-4 rounded-xl"
                    onClick={() => onRestore(req.peerPublicKeyHex)}
                >
                    {t("common.restore", "Restore")}
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-zinc-400 hover:text-red-500 p-2"
                    onClick={() => onRemove(req.peerPublicKeyHex)}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
