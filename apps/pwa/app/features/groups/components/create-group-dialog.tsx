"use client";

import React, { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { useTranslation } from "react-i18next";
import { Users, Info, Camera, X, Check, Globe, Lock } from "lucide-react";
import { useUploadService } from "@/app/features/messaging/lib/upload-service";
import { cn } from "@dweb/ui-kit";
import Image from "next/image";
import type { GroupAccessMode } from "../types";

export interface GroupCreateInfo {
    host: string;
    groupId: string;
    name: string;
    about: string;
    avatar?: string;
    access: GroupAccessMode;
}

interface CreateGroupDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (info: GroupCreateInfo) => void;
    isCreating?: boolean;
}

export function CreateGroupDialog({ isOpen, onClose, onCreate, isCreating }: CreateGroupDialogProps) {
    const { t } = useTranslation();
    const { uploadFile, pickFiles } = useUploadService();
    const [isUploading, setIsUploading] = useState(false);

    const [info, setInfo] = useState<GroupCreateInfo>(() => ({
        host: "nos.lol", // Default host suggestion
        groupId: typeof crypto !== "undefined" ? crypto.randomUUID().replace(/-/g, "") : Math.random().toString(36).substring(2),
        name: "",
        about: "",
        avatar: "",
        access: "invite-only",
    }));

    const RELAY_SUGGESTIONS = [
        { url: "nos.lol", type: "General" },
        { url: "groups.fiatjaf.com", type: "NIP-29" },
        { url: "relay.nostr.band", type: "General" },
        { url: "relay.damus.io", type: "General" },
    ];

    const isValid =
        info.host.trim().length > 0 &&
        info.groupId.trim().length > 0 &&
        info.name.trim().length > 0;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-in fade-in duration-200">
            <Card
                className="w-full max-w-lg bg-white dark:bg-[#0a0a0c] border-zinc-200 dark:border-[#1a1a1c] shadow-2xl p-0 overflow-hidden rounded-[24px]"
            >
                <div className="p-6 space-y-8">
                    {/* Header */}
                    <div className="space-y-1">
                        <h2 className="text-xl font-black text-zinc-900 dark:text-white">{t("groups.createTitle", "Create New Group")}</h2>
                        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{t("groups.createDescription", "Start a new relay-based group chat.")}</p>
                    </div>
                    <div className="space-y-6">
                        <div className="flex gap-6 items-start">
                            <div className="flex-1 space-y-4">
                                {/* Host Section */}
                                <div className="space-y-3">
                                    <Label htmlFor="group-host" className="text-[11px] font-black uppercase tracking-widest text-zinc-400">
                                        {t("groups.hostLabel", "Relay Host")}
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="group-host"
                                            value={info.host}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInfo(prev => ({ ...prev, host: e.target.value }))}
                                            placeholder="e.g. groups.fiatjaf.com"
                                            className="bg-zinc-50 dark:bg-[#121214] border-zinc-200 dark:border-[#222224] text-zinc-900 dark:text-white rounded-2xl h-12 focus-visible:ring-purple-500/50"
                                        />
                                        <div className="flex flex-wrap gap-2 mt-3">
                                            {RELAY_SUGGESTIONS.map(relay => (
                                                <button
                                                    key={relay.url}
                                                    type="button"
                                                    onClick={() => setInfo(prev => ({ ...prev, host: relay.url }))}
                                                    className={cn(
                                                        "text-[10px] px-3 py-1.5 rounded-xl border transition-all font-bold",
                                                        info.host === relay.url
                                                            ? "bg-purple-500/10 dark:bg-purple-900/40 border-purple-500/50 text-purple-600 dark:text-purple-400"
                                                            : "bg-white dark:bg-[#121214] border-zinc-200 dark:border-[#222224] text-zinc-500 hover:border-zinc-300 dark:hover:border-[#333336] hover:text-zinc-700 dark:hover:text-zinc-300"
                                                    )}
                                                >
                                                    {relay.url} <span className="opacity-50 font-medium">({relay.type})</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Avatar Section */}
                            <div className="flex flex-col items-center gap-3 pt-6 shrink-0">
                                <button
                                    type="button"
                                    disabled={isUploading || isCreating}
                                    onClick={async () => {
                                        setIsUploading(true);
                                        try {
                                            const files = await pickFiles();
                                            const file = files?.[0];
                                            if (file) {
                                                const result = await uploadFile(file);
                                                setInfo(prev => ({ ...prev, avatar: result.url }));
                                            }
                                        } catch (error) {
                                            console.error("Failed to upload avatar:", error);
                                        } finally {
                                            setIsUploading(false);
                                        }
                                    }}
                                    className="group relative h-[100px] w-[100px] rounded-[32px] bg-zinc-50 dark:bg-[#121214] flex items-center justify-center border-2 border-dashed border-zinc-200 dark:border-[#222224] hover:border-purple-500/50 transition-colors overflow-hidden shrink-0"
                                >
                                    {info.avatar ? (
                                        <Image src={info.avatar} alt="Group avatar" fill unoptimized className="object-cover" />
                                    ) : (
                                        <Camera className="h-8 w-8 text-zinc-400 dark:text-zinc-600 group-hover:text-purple-500 dark:group-hover:text-purple-400 transition-colors" />
                                    )}
                                    {isUploading && (
                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                        </div>
                                    )}
                                </button>
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t("common.avatar", "Avatar")}</span>
                            </div>
                        </div>

                        {/* Name Section */}
                        <div className="space-y-3">
                            <Label htmlFor="group-name" className="text-[11px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                                {t("groups.nameLabel", "Group Name")}
                            </Label>
                            <Input
                                id="group-name"
                                value={info.name}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInfo(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Club1"
                                className="bg-zinc-50 dark:bg-[#121214] border-zinc-200 dark:border-[#222224] text-zinc-900 dark:text-white rounded-2xl h-12 focus-visible:ring-purple-500/50 text-base"
                            />
                        </div>

                        {/* About Section */}
                        <div className="space-y-3">
                            <Label htmlFor="group-about" className="text-[11px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                                {t("groups.aboutLabel", "Description")}
                            </Label>
                            <Textarea
                                id="group-about"
                                value={info.about}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInfo(prev => ({ ...prev, about: e.target.value }))}
                                placeholder="What is this group about?"
                                className="bg-zinc-50 dark:bg-[#121214] border-zinc-200 dark:border-[#222224] text-zinc-900 dark:text-white rounded-2xl min-h-[100px] resize-none focus-visible:ring-purple-500/50 placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                            />
                        </div>

                        <div className="space-y-3">
                            <Label className="text-[11px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                                {t("groups.privacyLabel", "Privacy Policy")}
                            </Label>
                            <div className="flex bg-zinc-50 dark:bg-[#121214] border border-zinc-200 dark:border-[#222224] rounded-[20px] p-1.5 gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setInfo(prev => ({ ...prev, access: "open" }))}
                                    className={cn(
                                        "flex-1 flex flex-col items-center justify-center py-3 rounded-[16px] transition-all",
                                        info.access === "open"
                                            ? "bg-white dark:bg-[#222224] text-zinc-900 dark:text-zinc-100 shadow-sm border border-zinc-200 dark:border-transparent"
                                            : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-[#1a1a1c] hover:text-zinc-700 dark:hover:text-zinc-400"
                                    )}
                                >
                                    <Globe className={cn("h-5 w-5 mb-2", info.access === "open" ? "text-purple-400" : "opacity-70")} />
                                    <span className={cn("text-[11px]", info.access === "open" ? "font-black" : "font-medium")}>Open</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setInfo(prev => ({ ...prev, access: "discoverable" }))}
                                    className={cn(
                                        "flex-1 flex flex-col items-center justify-center py-3 rounded-[16px] transition-all",
                                        info.access === "discoverable"
                                            ? "bg-white dark:bg-[#222224] text-zinc-900 dark:text-zinc-100 shadow-sm border border-zinc-200 dark:border-transparent"
                                            : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-[#1a1a1c] hover:text-zinc-700 dark:hover:text-zinc-400"
                                    )}
                                >
                                    <Users className={cn("h-5 w-5 mb-2", info.access === "discoverable" ? "text-purple-400" : "opacity-70")} />
                                    <span className={cn("text-[11px]", info.access === "discoverable" ? "font-black" : "font-medium")}>Discoverable</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setInfo(prev => ({ ...prev, access: "invite-only" }))}
                                    className={cn(
                                        "flex-1 flex flex-col items-center justify-center py-3 rounded-[16px] transition-all",
                                        info.access === "invite-only"
                                            ? "bg-white dark:bg-[#222224] text-zinc-900 dark:text-zinc-100 shadow-sm border border-zinc-200 dark:border-transparent"
                                            : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-[#1a1a1c] hover:text-zinc-700 dark:hover:text-zinc-400"
                                    )}
                                >
                                    <Lock className={cn("h-5 w-5 mb-2", info.access === "invite-only" ? "text-rose-400" : "opacity-70")} />
                                    <span className={cn("text-[11px]", info.access === "invite-only" ? "font-black" : "font-medium")}>Invite-Only</span>
                                </button>
                            </div>
                            <p className="text-[12px] text-zinc-500 text-center font-medium pt-2">
                                {info.access === "open" && "Public room key. Anyone with the link can join and read instantly."}
                                {info.access === "discoverable" && "Visible prefix on relay. Users can request a room key via DM."}
                                {info.access === "invite-only" && "Secret Community. No traces on relay. Join only via direct invite."}
                            </p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex gap-4 p-6 pt-2">
                        <Button
                            variant="ghost"
                            onClick={onClose}
                            disabled={isCreating}
                            className="flex-1 h-14 rounded-[16px] bg-zinc-50 dark:bg-[#121214] hover:bg-zinc-100 dark:hover:bg-[#1a1a1c] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-[#222224] font-black tracking-wide transition-all shadow-none"
                        >
                            <X className="h-5 w-5 mr-2" />
                            {t("common.cancel")}
                        </Button>
                        <Button
                            onClick={() => onCreate(info)}
                            disabled={!isValid || isCreating}
                            className="flex-1 h-14 rounded-[16px] bg-[#6366f1] hover:bg-[#4f46e5] text-white font-black tracking-wide disabled:opacity-50 disabled:bg-zinc-200 dark:disabled:bg-[#222224] disabled:text-zinc-400 dark:disabled:text-zinc-500 transition-all text-sm shadow-none"
                        >
                            {isCreating ? (
                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white mr-2" />
                            ) : (
                                <Check className="h-5 w-5 mr-2" />
                            )}
                            {t("common.create")}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}

