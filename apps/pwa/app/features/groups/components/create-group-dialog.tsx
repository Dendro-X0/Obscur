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
import { useRelayList } from "@/app/features/relays/hooks/use-relay-list";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { cn } from "@/app/lib/utils";
import Image from "next/image";
import { ChevronDown, Zap } from "lucide-react";
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

    const identity = useIdentity();
    const relayList = useRelayList({ publicKeyHex: identity.state.publicKeyHex || null });

    const RELAY_SUGGESTIONS = [
        { url: "nos.lol", type: "General" },
        { url: "groups.fiatjaf.com", type: "NIP-29" },
        { url: "relay.nostr.band", type: "General" },
        { url: "relay.damus.io", type: "General" },
    ];

    const allRelays = React.useMemo(() => {
        const consolidated = [...RELAY_SUGGESTIONS.map(r => ({ url: r.url, type: r.type, isSuggestion: true }))];

        relayList.state.relays.forEach(r => {
            const hostname = r.url.replace(/^wss?:\/\//, "").replace(/\/$/, "");
            if (!consolidated.some(c => c.url === hostname)) {
                consolidated.push({ url: hostname, type: "Custom", isSuggestion: false });
            }
        });

        return consolidated;
    }, [relayList.state.relays]);

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
                <div className="p-6 sm:p-8 space-y-10">
                    {/* Header */}
                    <div className="flex flex-col items-center text-center space-y-2">
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
                            <Users className="h-6 w-6 text-primary" />
                        </div>
                        <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight leading-none italic">{t("groups.createTitle", "Create New Group")}</h2>
                        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 max-w-[280px]">{t("groups.createDescription", "Start a new relay-based group chat.")}</p>
                    </div>

                    <div className="space-y-8">
                        {/* Avatar Section - Centered */}
                        <div className="flex flex-col items-center gap-4">
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
                                className={cn(
                                    "group relative h-28 w-28 rounded-[40px] flex items-center justify-center border-2 border-dashed transition-all duration-300 overflow-hidden shadow-sm",
                                    info.avatar
                                        ? "bg-transparent border-transparent"
                                        : "bg-zinc-50 dark:bg-[#121214] border-zinc-200 dark:border-[#222224] hover:border-primary/50"
                                )}
                            >
                                {info.avatar ? (
                                    <Image src={info.avatar} alt="Group avatar" fill unoptimized className="object-cover rounded-[40px]" />
                                ) : (
                                    <div className="flex flex-col items-center gap-2">
                                        <Camera className="h-8 w-8 text-zinc-400 dark:text-zinc-600 group-hover:text-primary transition-colors" />
                                    </div>
                                )}
                                {isUploading && (
                                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center rounded-[40px]">
                                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    </div>
                                )}
                                <div className="absolute inset-x-0 bottom-0 py-2 bg-black/20 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-b-[40px]">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white leading-none">Upload</span>
                                </div>
                            </button>
                        </div>

                        {/* Form Fields - Symmetrical Column */}
                        <div className="space-y-6 max-w-sm mx-auto">
                            {/* Host Section */}
                            <div className="space-y-2.5">
                                <Label htmlFor="group-host" className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 px-1">
                                    {t("groups.hostLabel", "Relay Host")}
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="group-host"
                                        value={info.host}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInfo(prev => ({ ...prev, host: e.target.value }))}
                                        placeholder="e.g. groups.fiatjaf.com"
                                        className="bg-zinc-50 dark:bg-[#121214] border-zinc-200 dark:border-[#222224] text-zinc-900 dark:text-white rounded-2xl h-14 focus-visible:ring-primary/40 pr-32 font-medium"
                                    />
                                    <div className="absolute right-1.5 top-1.5 bottom-1.5">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    className="h-full px-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-primary dark:text-primary hover:bg-primary/10"
                                                >
                                                    {t("common.select", "Select")}
                                                    <ChevronDown className="ml-2 h-3 w-3" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent
                                                align="end"
                                                className="z-[200] w-64 rounded-3xl p-2 bg-white/95 dark:bg-[#0a0a0c]/95 backdrop-blur-2xl border border-zinc-200 dark:border-[#1a1a1c] shadow-2xl"
                                            >
                                                <div className="px-4 py-3 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">
                                                    {t("groups.availableRelays", "Available Relays")}
                                                </div>
                                                <div className="max-h-[280px] overflow-y-auto scrollbar-hide space-y-1">
                                                    {allRelays.map((relay) => (
                                                        <DropdownMenuItem
                                                            key={relay.url}
                                                            onClick={() => setInfo(prev => ({ ...prev, host: relay.url }))}
                                                            className={cn(
                                                                "flex items-center justify-between px-3.5 py-3 rounded-2xl cursor-pointer transition-all",
                                                                info.host === relay.url
                                                                    ? "bg-primary/10 text-primary"
                                                                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#121214]"
                                                            )}
                                                        >
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className="text-sm font-bold truncate max-w-[140px]">{relay.url}</span>
                                                                <span className="text-[9px] opacity-60 font-medium uppercase tracking-wider">{relay.type}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {relay.type === "NIP-29" && (
                                                                    <div className="h-5 w-5 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                                                        <Zap className="h-3 w-3 text-emerald-500" />
                                                                    </div>
                                                                )}
                                                                {info.host === relay.url && (
                                                                    <Check className="h-4 w-4 text-primary" />
                                                                )}
                                                            </div>
                                                        </DropdownMenuItem>
                                                    ))}
                                                </div>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            </div>

                            {/* Name Section */}
                            <div className="space-y-2.5">
                                <Label htmlFor="group-name" className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 px-1">
                                    {t("groups.nameLabel", "Group Name")}
                                </Label>
                                <Input
                                    id="group-name"
                                    value={info.name}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInfo(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Enter community name"
                                    className="bg-zinc-50 dark:bg-[#121214] border-zinc-200 dark:border-[#222224] text-zinc-900 dark:text-white rounded-2xl h-14 focus-visible:ring-primary/40 text-base font-medium"
                                />
                            </div>

                            {/* About Section */}
                            <div className="space-y-2.5">
                                <Label htmlFor="group-about" className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 px-1">
                                    {t("groups.aboutLabel", "Description")}
                                </Label>
                                <Textarea
                                    id="group-about"
                                    value={info.about}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInfo(prev => ({ ...prev, about: e.target.value }))}
                                    placeholder="What is this group about?"
                                    className="bg-zinc-50 dark:bg-[#121214] border-zinc-200 dark:border-[#222224] text-zinc-900 dark:text-white rounded-2xl min-h-[100px] py-4 resize-none focus-visible:ring-primary/40 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 font-medium"
                                />
                            </div>

                            {/* Privacy Policy Section */}
                            <div className="space-y-4 pt-2">
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 px-1 block text-center">
                                    {t("groups.privacyLabel", "Privacy Policy")}
                                </Label>
                                <div className="flex bg-zinc-50 dark:bg-[#121214] border border-zinc-200 dark:border-[#222224] rounded-[24px] p-1.5 gap-1.5 shadow-inner">
                                    <button
                                        type="button"
                                        onClick={() => setInfo(prev => ({ ...prev, access: "open" }))}
                                        className={cn(
                                            "flex-1 flex flex-col items-center justify-center py-4 rounded-[20px] transition-all duration-300",
                                            info.access === "open"
                                                ? "bg-white dark:bg-[#222224] text-zinc-900 dark:text-zinc-100 shadow-md border border-zinc-200 dark:border-zinc-700/50"
                                                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                        )}
                                    >
                                        <Globe className={cn("h-5 w-5 mb-2 transition-transform", info.access === "open" ? "text-primary scale-110" : "opacity-30")} />
                                        <span className={cn("text-[10px] tracking-wider uppercase", info.access === "open" ? "font-black" : "font-bold opacity-60")}>Open</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setInfo(prev => ({ ...prev, access: "discoverable" }))}
                                        className={cn(
                                            "flex-1 flex flex-col items-center justify-center py-4 rounded-[20px] transition-all duration-300",
                                            info.access === "discoverable"
                                                ? "bg-white dark:bg-[#222224] text-zinc-900 dark:text-zinc-100 shadow-md border border-zinc-200 dark:border-zinc-700/50"
                                                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                        )}
                                    >
                                        <Users className={cn("h-5 w-5 mb-2 transition-transform", info.access === "discoverable" ? "text-primary scale-110" : "opacity-30")} />
                                        <span className={cn("text-[10px] tracking-wider uppercase", info.access === "discoverable" ? "font-black" : "font-bold opacity-60")}>Public</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setInfo(prev => ({ ...prev, access: "invite-only" }))}
                                        className={cn(
                                            "flex-1 flex flex-col items-center justify-center py-4 rounded-[20px] transition-all duration-300",
                                            info.access === "invite-only"
                                                ? "bg-white dark:bg-[#222224] text-zinc-900 dark:text-zinc-100 shadow-md border border-zinc-200 dark:border-zinc-700/50"
                                                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                        )}
                                    >
                                        <Lock className={cn("h-5 w-5 mb-2 transition-transform", info.access === "invite-only" ? "text-rose-500 scale-110" : "opacity-30")} />
                                        <span className={cn("text-[10px] tracking-wider uppercase", info.access === "invite-only" ? "font-black" : "font-bold opacity-60")}>Secret</span>
                                    </button>
                                </div>
                                <div className="min-h-[32px] flex items-center justify-center px-4">
                                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500 text-center font-medium leading-relaxed">
                                        {info.access === "open" && t("groups.accessOpenDesc", "Anyone with the community link can join and read instantly.")}
                                        {info.access === "discoverable" && t("groups.accessDiscoverableDesc", "Visible on relay. Users can request to join via direct messages.")}
                                        {info.access === "invite-only" && t("groups.accessInviteOnlyDesc", "Stealth mode. No traces on relay. Join only via direct invite.")}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer - Symmetrical Buttons */}
                    <div className="flex gap-4 pt-4">
                        <Button
                            variant="ghost"
                            onClick={onClose}
                            disabled={isCreating}
                            className="flex-1 h-14 rounded-2xl bg-zinc-50 dark:bg-[#121214] hover:bg-zinc-100 dark:hover:bg-[#1a1a1c] text-zinc-600 dark:text-zinc-400 font-bold tracking-wide transition-all border border-zinc-200 dark:border-[#222224]"
                        >
                            <X className="h-4 w-4 mr-2" />
                            {t("common.cancel")}
                        </Button>
                        <Button
                            onClick={() => onCreate(info)}
                            disabled={!isValid || isCreating}
                            className="flex-1 h-14 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black tracking-wide disabled:opacity-30 transition-all text-sm shadow-lg shadow-primary/20"
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

