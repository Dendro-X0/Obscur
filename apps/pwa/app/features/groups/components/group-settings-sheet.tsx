"use client";

import React, { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Label } from "../../../components/ui/label";
import { useTranslation } from "react-i18next";
import { UserPlus, UserMinus, Shield, ShieldCheck, X, Camera, Info, Users, Edit2, Check, Loader2 } from "lucide-react";
import type { GroupConversation } from "../../messaging/types";
import { useNip29Group } from "../hooks/use-nip29-group";
import { useUploadService } from "@/app/features/messaging/lib/upload-service";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { toast } from "../../../components/ui/toast";
import { cn } from "../../../lib/cn";
import { ConfirmDialog } from "../../../components/ui/confirm-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "../../../components/ui/dropdown-menu";
import { MoreVertical, UserCog } from "lucide-react";

import { GroupQRCode } from "./group-qr-code";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { QrCode, Share2 } from "lucide-react";

interface GroupSettingsSheetProps {
    isOpen: boolean;
    onClose: () => void;
    group: GroupConversation;
    pool: any; // NostrPool
    myPublicKeyHex: PublicKeyHex | null;
    myPrivateKeyHex: any; // PrivateKeyHex
}

export function GroupSettingsSheet({ isOpen, onClose, group, pool, myPublicKeyHex, myPrivateKeyHex }: GroupSettingsSheetProps) {
    const { t } = useTranslation();
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
        admins
    } = useNip29Group({
        groupId: group.groupId,
        relayUrl: group.relayUrl,
        pool,
        myPublicKeyHex,
        myPrivateKeyHex,
    });

    const { uploadFile, pickFiles } = useUploadService();
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editName, setEditName] = useState("");
    const [editAbout, setEditAbout] = useState("");
    const [editPicture, setEditPicture] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const [newMemberPubkey, setNewMemberPubkey] = useState("");
    const [isAddingMember, setIsAddingMember] = useState(false);
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);
    const [memberSearchQuery, setMemberSearchQuery] = useState("");
    const [resolvedNames, setResolvedNames] = useState<Record<string, string>>({});

    const [confirmAction, setConfirmAction] = useState<{
        title: string;
        description: string;
        onConfirm: () => void | Promise<void>;
        isOpen: boolean;
        variant?: "danger" | "primary";
    }>({
        title: "",
        description: "",
        onConfirm: () => { },
        isOpen: false
    });

    React.useEffect(() => {
        if (!isOpen || !group.memberPubkeys.length || !pool) return;
        const subId = `metadata-${Math.random().toString(36).substring(7)}`;
        const filter = { kinds: [0], authors: group.memberPubkeys };
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
    }, [isOpen, group.memberPubkeys, pool]);

    if (!isOpen) return null;

    const isAdmin = state.membership.role === "owner" || state.membership.role === "moderator";

    const handleStartEdit = () => {
        setEditName(state.metadata?.name || group.displayName);
        setEditAbout(state.metadata?.about || "");
        setEditPicture(state.metadata?.picture || "");
        setIsEditing(true);
    };

    const handleSaveEdit = async () => {
        setIsSaving(true);
        try {
            await updateMetadata({
                name: editName,
                about: editAbout,
                picture: editPicture
            });
            setIsEditing(false);
            toast.success("Group info updated");
        } catch (error) {
            console.error("Failed to update group metadata:", error);
            toast.error("Failed to update group info");
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddMember = async () => {
        if (!newMemberPubkey.trim()) return;
        try {
            await putUser({ publicKeyHex: newMemberPubkey.trim() as PublicKeyHex });
            setNewMemberPubkey("");
            setIsAddingMember(false);
            toast.success("Member added to group");
        } catch (error) {
            console.error("Failed to add member:", error);
            toast.error("Failed to add member");
        }
    };

    const handleRemoveMember = async (pubkey: string) => {
        try {
            await removeUser({ publicKeyHex: pubkey as PublicKeyHex });
            toast.success("Member removed from group");
        } catch (error) {
            console.error("Failed to remove member:", error);
            toast.error("Failed to remove member");
        }
    };

    return (
        <div className="fixed inset-y-0 right-0 z-[110] w-full max-w-sm bg-white dark:bg-zinc-950 shadow-2xl border-l border-black/5 dark:border-white/5 animate-in slide-in-from-right duration-300">
            <div className="flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-black/5 dark:border-white/5">
                    <h2 className="font-bold text-lg">{t("groups.groupSettings", "Group Info")}</h2>
                    <Button variant="secondary" size="icon" onClick={onClose} className="rounded-full h-8 w-8">
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-8">
                    {/* Metadata Section */}
                    <div className="flex flex-col items-center text-center space-y-3 relative group/avatar">
                        <div className="relative">
                            <div className="h-24 w-24 rounded-[32px] bg-gradient-to-br from-zinc-800 to-black dark:from-zinc-200 dark:to-white flex items-center justify-center shadow-xl overflow-hidden">
                                {isEditing ? (
                                    editPicture ? (
                                        <img src={editPicture} alt="Group avatar" className="h-full w-full object-cover" />
                                    ) : (
                                        <Camera className="h-8 w-8 text-zinc-400" />
                                    )
                                ) : (
                                    (state.metadata?.picture) ? (
                                        <img src={state.metadata.picture} alt="Group avatar" className="h-full w-full object-cover" />
                                    ) : (
                                        <span className="text-4xl font-black text-white dark:text-black">
                                            {state.metadata?.name?.[0] || group.displayName[0]}
                                        </span>
                                    )
                                )}
                            </div>
                            {isEditing && (
                                <button
                                    type="button"
                                    disabled={isUploading}
                                    onClick={async () => {
                                        setIsUploading(true);
                                        try {
                                            const files = await pickFiles();
                                            const file = files?.[0];
                                            if (file) {
                                                const result = await uploadFile(file);
                                                setEditPicture(result.url);
                                            }
                                        } catch (error) {
                                            console.error("Failed to upload avatar:", error);
                                            toast.error("Failed to upload image");
                                        } finally {
                                            setIsUploading(false);
                                        }
                                    }}
                                    className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-[32px] cursor-pointer opacity-0 hover:opacity-100 transition-opacity"
                                >
                                    {isUploading ? <Loader2 className="h-6 w-6 text-white animate-spin" /> : <Camera className="h-6 w-6 text-white" />}
                                </button>
                            )}
                        </div>

                        <div className="w-full space-y-2">
                            {isEditing ? (
                                <>
                                    <Input
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        placeholder="Group Name"
                                        className="text-center font-bold"
                                    />
                                    <Textarea
                                        value={editAbout}
                                        onChange={(e) => setEditAbout(e.target.value)}
                                        placeholder="Description"
                                        className="min-h-[80px]"
                                    />
                                    <div className="flex gap-2 justify-center pt-2">
                                        <Button size="sm" variant="secondary" onClick={() => setIsEditing(false)} disabled={isSaving}>Cancel</Button>
                                        <Button size="sm" onClick={handleSaveEdit} disabled={isSaving}>
                                            {isSaving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                                            Save
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="relative group/title">
                                        <h3 className="text-xl font-bold">{state.metadata?.name || group.displayName}</h3>
                                        {isAdmin && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover/title:opacity-100 h-6 w-6"
                                                onClick={handleStartEdit}
                                            >
                                                <Edit2 className="h-3 w-3" />
                                            </Button>
                                        )}
                                    </div>
                                    <p className="text-xs text-zinc-500 font-mono">{group.groupId}@{new URL(group.relayUrl).hostname}</p>
                                    {state.metadata?.about && (
                                        <p className="text-sm text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-2xl w-full">
                                            {state.metadata.about}
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Status Section */}
                    <div className="space-y-3">
                        <Label className="text-xs font-bold uppercase tracking-widest text-zinc-500 px-1">
                            {t("groups.yourStatus", "Your Status")}
                        </Label>
                        <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-2xl border border-purple-100 dark:border-purple-900/30">
                            {isAdmin ? <ShieldCheck className="h-5 w-5 text-purple-600" /> : <Users className="h-5 w-5 text-zinc-400" />}
                            <div className="flex-1">
                                <p className="text-sm font-bold capitalize text-purple-900 dark:text-purple-100">{state.membership.role}</p>
                                <p className="text-[10px] text-purple-600/70">{state.membership.status}</p>
                            </div>
                        </div>
                    </div>

                    {/* Join Requests (Admin Only) */}
                    {isAdmin && state.joinRequests.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between px-1">
                                <Label className="text-xs font-bold uppercase tracking-widest text-rose-500">
                                    {t("groups.joinRequests", "Join Requests")} ({state.joinRequests.length})
                                </Label>
                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-[9px] font-black uppercase text-rose-500"
                                        onClick={() => setConfirmAction({
                                            isOpen: true,
                                            title: "Deny All Requests?",
                                            description: "This will reject all currently pending join requests.",
                                            variant: "danger",
                                            onConfirm: async () => {
                                                await denyAllJoinRequests();
                                                toast.success("All requests denied");
                                                setConfirmAction(prev => ({ ...prev, isOpen: false }));
                                            }
                                        })}
                                    >
                                        Deny All
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-[9px] font-black uppercase text-emerald-600"
                                        onClick={() => setConfirmAction({
                                            isOpen: true,
                                            title: "Approve All Requests?",
                                            description: "This will accept all currently pending join requests into the community.",
                                            onConfirm: async () => {
                                                await approveAllJoinRequests();
                                                toast.success("All requests approved");
                                                setConfirmAction(prev => ({ ...prev, isOpen: false }));
                                            }
                                        })}
                                    >
                                        Approve All
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {state.joinRequests.map((req) => (
                                    <div key={req.pubkey} className="flex items-center gap-3 p-3 bg-rose-50 dark:bg-rose-950/20 rounded-2xl border border-rose-100 dark:border-rose-900/30">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-mono truncate">{req.pubkey}</p>
                                        </div>
                                        <div className="flex gap-1">
                                            <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full" onClick={() => denyJoin({ publicKeyHex: req.pubkey })}>
                                                <X className="h-3 w-3 text-rose-600" />
                                            </Button>
                                            <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full" onClick={() => approveJoin({ publicKeyHex: req.pubkey })}>
                                                <ShieldCheck className="h-3 w-3 text-emerald-600" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Member List */}
                    <div className="flex items-center justify-between px-1">
                        <Label className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                            {t("groups.members", "Members")}
                        </Label>
                        {isAdmin && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[10px] font-black uppercase tracking-widest text-purple-600 hover:text-purple-700 p-0"
                                onClick={() => setIsAddingMember(!isAddingMember)}
                            >
                                {isAddingMember ? "Cancel" : "Add Member"}
                            </Button>
                        )}
                    </div>

                    {isAddingMember && (
                        <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-black/5 dark:border-white/5 space-y-2 animate-in zoom-in-95 duration-200">
                            <Input
                                value={newMemberPubkey}
                                onChange={(e) => setNewMemberPubkey(e.target.value)}
                                placeholder="Enter public key (hex)"
                                className="text-xs font-mono"
                            />
                            <Button className="w-full h-8 text-[10px] font-black uppercase tracking-widest" onClick={handleAddMember}>
                                Confirm Add
                            </Button>
                        </div>
                    )}

                    <div className="space-y-4 py-2">
                        <div className="flex items-center justify-between px-1">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                {t("groups.members", "Members List")}
                            </Label>
                            <span className="text-[9px] font-black text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 px-2.5 py-1 rounded-full border border-purple-100 dark:border-purple-900/30">
                                {group.memberPubkeys.length} community members
                            </span>
                        </div>

                        <div className="relative group/filter">
                            <Input
                                placeholder="Filter members by public key..."
                                value={memberSearchQuery}
                                onChange={(e) => setMemberSearchQuery(e.target.value)}
                                className="h-10 text-xs bg-black/[0.02] dark:bg-white/[0.02] border-transparent focus-visible:bg-white dark:focus-visible:bg-zinc-900 transition-all rounded-2xl pl-9"
                            />
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 group-focus-within/filter:text-purple-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>

                    <div className="space-y-1">
                        {group.memberPubkeys
                            .filter(pubkey => {
                                const q = memberSearchQuery.toLowerCase();
                                const name = (resolvedNames[pubkey] || "").toLowerCase();
                                return pubkey.toLowerCase().includes(q) || name.includes(q);
                            })
                            .map((pubkey) => {
                                const admin = admins.find(a => a.pubkey === pubkey);
                                const isOwner = admin?.roles.some(r => r.toLowerCase() === "owner" || r.toLowerCase() === "admin");
                                const isModerator = admin && !isOwner;

                                return (
                                    <div key={pubkey} className="flex items-center gap-4 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-2xl transition-colors group/member">
                                        <div className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center ring-1 ring-black/5 dark:ring-white/5 relative shadow-sm">
                                            <Shield className={cn("h-4 w-4", isOwner ? "text-purple-600" : isModerator ? "text-emerald-600" : "text-zinc-400")} />
                                            {isOwner && <div className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-purple-600 border-2 border-white dark:border-zinc-950 shadow-sm" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-xs font-bold truncate">
                                                    {resolvedNames[pubkey] || `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`}
                                                </p>
                                                {isOwner && (
                                                    <span className="text-[8px] font-black uppercase tracking-tighter bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-sm">Owner</span>
                                                )}
                                                {isModerator && (
                                                    <span className="text-[8px] font-black uppercase tracking-tighter bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-sm">Mod</span>
                                                )}
                                            </div>
                                        </div>
                                        {isAdmin && pubkey !== myPublicKeyHex && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 rounded-full opacity-0 group-hover/member:opacity-100"
                                                    >
                                                        <MoreVertical className="h-4 w-4 text-zinc-400" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48 rounded-2xl p-1 shadow-xl">
                                                    <DropdownMenuLabel className="text-[9px] uppercase tracking-widest text-zinc-400 px-2 py-1.5 font-black">
                                                        Moderation
                                                    </DropdownMenuLabel>

                                                    {/* Promotion Logic: Only Owners can promote to Owner/Mod. Mods can't promote. */}
                                                    {state.membership.role === "owner" && (
                                                        <>
                                                            {!isOwner && !isModerator && (
                                                                <DropdownMenuItem
                                                                    className="rounded-xl flex gap-2 font-bold cursor-pointer"
                                                                    onClick={() => promoteUser({ publicKeyHex: pubkey as PublicKeyHex, role: "moderator" })}
                                                                >
                                                                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                                                                    Promote to Mod
                                                                </DropdownMenuItem>
                                                            )}
                                                            {!isOwner && (
                                                                <DropdownMenuItem
                                                                    className="rounded-xl flex gap-2 font-bold cursor-pointer"
                                                                    onClick={() => promoteUser({ publicKeyHex: pubkey as PublicKeyHex, role: "owner" })}
                                                                >
                                                                    <Shield className="h-3.5 w-3.5 text-purple-600" />
                                                                    Promote to Owner
                                                                </DropdownMenuItem>
                                                            )}
                                                            {(isOwner || isModerator) && (
                                                                <DropdownMenuItem
                                                                    className="rounded-xl flex gap-2 font-bold cursor-pointer"
                                                                    onClick={() => demoteUser({ publicKeyHex: pubkey as PublicKeyHex })}
                                                                >
                                                                    <UserCog className="h-3.5 w-3.5 text-zinc-500" />
                                                                    Demote to Member
                                                                </DropdownMenuItem>
                                                            )}
                                                            <DropdownMenuSeparator className="bg-black/5 dark:bg-white/5" />
                                                        </>
                                                    )}

                                                    <DropdownMenuItem
                                                        className="rounded-xl flex gap-2 font-bold text-rose-500 focus:text-rose-600 focus:bg-rose-50 cursor-pointer"
                                                        onClick={() => setConfirmAction({
                                                            isOpen: true,
                                                            title: "Remove User?",
                                                            description: `Are you sure you want to remove ${pubkey.slice(0, 8)}... from the community?`,
                                                            variant: "danger",
                                                            onConfirm: async () => {
                                                                await removeUser({ publicKeyHex: pubkey as PublicKeyHex });
                                                                toast.success("User removed");
                                                                setConfirmAction(prev => ({ ...prev, isOpen: false }));
                                                            }
                                                        })}
                                                    >
                                                        <UserMinus className="h-3.5 w-3.5" />
                                                        Remove Member
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </div>
                                );
                            })}
                        {group.memberPubkeys.length === 0 && (
                            <p className="text-xs text-zinc-400 text-center py-4 italic">No members listed yet.</p>
                        )}
                    </div>
                </div>

                {/* Footer and Dialogs */}
                <ConfirmDialog
                    isOpen={confirmAction.isOpen}
                    onClose={() => setConfirmAction(prev => ({ ...prev, isOpen: false }))}
                    onConfirm={confirmAction.onConfirm}
                    title={confirmAction.title}
                    description={confirmAction.description}
                    variant={confirmAction.variant}
                />
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-black/5 dark:border-white/5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <Button
                        variant="secondary"
                        className="rounded-2xl gap-2 font-bold h-11 shadow-sm border-black/5 dark:border-white/5"
                        onClick={() => setIsQrModalOpen(true)}
                    >
                        <QrCode className="h-4 w-4" />
                        Show QR
                    </Button>
                    <Button
                        variant="secondary"
                        className="rounded-2xl gap-2 font-bold h-11 shadow-sm border-black/5 dark:border-white/5"
                        onClick={async () => {
                            const url = `https://obscur-pwa.vercel.app/groups/${group.groupId}?relay=${encodeURIComponent(group.relayUrl)}`;
                            if (navigator.share) {
                                try {
                                    await navigator.share({
                                        title: `Join ${state.metadata?.name || group.displayName} on Obscur`,
                                        url
                                    });
                                } catch (err) {
                                    console.error("Share failed:", err);
                                }
                            } else {
                                navigator.clipboard.writeText(url);
                                toast.success("Invite link copied");
                            }
                        }}
                    >
                        <Share2 className="h-4 w-4" />
                        Share
                    </Button>
                </div>
                <Button variant="secondary" className="w-full h-11 rounded-2xl gap-2 font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-black/[0.03] dark:border-white/[0.03]">
                    <UserMinus className="h-4 w-4" />
                    {t("groups.leaveGroup", "Leave Group")}
                </Button>
            </div>

            <Dialog open={isQrModalOpen} onOpenChange={setIsQrModalOpen}>
                <DialogContent className="sm:max-w-md bg-white dark:bg-zinc-950 border-white/10 p-0 overflow-hidden rounded-[32px]">
                    <DialogHeader className="p-6 pb-0">
                        <DialogTitle className="text-center sr-only">Group Invite QR</DialogTitle>
                    </DialogHeader>
                    <GroupQRCode
                        groupId={group.groupId}
                        relayUrl={group.relayUrl}
                        groupName={state.metadata?.name || group.displayName}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}
