"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
    Users,
    MessageSquare,
    Settings,
    Shield,
    Globe,
    ArrowLeft,
    Share2,
    Calendar,
    ExternalLink,
    Bell,
    BellOff,
    LogOut,
    Trash2,
    Camera,
    Loader2,
    Check,
    MoreVertical,
    UserPlus
} from "lucide-react";
import { useGroups } from "@/app/features/groups/providers/group-provider";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { PageShell } from "@/app/components/page-shell";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";
import { GroupManagementDialog } from "@/app/features/groups/components/group-management-dialog";
import { InviteContactsDialog } from "@/app/features/groups/components/invite-contacts-dialog";
import { cn } from "@/app/lib/cn";
import { useSealedCommunity } from "@/app/features/groups/hooks/use-sealed-community";
import { useUploadService } from "@/app/features/messaging/lib/upload-service";
import { toast } from "@/app/components/ui/toast";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import Image from "next/image";
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog";

export default function GroupHomePage() {
    const params = useParams();
    const id = Array.isArray(params.id) ? params.id.join("/") : params.id;
    const router = useRouter();
    const { t } = useTranslation();
    const { createdGroups, leaveGroup } = useGroups();
    const { state: identityState } = useIdentity();
    const { relayPool } = useRelay();
    const [isManageOpen, setIsManageOpen] = useState(false);
    const { uploadFile, pickFiles } = useUploadService();
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);
    const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);
    const [isInviteContactsOpen, setIsInviteContactsOpen] = useState(false);
    const [roomKeyHex, setRoomKeyHex] = useState<string>();

    // Resilience: Try to find group by ID or by matching identifier
    const group = id ? createdGroups.find(g =>
        g.id === id ||
        encodeURIComponent(g.id) === id ||
        g.id.includes(id) ||
        id.includes(g.id)
    ) : undefined;

    const {
        state: groupState,
        updateMetadata,
        leaveGroup: leaveNip29Group,
        members: discoveredMembers
    } = useSealedCommunity({
        groupId: group?.groupId || "",
        relayUrl: group?.relayUrl || "",
        pool: relayPool,
        myPublicKeyHex: identityState.publicKeyHex || null,
        myPrivateKeyHex: identityState.privateKeyHex || null,
        enabled: !!group
    });

    const displayMemberCount = React.useMemo(() => {
        if (!group) return 0;
        const combined = new Set([...group.memberPubkeys, ...discoveredMembers]);
        return combined.size;
    }, [group, discoveredMembers]);

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

    const handleAvatarUpload = async () => {
        if (!isAdmin) return;
        const files = await pickFiles();
        if (files?.[0]) {
            setIsUploadingAvatar(true);
            try {
                const res = await uploadFile(files[0]);
                await updateMetadata({
                    id: group!.groupId,
                    name: displayName,
                    about: aboutText,
                    picture: res.url,
                    access: groupState.metadata?.access || "open"
                });
                toast.success("Community avatar updated");
            } catch (error) {
                toast.error("Failed to upload avatar");
            } finally {
                setIsUploadingAvatar(false);
            }
        }
    };

    const handleLeave = async () => {
        setIsLeaving(true);
        try {
            await leaveNip29Group();
            leaveGroup(group!.groupId);
            router.push("/contacts");
            toast.success("Left community");
        } catch (error) {
            toast.error("Failed to leave community");
        } finally {
            setIsLeaving(false);
            setIsLeaveConfirmOpen(false);
        }
    };

    const isLocalAdmin = group?.adminPubkeys?.includes(identityState.publicKeyHex || "") || false;
    const isAdmin = isLocalAdmin;
    const displayName = groupState.metadata?.name || group?.displayName || "Community";
    const aboutText = groupState.metadata?.about || group?.about || "This resilient community is built on decentralized protocols. Privacy first, always.";
    const avatarUrl = groupState.metadata?.picture || group?.avatar;

    if (!group) {
        return (
            <PageShell title="Group Not Found">
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                    <div className="h-20 w-20 rounded-[24px] bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6">
                        <Users className="h-10 w-10 text-zinc-600" />
                    </div>
                    <h1 className="text-3xl font-black text-white mb-2">Community Not Found</h1>
                    <p className="text-zinc-500 max-w-sm mb-8">This group may have been deleted or you don&apos;t have access to it.</p>
                    <Button onClick={() => router.push("/contacts")} variant="secondary" className="rounded-xl px-8 font-black">
                        Back to Network
                    </Button>
                </div>
            </PageShell>
        );
    }

    return (
        <PageShell title={group.displayName}>
            <div className="max-w-5xl mx-auto w-full pb-20 px-4 sm:px-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Back Button */}
                <button
                    onClick={() => router.push("/contacts")}
                    className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors group"
                >
                    <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                    <span className="text-xs font-black uppercase tracking-widest">Back to Network</span>
                </button>

                {/* Hero Section */}
                <div className="relative group/hero">
                    <div className="absolute -inset-1 bg-gradient-to-r from-purple-500/10 via-transparent to-indigo-500/10 rounded-[40px] blur-2xl opacity-50 transition-opacity duration-1000" />

                    <Card className="relative overflow-hidden bg-[#0E0E10] border-[#1A1A1E] rounded-[40px] p-8 sm:p-12 border-white/[0.02]">
                        <div className="flex flex-col md:flex-row items-center md:items-start gap-10">
                            <div className="relative shrink-0 group/avatar-container">
                                <div className="absolute -inset-4 bg-purple-500/20 rounded-full blur-2xl opacity-0 group-hover/hero:opacity-100 transition-opacity duration-700" />
                                <Avatar
                                    className={cn(
                                        "h-40 w-40 rounded-[42px] border-4 border-[#1A1A1E] shadow-2xl relative z-10 transition-all duration-500 group-hover/hero:scale-[1.02]",
                                        isAdmin && "cursor-pointer hover:border-purple-500/50"
                                    )}
                                    onClick={isAdmin ? handleAvatarUpload : undefined}
                                >
                                    <AvatarImage src={avatarUrl} />
                                    <AvatarFallback className="bg-gradient-to-br from-purple-500 to-indigo-600 text-6xl font-black text-white">
                                        {displayName.slice(0, 1).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                {isUploadingAvatar && (
                                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 rounded-[42px] backdrop-blur-sm animate-in fade-in">
                                        <Loader2 className="h-10 w-10 text-white animate-spin" />
                                    </div>
                                )}
                                {isAdmin && !isUploadingAvatar && (
                                    <button
                                        onClick={handleAvatarUpload}
                                        className="absolute -bottom-2 -right-2 h-10 w-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-all z-30 border-4 border-[#0E0E10]"
                                    >
                                        <Camera className="h-4 w-4" />
                                    </button>
                                )}
                                {isAdmin && !isUploadingAvatar && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-500 text-[#1A1A1E] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ring-4 ring-[#0E0E10] z-20 shadow-xl">
                                        Administrator
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 text-center md:text-left space-y-6">
                                <div className="space-y-3">
                                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                                        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tighter">
                                            {displayName}
                                        </h1>
                                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.03] border border-white/5 text-zinc-500 text-[10px] font-black uppercase tracking-widest">
                                            <Globe className="h-3 w-3" />
                                            {group.relayUrl.replace("wss://", "")}
                                        </div>
                                    </div>
                                    <p className="text-lg text-zinc-400 font-medium max-w-2xl leading-relaxed">
                                        {aboutText}
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-center justify-center md:justify-start gap-8 pt-2">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-1">Members</span>
                                        <span className="text-2xl font-black text-white flex items-center gap-2">
                                            {displayMemberCount}
                                            <Users className="h-5 w-5 text-purple-500/50" />
                                        </span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-1">Status</span>
                                        <span className="text-2xl font-black text-green-500 flex items-center gap-2">
                                            Active
                                            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                        </span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-1">Trust</span>
                                        <span className="text-2xl font-black text-indigo-400 flex items-center gap-2">
                                            Encrypted
                                            <Shield className="h-5 w-5 text-indigo-500/50" />
                                        </span>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-4">
                                    <Button
                                        onClick={() => router.push(`/?convId=${encodeURIComponent(group.id)}`)}
                                        className="h-14 px-10 rounded-[20px] bg-purple-600 hover:bg-purple-700 text-white font-black text-lg shadow-xl shadow-purple-500/30 transition-all hover:scale-105 active:scale-95 gap-3"
                                    >
                                        <MessageSquare className="h-6 w-6" />
                                        Enter Community Chat
                                    </Button>

                                    <Button
                                        onClick={toggleNotifications}
                                        variant="outline"
                                        className={cn(
                                            "h-14 px-8 rounded-[20px] bg-transparent border-white/10 text-white font-black transition-all hover:scale-105 active:scale-95 gap-3",
                                            !notificationsEnabled && "opacity-50 text-zinc-500"
                                        )}
                                    >
                                        {notificationsEnabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
                                        {notificationsEnabled ? "Notifications On" : "Muted"}
                                    </Button>

                                    {isAdmin ? (
                                        <Button
                                            variant="secondary"
                                            className="h-14 px-8 rounded-[20px] bg-[#1A1A1E] hover:bg-[#222226] text-white font-black border border-white/5 transition-all hover:scale-105 active:scale-95 gap-3"
                                            onClick={() => setIsManageOpen(true)}
                                        >
                                            <Settings className="h-5 w-5 text-zinc-500" />
                                            Manage Community
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="outline"
                                            onClick={() => setIsLeaveConfirmOpen(true)}
                                            disabled={isLeaving}
                                            className="h-14 px-8 rounded-[20px] bg-transparent border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white font-black transition-all hover:scale-105 active:scale-95 gap-3"
                                        >
                                            {isLeaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
                                            Leave Community
                                        </Button>
                                    )}

                                    <Button
                                        variant="secondary"
                                        className="h-14 px-8 rounded-[20px] bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 font-black border border-indigo-500/20 transition-all hover:scale-105 active:scale-95 gap-3"
                                        onClick={() => setIsInviteContactsOpen(true)}
                                    >
                                        <UserPlus className="h-5 w-5" />
                                        Invite Friends
                                    </Button>

                                    <Button
                                        variant="ghost"
                                        className="h-14 w-14 rounded-[20px] bg-white/[0.03] border border-white/5 text-zinc-500 hover:text-white transition-all hover:scale-105 active:scale-95"
                                        onClick={() => {
                                            const url = `${window.location.origin}/groups/${encodeURIComponent(group.id)}`;
                                            navigator.clipboard.writeText(url);
                                            toast.success("Discovery link copied");
                                        }}
                                    >
                                        <Share2 className="h-5 w-5" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Secondary Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="bg-[#0E0E10] border-[#1A1A1E] rounded-[32px] p-8 space-y-4 hover:border-purple-500/20 transition-all group/card">
                        <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 group-hover/card:bg-indigo-500/20 transition-all">
                            <Shield className="h-6 w-6 text-indigo-400" />
                        </div>
                        <h3 className="text-xl font-black text-white">Registry Visibility</h3>
                        <p className="text-sm text-zinc-500 leading-relaxed font-medium capitalize">
                            This community is currently <span className="text-indigo-400 font-bold">{groupState.metadata?.access || "open"}</span>.
                            {groupState.metadata?.access === 'invite-only' ? " Join requests require manual approval." : " Anyone can discover and join."}
                        </p>
                    </Card>

                    <Card className="bg-[#0E0E10] border-[#1A1A1E] rounded-[32px] p-8 space-y-4 hover:border-amber-500/20 transition-all group/card">
                        <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 group-hover/card:bg-amber-500/20 transition-all">
                            <Users className="h-6 w-6 text-amber-400" />
                        </div>
                        <h3 className="text-xl font-black text-white">Membership</h3>
                        <div className="flex flex-col gap-2">
                            <p className="text-sm text-zinc-500 font-medium">
                                You are connected as a <span className="text-amber-400 font-bold uppercase tracking-widest text-[10px] ml-1">{groupState.membership.role}</span>
                            </p>
                            <div className="flex -space-x-2 pt-2">
                                {group.memberPubkeys.slice(0, 5).map(pk => (
                                    <div key={pk} className="h-8 w-8 rounded-full border-2 border-[#0E0E10] bg-zinc-800 flex items-center justify-center text-[10px] font-black text-white overflow-hidden">
                                        {pk.slice(0, 1).toUpperCase()}
                                    </div>
                                ))}
                                {group.memberPubkeys.length > 5 && (
                                    <div className="h-8 w-8 rounded-full border-2 border-[#0E0E10] bg-zinc-900 flex items-center justify-center text-[8px] font-black text-zinc-500">
                                        +{group.memberPubkeys.length - 5}
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>

                    <Card className="bg-[#0E0E10] border-[#1A1A1E] rounded-[32px] p-8 space-y-4 hover:border-purple-500/20 transition-all group/card">
                        <div className="h-12 w-12 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 group-hover/card:bg-purple-500/20 transition-all">
                            <ExternalLink className="h-6 w-6 text-purple-400" />
                        </div>
                        <h3 className="text-xl font-black text-white">Relay Host</h3>
                        <p className="text-sm text-zinc-500 leading-relaxed font-medium truncate opacity-60">
                            {group.relayUrl}
                        </p>
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                            <span className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">Connected & Verified</span>
                        </div>
                    </Card>
                </div>

                {/* Management Dialog */}
                {isAdmin && (
                    <GroupManagementDialog
                        isOpen={isManageOpen}
                        onClose={() => setIsManageOpen(false)}
                        group={group}
                        pool={relayPool}
                        myPublicKeyHex={identityState.publicKeyHex || null}
                        myPrivateKeyHex={identityState.privateKeyHex || null}
                    />
                )}

                <InviteContactsDialog
                    isOpen={isInviteContactsOpen}
                    onClose={() => setIsInviteContactsOpen(false)}
                    groupId={group.groupId}
                    roomKeyHex={roomKeyHex || ""}
                    metadata={{
                        id: group.groupId,
                        name: displayName,
                        about: aboutText,
                        picture: avatarUrl || "",
                        access: groupState.metadata?.access || "invite-only"
                    }}
                />

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
