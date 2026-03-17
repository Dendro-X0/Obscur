"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
    X,
    Camera,
    Users,
    Shield,
    ShieldCheck,
    Settings,
    UserPlus,
    MoreVertical,
    UserCog,
    UserMinus,
    Globe,
    Lock,
    Bell,
    Trash2,
    LogOut,
    Check,
    Loader2,
    QrCode,
    Share2,
    RotateCcw,
    Download,
    ChevronRight,
    Search,
    UserCheck
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "../../../components/ui/dropdown-menu";
import { useSealedCommunity } from "../hooks/use-sealed-community";
import { useUploadService } from "@/app/features/messaging/lib/upload-service";
import { useGroups } from "../providers/group-provider";
import { toast } from "../../../components/ui/toast";
import { cn } from "../../../lib/cn";
import { ConfirmDialog } from "../../../components/ui/confirm-dialog";
import { GroupQRCode } from "./group-qr-code";
import { InviteMemberDialog } from "./invite-member-dialog";
import type { GroupConversation } from "../../messaging/types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { GroupAccessMode } from "../types";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getPublicGroupHref, toAbsoluteAppUrl } from "@/app/features/navigation/public-routes";

interface GroupManagementDialogProps {
    isOpen: boolean;
    onClose: () => void;
    group: GroupConversation;
    pool: any;
    myPublicKeyHex: PublicKeyHex | null;
    myPrivateKeyHex: any;
}

type TabId = "general" | "members" | "requests" | "settings";

export function GroupManagementDialog({
    isOpen,
    onClose,
    group,
    pool,
    myPublicKeyHex,
    myPrivateKeyHex
}: GroupManagementDialogProps) {
    const { t } = useTranslation();
    const { leaveGroup, updateGroup } = useGroups();
    const {
        state,
        approveJoin,
        denyJoin,
        approveAllJoinRequests,
        denyAllJoinRequests,
        updateMetadata,
        putUser,
        removeUser,
        promoteUser,
        demoteUser,
        setGroupStatus,
        leaveGroup: leaveNip29Group,
        sendVoteKick,
        rotateRoomKey,
        members,
        admins
    } = useSealedCommunity({
        groupId: group.groupId,
        relayUrl: group.relayUrl,
        communityId: group.communityId,
        pool,
        myPublicKeyHex,
        myPrivateKeyHex,
    });

    const { uploadFile, pickFiles } = useUploadService();
    const [activeTab, setActiveTab] = useState<TabId>("general");
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);

    // Edit state
    const [editName, setEditName] = useState("");
    const [editAbout, setEditAbout] = useState("");
    const [editPicture, setEditPicture] = useState("");
    const [editAccess, setEditAccess] = useState<GroupAccessMode>("invite-only");

    const [memberSearchQuery, setMemberSearchQuery] = useState("");
    const [resolvedNames, setResolvedNames] = useState<Record<string, string>>({});
    const [mutedMembers, setMutedMembers] = useState<string[]>([]);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const getScopedMutedMembersKey = (groupId: string): string => getScopedStorageKey(`obscur_group_muted_members_${groupId}`);
    const getLegacyMutedMembersKey = (groupId: string): string => `obscur_group_muted_members_${groupId}`;
    const getScopedNotificationsKey = (groupId: string): string => getScopedStorageKey(`obscur_group_notifications_${groupId}`);
    const getLegacyNotificationsKey = (groupId: string): string => `obscur_group_notifications_${groupId}`;

    const isLocalAdmin = group.adminPubkeys?.includes(myPublicKeyHex || "") || false;
    const isAdmin = state.membership.role === "member" || isLocalAdmin;
    const isOwner = isAdmin; // In Phase 1/2, all members are equal owners of the encrypted space

    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);
    const [isPurgeConfirmOpen, setIsPurgeConfirmOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [roomKeyHex, setRoomKeyHex] = useState<string>();

    useEffect(() => {
        const fetchRoomKey = async () => {
            const { roomKeyStore } = await import("../../crypto/room-key-store");
            const key = await roomKeyStore.getRoomKey(group.groupId);
            if (key) setRoomKeyHex(key);
        };
        fetchRoomKey();
    }, [group.groupId]);

    const exportCommunity = async () => {
        try {
            const { roomKeyStore } = await import("../../crypto/room-key-store");
            const record = await roomKeyStore.getRoomKeyRecord(group.groupId);

            const exportData = {
                version: 1,
                groupId: group.groupId,
                metadata: state.metadata,
                keys: record || { roomKeyHex: roomKeyHex, previousKeys: [] },
                exportedAt: new Date().toISOString()
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `obscur-community-${group.groupId.slice(0, 8)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success("Community backup downloaded successfully");
        } catch (error) {
            console.error("Export failed:", error);
            toast.error("Failed to export community data");
        }
    };

    useEffect(() => {
        const saved =
            localStorage.getItem(getScopedMutedMembersKey(group.groupId))
            ?? localStorage.getItem(getLegacyMutedMembersKey(group.groupId));
        if (saved) {
            try {
                setMutedMembers(JSON.parse(saved));
            } catch (e) { }
        }

        const notifSaved =
            localStorage.getItem(getScopedNotificationsKey(group.groupId))
            ?? localStorage.getItem(getLegacyNotificationsKey(group.groupId));
        if (notifSaved) {
            setNotificationsEnabled(notifSaved === "on");
        }
    }, [group.groupId]);

    const toggleMute = (pk: string) => {
        const next = mutedMembers.includes(pk)
            ? mutedMembers.filter(m => m !== pk)
            : [...mutedMembers, pk];
        setMutedMembers(next);
        localStorage.setItem(getScopedMutedMembersKey(group.groupId), JSON.stringify(next));
        toast.success(mutedMembers.includes(pk) ? "Member unmuted" : "Member muted");
    };

    const toggleNotifications = () => {
        const next = !notificationsEnabled;
        setNotificationsEnabled(next);
        localStorage.setItem(getScopedNotificationsKey(group.groupId), next ? "on" : "off");
        toast.success(next ? "Notifications enabled" : "Notifications disabled");
    };

    useEffect(() => {
        if (state.metadata) {
            setEditName(state.metadata.name || group.displayName);
            setEditAbout(state.metadata.about || "");
            setEditPicture(state.metadata.picture || "");
            setEditAccess(state.metadata.access || "public");
        }
    }, [state.metadata, group.displayName]);

    // Background Sync: Replace persisted members with live truth
    useEffect(() => {
        if (!members.length) return;

        const live = [...members].sort();
        const cached = [...group.memberPubkeys].sort();

        if (JSON.stringify(live) !== JSON.stringify(cached)) {
            updateGroup({
                groupId: group.groupId,
                relayUrl: group.relayUrl,
                conversationId: group.id,
                updates: {
                    memberPubkeys: [...members],
                    memberCount: members.length
                }
            });
        }
    }, [members, group.memberPubkeys, group.groupId, updateGroup]);

    const handleLeave = async () => {
        setIsProcessing(true);
        try {
            await leaveNip29Group();
            leaveGroup({ groupId: group.groupId, relayUrl: group.relayUrl, conversationId: group.id });
            onClose();
            toast.success("Connection Severed");
        } catch (error) {
            toast.error("Failed to leave community");
        } finally {
            setIsProcessing(false);
            setIsLeaveConfirmOpen(false);
        }
    };

    const handlePurge = async () => {
        setIsProcessing(true);
        try {
            await leaveNip29Group();
            leaveGroup({ groupId: group.groupId, relayUrl: group.relayUrl, conversationId: group.id });
            onClose();
            toast.success("Community Purged");
        } catch (error) {
            toast.error("Failed to purge community");
        } finally {
            setIsProcessing(false);
            setIsPurgeConfirmOpen(false);
        }
    };

    // Metadata subscription for member names
    useEffect(() => {
        const activeMemberList = members.length > 0 ? members : group.memberPubkeys;
        if (!isOpen || !activeMemberList.length || !pool) return;
        const subId = `mgmt-names-${Math.random().toString(36).substring(7)}`;
        const filter = { kinds: [0], authors: activeMemberList as string[] };

        const cleanup = pool.subscribeToMessages(({ message }: { message: string }) => {
            try {
                const parsed = JSON.parse(message);
                if (parsed[0] === "EVENT" && parsed[1] === subId) {
                    const event = parsed[2];
                    if (event.kind === 0) {
                        try {
                            const metadata = JSON.parse(event.content);
                            const name = metadata.display_name || metadata.name;
                            if (name) setResolvedNames(prev => ({ ...prev, [event.pubkey]: name }));
                        } catch (e) { }
                    }
                }
            } catch (e) { }
        });

        pool.sendToOpen(JSON.stringify(["REQ", subId, filter]));
        return () => {
            try { pool.sendToOpen(JSON.stringify(["CLOSE", subId])); cleanup(); } catch (e) { }
        };
    }, [isOpen, members, group.memberPubkeys, pool]);

    if (!isOpen) return null;

    const handleSaveGeneral = async () => {
        setIsSaving(true);
        try {
            // In Sealed Protocol, metadata updates are broadcast as Kind 39000 hints
            // and eventually (Phase 4) as part of the encrypted Manifest.
            await updateMetadata({
                id: group.groupId,
                name: editName,
                about: editAbout,
                picture: editPicture,
                access: editAccess
            });

            toast.success("Community settings updated");
        } catch (error) {
            toast.error("Failed to update settings");
        } finally {
            setIsSaving(false);
        }
    };

    const navItems = [
        { id: "general", label: "General", icon: Settings },
        { id: "members", label: "Members", icon: Users },
        { id: "settings", label: "Safety & Privacy", icon: Shield },
    ];

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 sm:p-6 animate-in fade-in duration-300">
            <Card className="w-full max-w-5xl h-[85vh] bg-[#0A0A0B] border-[#1A1A1E] shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden rounded-[32px] flex flex-col sm:flex-row">
                {/* Sidebar Navigation */}
                <div className="w-full sm:w-64 bg-[#0E0E10] border-r border-[#1A1A1E] flex flex-col">
                    <div className="p-8 pb-4">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-8 px-2">Community Engine</h2>
                        <div className="flex items-center gap-4 px-2 mb-10">
                            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shrink-0 overflow-hidden relative">
                                {state.metadata?.picture ? (
                                    <Image src={state.metadata.picture} alt="Group" fill unoptimized className="object-cover" />
                                ) : (
                                    <span className="text-xl font-black text-white">{group.displayName[0]}</span>
                                )}
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-black text-white truncate">{state.metadata?.name || group.displayName}</p>
                                <p className="text-[10px] font-bold text-zinc-500 truncate">{group.groupId.slice(0, 12)}...</p>
                            </div>
                        </div>
                    </div>

                    <nav className="flex-1 px-4 space-y-1">
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id as TabId)}
                                className={cn(
                                    "w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all duration-300 group",
                                    activeTab === item.id
                                        ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20"
                                        : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <item.icon className={cn("h-4 w-4", activeTab === item.id ? "text-white" : "text-zinc-600 group-hover:text-zinc-400")} />
                                    {item.label}
                                </div>
                                <ChevronRight className={cn("h-3 w-3 transition-transform", activeTab === item.id ? "rotate-90 opacity-100" : "opacity-0 group-hover:opacity-40")} />
                            </button>
                        ))}
                    </nav>

                    <div className="p-6 border-t border-white/[0.03]">
                        <Button
                            variant="ghost"
                            onClick={onClose}
                            className="w-full h-12 rounded-2xl bg-[#1A1A1E] text-zinc-400 hover:text-white font-black uppercase tracking-widest text-[10px]"
                        >
                            <X className="h-4 w-4 mr-2" />
                            Close Portal
                        </Button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col bg-[#0A0A0B] overflow-hidden">
                    <header className="px-10 py-8 border-b border-white/[0.03] flex items-center justify-between shrink-0">
                        <div>
                            <h3 className="text-2xl font-black text-white tracking-tight">
                                {navItems.find(i => i.id === activeTab)?.label}
                            </h3>
                            <p className="text-xs font-bold text-zinc-500 mt-1 uppercase tracking-widest opacity-60">
                                Global Community Identity & Metadata
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setIsQrModalOpen(true)}
                                className="rounded-xl bg-[#1A1A1E] border border-white/5 font-bold"
                            >
                                <QrCode className="h-4 w-4 mr-2" />
                                Share Access
                            </Button>
                        </div>
                    </header>

                    <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                        {activeTab === "general" && (
                            <div className="max-w-2xl space-y-10">
                                {/* Community Branding */}
                                <div className="space-y-6">
                                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-500">Visual Identity</Label>
                                    <div className="flex items-center gap-8">
                                        <div className="relative group/avatar shrink-0">
                                            <div className="h-32 w-32 rounded-[40px] bg-[#1A1A1E] border-2 border-dashed border-[#2A2A2E] flex items-center justify-center overflow-hidden transition-all group-hover/avatar:border-purple-500/50">
                                                {editPicture ? (
                                                    <Image src={editPicture} alt="Avatar" fill unoptimized className="object-cover" />
                                                ) : (
                                                    <Camera className="h-8 w-8 text-zinc-700" />
                                                )}
                                                {isUploading && (
                                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                                        <Loader2 className="h-6 w-6 text-white animate-spin" />
                                                    </div>
                                                )}
                                            </div>
                                            {isAdmin && (
                                                <button
                                                    onClick={async () => {
                                                        const files = await pickFiles();
                                                        if (files?.[0]) {
                                                            setIsUploading(true);
                                                            try {
                                                                const res = await uploadFile(files[0]);
                                                                setEditPicture(res.url);
                                                            } finally {
                                                                setIsUploading(false);
                                                            }
                                                        }
                                                    }}
                                                    className="absolute -bottom-2 -right-2 h-10 w-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-all"
                                                >
                                                    <Camera className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <h4 className="text-white font-black text-lg">Community Avatar</h4>
                                            <p className="text-zinc-500 text-sm leading-relaxed max-w-xs font-medium">
                                                The primary icon for discovery. Recommended size 512x512. Max 5MB.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Form Fields */}
                                <div className="space-y-8">
                                    <div className="space-y-3">
                                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">Community Name</Label>
                                        <Input
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            disabled={!isAdmin}
                                            className="h-14 bg-[#0E0E10] border-[#1A1A1E] text-white rounded-[20px] font-bold focus:ring-purple-500/30"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">About / Manifest</Label>
                                        <Textarea
                                            value={editAbout}
                                            onChange={(e) => setEditAbout(e.target.value)}
                                            disabled={!isAdmin}
                                            placeholder="What is the purpose of this community?"
                                            className="min-h-[140px] bg-[#0E0E10] border-[#1A1A1E] text-white rounded-[24px] font-medium resize-none focus:ring-purple-500/30 leading-relaxed"
                                        />
                                    </div>

                                    {/* Privacy Toggles */}
                                    <div className="space-y-4">
                                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">Privacy Mode</Label>
                                        <div className="grid grid-cols-3 bg-[#0E0E10] p-1.5 rounded-[24px] border border-[#1A1A1E] gap-2">
                                            {(["open", "discoverable", "invite-only"] as const).map((mode) => (
                                                <button
                                                    key={mode}
                                                    onClick={() => setEditAccess(mode)}
                                                    className={cn(
                                                        "flex flex-col items-center justify-center py-4 rounded-[20px] transition-all duration-300",
                                                        editAccess === mode
                                                            ? "bg-[#1A1A1E] text-white shadow-xl ring-1 ring-white/5"
                                                            : "text-zinc-600 hover:text-zinc-400 opacity-60 grayscale"
                                                    )}
                                                >
                                                    {mode === "open" && <Globe className={cn("h-5 w-5 mb-2", editAccess === mode ? "text-purple-400" : "")} />}
                                                    {mode === "discoverable" && <Users className={cn("h-5 w-5 mb-2", editAccess === mode ? "text-purple-400" : "")} />}
                                                    {mode === "invite-only" && <Lock className={cn("h-5 w-5 mb-2", editAccess === mode ? "text-rose-400" : "")} />}
                                                    <span className="text-[10px] font-black uppercase tracking-widest">{mode === "discoverable" ? "Listed" : mode}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {isAdmin && (
                                    <div className="pt-6 border-t border-white/[0.03]">
                                        <Button
                                            onClick={handleSaveGeneral}
                                            disabled={isSaving}
                                            className="h-14 px-10 rounded-[20px] bg-purple-600 hover:bg-purple-700 text-white font-black shadow-xl shadow-purple-600/20 transition-all hover:scale-105"
                                        >
                                            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                            Commit Identity Changes
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === "members" && (
                            <div className="space-y-8">
                                <div className="flex items-center justify-between bg-[#0E0E10] p-6 rounded-[28px] border border-[#1A1A1E]">
                                    <div className="flex items-center gap-5">
                                        <div className="h-12 w-12 rounded-[18px] bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                                            <Users className="h-5 w-5 text-indigo-400" />
                                        </div>
                                        <div>
                                            <p className="text-white font-black text-lg">{(members.length || group.memberPubkeys.length)} Registered Members</p>
                                            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Global Group Registry</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <Button
                                            onClick={() => setIsInviteModalOpen(true)}
                                            className="h-11 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs gap-3 shadow-lg shadow-indigo-600/20"
                                        >
                                            <UserPlus className="h-4 w-4" />
                                            Invite Peer
                                        </Button>
                                        <div className="relative w-64 group">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 group-focus-within:text-purple-400 transition-colors" />
                                            <Input
                                                placeholder="Search registry..."
                                                value={memberSearchQuery}
                                                onChange={(e) => setMemberSearchQuery(e.target.value)}
                                                className="pl-11 h-11 bg-[#0A0A0B] border-[#1A1A1E] text-white rounded-xl text-xs font-bold"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {(members.length > 0 ? members : group.memberPubkeys)
                                        .filter(pk => {
                                            const q = memberSearchQuery.toLowerCase();
                                            const name = (resolvedNames[pk] || "").toLowerCase();
                                            return pk.toLowerCase().includes(q) || name.includes(q);
                                        })
                                        .map((pk) => {
                                            const admin = admins.find(a => a.pubkey === pk);
                                            const isOwner = admin?.roles.some(r => ["owner", "admin"].includes(r.toLowerCase()));
                                            const isMod = admin && !isOwner;
                                            const isMe = pk === myPublicKeyHex;
                                            const isMuted = mutedMembers.includes(pk);

                                            return (
                                                <div key={pk} className="flex items-center gap-4 p-5 bg-[#0E0E10] border border-[#1A1A1E] rounded-[24px] hover:border-purple-500/30 transition-all group/member">
                                                    <div className="h-12 w-12 rounded-2xl bg-[#1A1A1E] flex items-center justify-center border border-white/5 relative shrink-0">
                                                        {isMuted ? (
                                                            <Bell className="h-5 w-5 text-rose-500 opacity-50" />
                                                        ) : (
                                                            <Shield className="h-5 w-5 text-indigo-500/60" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-sm font-black text-white truncate">
                                                                {resolvedNames[pk] || `${pk.slice(0, 8)}...${pk.slice(-4)}`}
                                                            </p>
                                                            {isMe && <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 border border-white/5">ME</span>}
                                                            {isMuted && <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20 uppercase">MUTED</span>}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-tighter">Member</span>
                                                            {(state.kickVotes[pk]?.length || 0) > 0 && (
                                                                <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase">
                                                                    ⚠️ {(state.kickVotes[pk]?.length || 0)}/{(Math.floor((members?.length || 0) / 2) + 1)} Votes to Kick
                                                                </span>
                                                            )}
                                                            {state.expelledMembers.includes(pk as PublicKeyHex) && (
                                                                <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-500 border border-rose-500/30 uppercase">
                                                                    EXPELLED
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {!isMe && (
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl opacity-0 group-hover/member:opacity-100 bg-[#1A1A1E] text-zinc-500">
                                                                    <MoreVertical className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="bg-[#1A1A1E] border-white/5 rounded-2xl p-2 w-48 shadow-2xl">
                                                                <DropdownMenuLabel className="text-[10px] font-black uppercase p-2 text-zinc-500">Member Options</DropdownMenuLabel>
                                                                <DropdownMenuSeparator className="bg-white/5" />

                                                                <DropdownMenuItem onClick={() => toggleMute(pk)} className="rounded-xl font-bold gap-3 focus:bg-indigo-500/10 focus:text-indigo-400 cursor-pointer">
                                                                    {isMuted ? <Bell className="h-4 w-4" /> : <X className="h-4 w-4" />}
                                                                    {isMuted ? "Unmute Member" : "Mute Member"}
                                                                </DropdownMenuItem>

                                                                {isAdmin && (
                                                                    <>
                                                                        <DropdownMenuSeparator className="bg-white/5" />
                                                                        <DropdownMenuLabel className="text-[10px] font-black uppercase p-2 text-zinc-500">Moderation</DropdownMenuLabel>



                                                                        <DropdownMenuItem
                                                                            onClick={() => sendVoteKick(pk)}
                                                                            className="rounded-xl font-bold gap-3 text-rose-500 focus:bg-rose-500/10 focus:text-rose-400 cursor-pointer"
                                                                        >
                                                                            <UserMinus className="h-4 w-4" /> Vote to Kick
                                                                        </DropdownMenuItem>
                                                                    </>
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    )}
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        )}



                        {activeTab === "settings" && (
                            <div className="max-w-2xl space-y-12">
                                <div className="space-y-6">
                                    <h4 className="text-white font-black text-xl">Governance & Safety</h4>

                                    <div className="space-y-4">
                                        {/* Notifications */}
                                        <div className="p-6 bg-[#0E0E10] border border-[#1A1A1E] rounded-[28px] flex items-center gap-6 group hover:border-[#2A2A2E] transition-all">
                                            <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 group-hover:bg-indigo-500/20 transition-all">
                                                <Bell className="h-6 w-6 text-indigo-400" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-white font-black">Feed Notifications</p>
                                                <p className="text-zinc-500 text-[11px] font-medium leading-relaxed mt-1">Toggle browser and system push notifications for new community activity.</p>
                                            </div>
                                            <button
                                                onClick={toggleNotifications}
                                                className={cn(
                                                    "h-8 w-14 rounded-full border border-white/5 flex items-center px-1 transition-all duration-300",
                                                    notificationsEnabled ? "bg-indigo-600" : "bg-[#1A1A1E]"
                                                )}
                                            >
                                                <div className={cn(
                                                    "h-6 w-6 rounded-full transition-all duration-300 shadow-sm",
                                                    notificationsEnabled ? "bg-white ml-6" : "bg-zinc-600 ml-0"
                                                )} />
                                            </button>
                                        </div>

                                        {/* External Links */}
                                        <div className="p-6 bg-[#0E0E10] border border-[#1A1A1E] rounded-[28px] flex items-center gap-6 group hover:border-[#2A2A2E] transition-all">
                                            <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                                <Share2 className="h-6 w-6 text-emerald-400" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-white font-black">External Portals</p>
                                                <p className="text-zinc-500 text-[11px] font-medium leading-relaxed mt-1">Generate deep-links and QR codes for external cross-relay discovery.</p>
                                            </div>
                                            <Button variant="secondary" className="h-10 rounded-xl bg-[#1A1A1E] border-white/5 font-bold" onClick={() => setIsQrModalOpen(true)}>Generate</Button>
                                        </div>

                                        {/* Key Rotation */}
                                        <div className="p-6 bg-[#0E0E10] border border-[#1A1A1E] rounded-[28px] flex items-center gap-6 group hover:border-[#2A2A2E] transition-all">
                                            <div className="h-14 w-14 rounded-2xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20 group-hover:bg-rose-500/20 transition-all">
                                                <RotateCcw className="h-6 w-6 text-rose-400" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-white font-black">Rotate Room Key</p>
                                                <p className="text-zinc-500 text-[11px] font-medium leading-relaxed mt-1">Generate a new Room Key and distribute it to all non-expelled members via NIP-17 DM.</p>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                onClick={rotateRoomKey}
                                                className="h-10 px-6 rounded-xl bg-rose-500/10 text-rose-500 font-bold gap-2 hover:bg-rose-500/20"
                                            >
                                                <RotateCcw className="h-3.5 w-3.5" /> Rotate
                                            </Button>
                                        </div>

                                        {/* Export & Backup */}
                                        <div className="p-6 bg-[#0E0E10] border border-[#1A1A1E] rounded-[28px] flex items-center gap-6 group hover:border-[#2A2A2E] transition-all">
                                            <div className="h-14 w-14 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                                                <Download className="h-6 w-6 text-amber-400" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-white font-black">Backup Community</p>
                                                <p className="text-zinc-500 text-[11px] font-medium leading-relaxed mt-1">Export community metadata and Room Keys to a secure JSON file.</p>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                onClick={exportCommunity}
                                                className="h-10 px-6 rounded-xl bg-[#1A1A1E] text-white font-bold gap-2 hover:bg-[#252529]"
                                            >
                                                <Download className="h-3.5 w-3.5" /> Backup
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* Danger Zone */}
                                <div className="space-y-6 pt-10 border-t border-white/[0.03]">
                                    <div className="flex items-center gap-3">
                                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500">Hazard Boundary</Label>
                                        <div className="h-px flex-1 bg-gradient-to-r from-rose-500/20 to-transparent" />
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="p-6 bg-rose-500/[0.03] border border-rose-500/10 rounded-[28px] flex items-center justify-between group">
                                            <div className="flex items-center gap-5">
                                                <div className="h-12 w-12 rounded-2xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                                                    <LogOut className="h-5 w-5 text-rose-500" />
                                                </div>
                                                <div>
                                                    <p className="text-white font-black">Sever Connection</p>
                                                    <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest mt-0.5">Leave Community Instance</p>
                                                </div>
                                            </div>
                                            <Button
                                                onClick={() => setIsLeaveConfirmOpen(true)}
                                                className="h-12 px-6 rounded-2xl bg-rose-500/10 text-rose-500 hover:bg-rose-600 hover:text-white border border-rose-500/20 font-black tracking-wide"
                                            >
                                                Leave
                                            </Button>
                                        </div>

                                        {isAdmin && isOwner && (
                                            <div className="p-6 bg-rose-900/10 border border-rose-500/20 rounded-[28px] flex items-center justify-between">
                                                <div className="flex items-center gap-5">
                                                    <div className="h-12 w-12 rounded-2xl bg-rose-600 flex items-center justify-center shadow-lg shadow-rose-600/20">
                                                        <Trash2 className="h-5 w-5 text-white" />
                                                    </div>
                                                    <div>
                                                        <p className="text-white font-black">Total Deletion</p>
                                                        <p className="text-rose-500/60 text-[10px] font-black uppercase tracking-widest mt-0.5">Irreversible Group Destruction</p>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="danger"
                                                    className="h-12 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px]"
                                                    onClick={() => setIsPurgeConfirmOpen(true)}
                                                >
                                                    Purge Community
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Card>

            <Dialog open={isQrModalOpen} onOpenChange={setIsQrModalOpen}>
                <DialogContent className="sm:max-w-md bg-[#0A0A0B] border-white/10 p-0 overflow-hidden rounded-[32px]">
                    <DialogHeader className="p-8 pb-0 text-center">
                        <DialogTitle className="text-white font-black text-xl">Universal Discovery Portal</DialogTitle>
                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-2">Scan to Join Grid</p>
                    </DialogHeader>
                    <div className="p-8">
                        <div className="bg-white p-6 rounded-[32px] shadow-2xl overflow-hidden mb-8 transform hover:scale-[1.02] transition-all">
                            <GroupQRCode
                                groupId={group.groupId}
                                relayUrl={group.relayUrl}
                                groupName={state.metadata?.name || group.displayName}
                                roomKeyHex={roomKeyHex}
                            />
                        </div>
                        <Button
                            className="w-full h-14 bg-indigo-500 hover:bg-indigo-600 text-white rounded-[20px] font-black shadow-xl shadow-indigo-500/20"
                            onClick={() => {
                                const url = `${toAbsoluteAppUrl(getPublicGroupHref(group.groupId, group.relayUrl))}${roomKeyHex ? `#k=${roomKeyHex}` : ""}`;
                                navigator.clipboard.writeText(url);
                                toast.success("Access link copied to clipboard");
                            }}
                        >
                            <Share2 className="h-5 w-5 mr-3" />
                            Copy Access Link
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <InviteMemberDialog
                isOpen={isInviteModalOpen}
                onClose={() => setIsInviteModalOpen(false)}
                groupId={group.groupId}
                roomKeyHex={roomKeyHex || ""}
                communityId={group.communityId}
                genesisEventId={group.genesisEventId}
                creatorPubkey={group.creatorPubkey}
                currentMemberPubkeys={members}
                metadata={{
                    id: group.groupId,
                    name: state.metadata?.name || group.displayName,
                    about: state.metadata?.about || "",
                    picture: state.metadata?.picture || "",
                    access: state.metadata?.access || "invite-only"
                }}
            />

            <ConfirmDialog
                isOpen={isLeaveConfirmOpen}
                onClose={() => setIsLeaveConfirmOpen(false)}
                onConfirm={handleLeave}
                title="Sever Connection"
                description={`Are you sure you want to leave "${group.displayName}"? You will no longer receive updates from this instance.`}
                confirmLabel="Sever Connection"
                cancelLabel="Cancel"
                variant="danger"
                isLoading={isProcessing}
            />

            <ConfirmDialog
                isOpen={isPurgeConfirmOpen}
                onClose={() => setIsPurgeConfirmOpen(false)}
                onConfirm={handlePurge}
                title="Irreversible Purge"
                description={`Are you absolutely sure you want to DESTROY "${group.displayName}"? This action is irreversible and will remove all local traces of this community.`}
                confirmLabel="Destroy Everything"
                cancelLabel="Abstain"
                variant="danger"
                isLoading={isProcessing}
            />
        </div>
    );
}
