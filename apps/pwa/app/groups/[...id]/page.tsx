"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
    Users,
    MessageSquare,
    Shield,
    Globe,
    ArrowLeft,
    Share2,
    ExternalLink,
    Bell,
    BellOff,
    LogOut,
    Loader2,
    UserPlus,
    Ban
} from "lucide-react";
import { useGroups } from "@/app/features/groups/providers/group-provider";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { PageShell } from "@/app/components/page-shell";
import { Button } from "@dweb/ui-kit";
import { useNetwork } from "@/app/features/network/providers/network-provider";
import { Card } from "@dweb/ui-kit";
import { Avatar, AvatarFallback, AvatarImage } from "@dweb/ui-kit";
import { InviteConnectionsDialog } from "@/app/features/groups/components/invite-connections-dialog";
import { cn } from "@dweb/ui-kit";
import { useSealedCommunity } from "@/app/features/groups/hooks/use-sealed-community";
import { useUploadService } from "@/app/features/messaging/lib/upload-service";
import { toast } from "@dweb/ui-kit";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import Image from "next/image";
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog";

export default function GroupHomePage() {
    const params = useParams();
    const id = Array.isArray(params.id) ? params.id.join("/") : params.id;
    const router = useRouter();
    const { t } = useTranslation();
    const { createdGroups, leaveGroup, updateGroup } = useGroups();
    const { state: identityState } = useIdentity();
    const { relayPool } = useRelay();
    const { blocklist } = useNetwork();
    const searchParams = useSearchParams();
    const discoveredRelay = searchParams.get("relay");
    const [isLeaving, setIsLeaving] = useState(false);
    const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);
    const [isInviteConnectionsOpen, setIsInviteConnectionsOpen] = useState(false);
    const [roomKeyHex, setRoomKeyHex] = useState<string>();

    // Resilience: Try to find group by ID or by matching identifier
    const group = id ? createdGroups.find(g =>
        g.id === id ||
        encodeURIComponent(g.id) === id ||
        g.id.includes(id) ||
        id.includes(g.id)
    ) : undefined;

    const effectiveRelay = group?.relayUrl || discoveredRelay || "";
    const isGuest = !group;

    const {
        state: groupState,
        updateMetadata,
        leaveGroup: leaveNip29Group,
        requestJoin: requestJoinNip29,
        members: discoveredMembers
    } = useSealedCommunity({
        groupId: group?.groupId || id || "",
        relayUrl: effectiveRelay,
        pool: relayPool,
        myPublicKeyHex: identityState.publicKeyHex || null,
        myPrivateKeyHex: identityState.privateKeyHex || null,
        enabled: !!(group || discoveredRelay),
        initialMembers: group?.memberPubkeys as ReadonlyArray<PublicKeyHex> | undefined
    });

    const activeMembers = React.useMemo(() => {
        if (discoveredMembers && discoveredMembers.length > 0) {
            return discoveredMembers;
        }
        return group?.memberPubkeys || [];
    }, [discoveredMembers, group?.memberPubkeys]);

    const displayMemberCount = activeMembers.length;

    // Sync live member list back to the group provider so persistence stays current
    React.useEffect(() => {
        if (!group || discoveredMembers.length === 0) return;
        const current = group.memberPubkeys ?? [];
        const same = current.length === discoveredMembers.length &&
            discoveredMembers.every(pk => current.includes(pk));
        if (!same) {
            updateGroup({ groupId: group.groupId, updates: { memberPubkeys: [...discoveredMembers] } });
        }
    }, [discoveredMembers, group?.groupId]);

    const [notificationsEnabled, setNotificationsEnabled] = useState(true);

    React.useEffect(() => {
        if (!group) return;
        const key = `obscur_group_notifications_${group.groupId}`;
        const saved = localStorage.getItem(key);
        if (saved) {
            setNotificationsEnabled(saved === "on");
        }

        const fetchRoomKey = async () => {
            const { roomKeyStore } = await import("@/app/features/crypto/room-key-store");
            const key = await roomKeyStore.getRoomKey(group.groupId);
            if (key) setRoomKeyHex(key);
        };
        fetchRoomKey();
    }, [group?.groupId]);

    const toggleNotifications = () => {
        const next = !notificationsEnabled;
        setNotificationsEnabled(next);
        if (group) {
            localStorage.setItem(`obscur_group_notifications_${group.groupId}`, next ? "on" : "off");
            toast.success(next ? "Notifications enabled" : "Notifications disabled");
        }
    };

    const handleToggleBlock = () => {
        const identifier = group?.groupId || id || "";
        if (blocklist.state.blockedPublicKeys.includes(identifier as any)) {
            blocklist.removeBlocked({ publicKeyHex: identifier as any });
            toast.success("Community unblocked");
        } else {
            blocklist.addBlocked({ publicKeyInput: identifier });
            toast.success("Community blocked");
        }
    };

    const isBlocked = blocklist?.state?.blockedPublicKeys?.includes((group?.groupId || id || "") as any) ?? false;

    const handleLeave = async () => {
        setIsLeaving(true);
        try {
            await leaveNip29Group();
            leaveGroup(group!.groupId);
            router.push("/network");
            toast.success("Left community");
        } catch (error) {
            toast.error("Failed to leave community");
        } finally {
            setIsLeaving(false);
            setIsLeaveConfirmOpen(false);
        }
    };

    const displayName = groupState.metadata?.name || group?.displayName || "Community";
    const aboutText = groupState.metadata?.about || group?.about || "This resilient community is built on decentralized protocols. Privacy first, always.";
    const avatarUrl = groupState.metadata?.picture || group?.avatar;

    if (!group && !discoveredRelay) {
        return (
            <PageShell title="Group Not Found">
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                    <div className="h-20 w-20 rounded-[24px] bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6">
                        <Users className="h-10 w-10 text-zinc-600" />
                    </div>
                    <h1 className="text-3xl font-black text-white mb-2">Community Not Found</h1>
                    <p className="text-zinc-500 max-w-sm mb-8">This group may have been deleted or you don&apos;t have access to it.</p>
                    <Button onClick={() => router.push("/network")} variant="secondary" className="rounded-xl px-8 font-black">
                        Back to Network
                    </Button>
                </div>
            </PageShell>
        );
    }

    return (
        <PageShell title={displayName}>
            <div className="max-w-5xl mx-auto w-full pt-20 pb-20 md:pb-0 px-4 sm:px-6 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Back Button */}
                <div className="pt-6">
                    <button
                        onClick={() => router.push("/network")}
                        className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors group"
                    >
                        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                        <span className="text-xs font-black uppercase tracking-widest">Back to Network</span>
                    </button>
                </div>

                {/* Immersive Hero Section */}
                <div className="relative group/hero">
                    {/* Background Ambient Glow */}
                    <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full animate-pulse pointer-events-none" />
                    <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full animate-pulse pointer-events-none delay-700" />

                    <Card className="relative overflow-hidden bg-[#0C0C0E]/80 backdrop-blur-xl border-white/[0.03] rounded-[48px] p-8 sm:p-12 shadow-2xl">
                        {/* Immersive Blurred Banner Background */}
                        <div className="absolute inset-0 z-0 opacity-10 pointer-events-none overflow-hidden">
                            {avatarUrl ? (
                                <Image src={avatarUrl} alt="" fill className="object-cover blur-3xl scale-150" />
                            ) : (
                                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-indigo-600/20 blur-3xl" />
                            )}
                        </div>

                        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-10 md:gap-14">
                            {/* Avatar with Status Ring */}
                            <div className="relative shrink-0">
                                <motion.div
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ duration: 0.5, ease: "easeOut" }}
                                    className="relative p-1.5 rounded-[48px] bg-gradient-to-br from-purple-500 to-indigo-600 shadow-2xl"
                                >
                                    <Avatar
                                        className="h-44 w-44 rounded-[42px] border-[6px] border-[#0C0C0E] shadow-xl"
                                    >
                                        <AvatarImage src={avatarUrl} className="object-cover" />
                                        <AvatarFallback className="bg-[#1A1A1E] text-6xl font-black text-white">
                                            {displayName.slice(0, 1).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="absolute -bottom-2 -right-2 h-10 w-10 rounded-2xl bg-green-500 border-[6px] border-[#0C0C0E] flex items-center justify-center shadow-lg group-hover/hero:scale-110 transition-transform">
                                        <div className="h-2.5 w-2.5 rounded-full bg-white animate-pulse" />
                                    </div>
                                </motion.div>
                            </div>

                            {/* Main Title & Description */}
                            <div className="flex-1 text-center md:text-left space-y-8">
                                <div className="space-y-4">
                                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                                        <motion.h1
                                            initial={{ y: 20, opacity: 0 }}
                                            animate={{ y: 0, opacity: 1 }}
                                            transition={{ delay: 0.2 }}
                                            className="text-5xl sm:text-6xl font-black text-white tracking-tight"
                                        >
                                            {displayName}
                                        </motion.h1>
                                        <motion.div
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            transition={{ delay: 0.4 }}
                                            className="px-4 py-1.5 rounded-full bg-white/[0.05] border border-white/10 flex items-center gap-2"
                                        >
                                            <Globe className="h-3.5 w-3.5 text-purple-400" />
                                            <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">
                                                {effectiveRelay.replace("wss://", "")}
                                            </span>
                                        </motion.div>
                                    </div>
                                    <p className="text-xl text-zinc-400 font-medium max-w-2xl leading-relaxed">
                                        {aboutText}
                                    </p>
                                </div>

                                {/* Premium Action Bar */}
                                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                                    {!isGuest ? (
                                        <Button
                                            onClick={() => router.push(`/?convId=${encodeURIComponent(group.id)}`)}
                                            className="h-16 px-10 rounded-2xl bg-white text-black hover:bg-zinc-200 font-black text-lg shadow-2xl shadow-white/5 transition-all hover:scale-[1.02] active:scale-95 gap-3"
                                        >
                                            <MessageSquare className="h-6 w-6" />
                                            Enter Community Chat
                                        </Button>
                                    ) : (
                                        <Button
                                            onClick={requestJoinNip29}
                                            className="h-16 px-10 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black text-lg shadow-2xl shadow-purple-500/20 transition-all hover:scale-[1.02] active:scale-95 gap-3"
                                        >
                                            <UserPlus className="h-6 w-6" />
                                            Join Community
                                        </Button>
                                    )}

                                    {!isGuest && (
                                        <Button
                                            onClick={() => setIsInviteConnectionsOpen(true)}
                                            className="h-16 px-8 rounded-2xl bg-zinc-800/80 hover:bg-zinc-700/80 text-white font-black border border-white/5 backdrop-blur-md transition-all hover:scale-[1.02] active:scale-95 gap-3"
                                        >
                                            <UserPlus className="h-5 w-5" />
                                            Invite
                                        </Button>
                                    )}

                                    <div className="flex items-center gap-2 p-1 bg-white/[0.03] border border-white/5 rounded-2xl backdrop-blur-md">
                                        {!isGuest && (
                                            <Button
                                                variant="ghost"
                                                onClick={toggleNotifications}
                                                className={cn(
                                                    "h-14 w-14 rounded-xl transition-all hover:bg-white/5",
                                                    notificationsEnabled ? "text-purple-400" : "text-zinc-500"
                                                )}
                                            >
                                                {notificationsEnabled ? <Bell className="h-6 w-6" /> : <BellOff className="h-6 w-6" />}
                                            </Button>
                                        )}

                                        {!isGuest && (
                                            <Button
                                                variant="ghost"
                                                className="h-14 w-14 rounded-xl text-zinc-400 hover:text-white transition-all hover:bg-white/5"
                                                onClick={() => {
                                                    const url = `${window.location.origin}/groups/${encodeURIComponent(group?.id || id || "")}`;
                                                    navigator.clipboard.writeText(url);
                                                    toast.success("Discovery link copied");
                                                }}
                                            >
                                                <Share2 className="h-6 w-6" />
                                            </Button>
                                        )}

                                        {!isGuest && (
                                            <>
                                                <div className="w-[1px] h-8 bg-white/10 mx-1" />

                                                <Button
                                                    variant="ghost"
                                                    onClick={() => setIsLeaveConfirmOpen(true)}
                                                    disabled={isLeaving}
                                                    className="h-14 w-14 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-all hover:scale-110 active:scale-90"
                                                >
                                                    {isLeaving ? <Loader2 className="h-6 w-6 animate-spin" /> : <LogOut className="h-6 w-6" />}
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Bento Grid Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-6">
                    {/* Membership Card - Wide */}
                    <Card className="md:col-span-2 lg:col-span-3 bg-[#0C0C0E]/40 backdrop-blur-xl border-white/[0.03] rounded-[40px] p-8 flex flex-col justify-between hover:border-purple-500/20 transition-all duration-500 group/bento overflow-hidden relative">
                        <div className="absolute -right-8 -bottom-8 opacity-[0.03] group-hover/bento:opacity-[0.08] transition-opacity duration-1000">
                            <Users size={240} className="text-white" />
                        </div>
                        <div className="space-y-6 relative z-10">
                            <div className="flex items-center justify-between">
                                <div className="h-14 w-14 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                                    <Users className="h-7 w-7 text-purple-400" />
                                </div>
                                <span className="px-5 py-1.5 rounded-full bg-purple-500/10 text-purple-400 text-xs font-black uppercase tracking-widest border border-purple-500/20">
                                    {groupState.membership.role}
                                </span>
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-3xl font-black text-white">Community</h3>
                                <p className="text-zinc-500 font-medium">Connect with {displayMemberCount} active members in this space.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 pt-8 relative z-10">
                            <div className="flex -space-x-3">
                                {activeMembers.slice(0, 5).map((pk, i) => (
                                    <div key={pk} className="h-12 w-12 rounded-2xl border-[3px] border-[#0C0C0E] bg-[#1A1A1E] flex items-center justify-center text-xs font-black text-white overflow-hidden shadow-lg group-hover/bento:-translate-y-1 transition-transform" style={{ transitionDelay: `${i * 50}ms` }}>
                                        {pk.slice(0, 1).toUpperCase()}
                                    </div>
                                ))}
                                {activeMembers.length > 5 && (
                                    <div className="h-12 w-12 rounded-2xl border-[3px] border-[#0C0C0E] bg-zinc-900 flex items-center justify-center text-xs font-black text-zinc-500 shadow-xl">
                                        +{activeMembers.length - 5}
                                    </div>
                                )}
                            </div>
                            <div className="h-1.5 w-1.5 rounded-full bg-zinc-700 mx-2" />
                            <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">{t("connections.status.active", "Online Now")}</span>
                        </div>
                    </Card>

                    {/* Registry Visibility - Tall */}
                    <Card className="md:col-span-2 lg:col-span-3 bg-[#0C0C0E]/40 backdrop-blur-xl border-white/[0.03] rounded-[40px] p-8 flex flex-col justify-between hover:border-indigo-500/20 transition-all duration-500 group/bento overflow-hidden relative">
                        <div className="absolute right-0 top-0 p-8">
                            <Shield className="h-10 w-10 text-indigo-500/20" />
                        </div>
                        <div className="space-y-4">
                            <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                                <Shield className="h-7 w-7 text-indigo-400" />
                            </div>
                            <h3 className="text-2xl font-black text-white">Registry & Privacy</h3>
                            <p className="text-sm text-zinc-500 leading-relaxed font-medium">
                                Visibility is <span className="text-indigo-400 font-black">{groupState.metadata?.access || "open"}</span>.
                                {groupState.metadata?.access === 'invite-only'
                                    ? " Access to this registry is strictly governed by invite-only protocols."
                                    : " This community is public and listed in the decentralized registry."}
                            </p>
                        </div>
                        <div className="pt-6">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                                <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]" />
                                <span className="text-[10px] font-black text-indigo-400/80 uppercase tracking-[0.1em]">Encrypted Storage</span>
                            </div>
                        </div>
                    </Card>

                    {/* Infrastructure Card - Wide Bottom */}
                    <Card className="md:col-span-4 lg:col-span-6 bg-[#0C0C0E]/40 backdrop-blur-xl border-white/[0.03] rounded-[40px] p-8 flex flex-col md:flex-row items-center justify-between gap-8 hover:border-zinc-500/20 transition-all duration-500 group/bento">
                        <div className="flex items-center gap-6">
                            <div className="h-16 w-16 rounded-3xl bg-zinc-500/10 flex items-center justify-center border border-zinc-500/20 shrink-0">
                                <ExternalLink className="h-8 w-8 text-zinc-400" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-2xl font-black text-white">Relay Infrastructure</h3>
                                <p className="text-sm text-zinc-500 font-medium font-mono opacity-80">{effectiveRelay}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-8">
                            <div className="text-right hidden sm:block">
                                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">Status</p>
                                <p className="text-xs font-black text-green-500">Connected & Optimized</p>
                            </div>
                            <div className="h-12 w-12 rounded-2xl bg-green-500/10 flex items-center justify-center border border-green-500/20 group-hover:scale-110 transition-transform">
                                <div className="h-3 w-3 rounded-full bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.6)]" />
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Management Controls */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3 px-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-600">
                            Management Controls
                        </h3>
                    </div>

                    <Card className="overflow-hidden border-white/[0.03] bg-[#0C0C0E]/40 backdrop-blur-xl rounded-[40px]">
                        <div className="flex flex-col">
                            <button
                                onClick={handleToggleBlock}
                                className="flex items-center justify-between p-8 hover:bg-rose-500/[0.02] transition-colors group/item"
                            >
                                <div className="flex items-center gap-6">
                                    <div className="h-14 w-14 rounded-2xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20 group-hover/item:scale-110 transition-transform">
                                        <Ban className="h-6 w-6 text-rose-500" />
                                    </div>
                                    <div className="text-left space-y-1">
                                        <p className="text-xl font-black text-white group-hover/item:text-rose-500 transition-colors">
                                            {isBlocked ? "Unblock community" : "Block community"}
                                        </p>
                                        <p className="text-sm text-zinc-500 font-medium">
                                            {isBlocked ? "Allow this community to appear in your network" : "Hide this community and ignore its events"}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        </div>
                    </Card>
                </div>

                {!isGuest && group && (
                    <InviteConnectionsDialog
                        isOpen={isInviteConnectionsOpen}
                        onClose={() => setIsInviteConnectionsOpen(false)}
                        groupId={group.groupId}
                        roomKeyHex={roomKeyHex || ""}
                        currentMemberPubkeys={activeMembers}
                        metadata={{
                            id: group.groupId,
                            name: displayName,
                            about: aboutText,
                            picture: avatarUrl || "",
                            access: groupState.metadata?.access || "invite-only"
                        }}
                    />
                )}

                <ConfirmDialog
                    isOpen={isLeaveConfirmOpen}
                    onClose={() => setIsLeaveConfirmOpen(false)}
                    onConfirm={handleLeave}
                    title="Leave Community"
                    description={`Are you sure you want to leave "${displayName}"? You will miss out on future updates and conversations.`}
                    confirmLabel="Leave Community"
                    cancelLabel="Stay for now"
                    variant="danger"
                    isLoading={isLeaving}
                />
            </div>
        </PageShell>
    );
}
