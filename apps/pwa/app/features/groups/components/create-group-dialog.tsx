"use client";

import React, { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { useTranslation } from "react-i18next";
import { Users, Camera, X, Check, Globe, Lock, Shield, Building2, ChevronDown, Zap } from "lucide-react";
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
import type { GroupAccessMode, CommunityMode, RelayCapabilityTier } from "../types";
import {
    COMMUNITY_MODE_DEFINITIONS,
    assessRelayCapability,
    type RelayCapabilityAssessment,
} from "../services/community-mode-contract";

export interface GroupCreateInfo {
    host: string;
    groupId: string;
    name: string;
    about: string;
    avatar?: string;
    access: GroupAccessMode;
    relayCapabilityTier: RelayCapabilityTier;
    communityMode: CommunityMode;
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
    const [showAdvancedModeOptions, setShowAdvancedModeOptions] = useState(false);

    const identity = useIdentity();
    const relayList = useRelayList({ publicKeyHex: identity.state.publicKeyHex || null });

    // Compute relay assessment directly from relay list
    const relayAssessment: RelayCapabilityAssessment = React.useMemo(() => {
        return assessRelayCapability({
            enabledRelayUrls: relayList.state.relays.map(r => r.url),
        });
    }, [relayList.state.relays]);

    const [info, setInfo] = useState<GroupCreateInfo>(() => ({
        host: "nos.lol",
        groupId: typeof crypto !== "undefined" ? crypto.randomUUID().replace(/-/g, "") : Math.random().toString(36).substring(2),
        name: "",
        about: "",
        avatar: "",
        access: "invite-only",
        relayCapabilityTier: "public_default",
        communityMode: "sovereign_room",
    }));

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

    const sovereignRoomDefinition = COMMUNITY_MODE_DEFINITIONS.sovereign_room;
    const managedWorkspaceDefinition = COMMUNITY_MODE_DEFINITIONS.managed_workspace;

    const selectedModeDefinition = info.communityMode === "managed_workspace" && relayAssessment.supportsManagedWorkspace
        ? managedWorkspaceDefinition
        : sovereignRoomDefinition;

    const createActionLabel = t("groups.createAction", "Create Group");

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md animate-in fade-in duration-200">
            <Card className="w-full max-w-3xl max-h-[90vh] bg-white dark:bg-[#0a0a0c] border-zinc-200 dark:border-[#1a1a1c] shadow-2xl p-0 overflow-hidden rounded-[20px] flex flex-col">
                {/* Header - Compact */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-[#1a1a1c] bg-zinc-50/50 dark:bg-[#0f0f11]/50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-zinc-900 dark:text-white tracking-tight">{t("groups.createTitle", "Create New Group")}</h2>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("groups.createDescription", "Start a new relay-based group chat.")}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isCreating}
                        className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-[#1a1a1c] transition-colors"
                    >
                        <X className="h-5 w-5 text-zinc-500" />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left Column - Identity & Basics */}
                        <div className="space-y-5">
                            {/* Avatar & Name - Horizontal Layout */}
                            <div className="flex gap-4">
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
                                        "group relative h-20 w-20 shrink-0 rounded-2xl flex items-center justify-center border-2 border-dashed transition-all duration-300 overflow-hidden shadow-sm",
                                        info.avatar
                                            ? "bg-transparent border-transparent"
                                            : "bg-zinc-50 dark:bg-[#121214] border-zinc-200 dark:border-[#222224] hover:border-primary/50"
                                    )}
                                >
                                    {info.avatar ? (
                                        <Image src={info.avatar} alt="Group avatar" fill unoptimized className="object-cover rounded-2xl" />
                                    ) : (
                                        <Camera className="h-6 w-6 text-zinc-400 dark:text-zinc-600 group-hover:text-primary transition-colors" />
                                    )}
                                    {isUploading && (
                                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center rounded-2xl">
                                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                        </div>
                                    )}
                                </button>
                                <div className="flex-1 space-y-2">
                                    <Label htmlFor="group-name" className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400">
                                        {t("groups.nameLabel", "Group Name")}
                                    </Label>
                                    <Input
                                        id="group-name"
                                        value={info.name}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInfo(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="Enter community name"
                                        className="bg-zinc-50 dark:bg-[#121214] border-zinc-200 dark:border-[#222224] text-zinc-900 dark:text-white rounded-xl h-11 focus-visible:ring-primary/40 text-sm font-medium"
                                    />
                                </div>
                            </div>

                            {/* Description */}
                            <div className="space-y-2">
                                <Label htmlFor="group-about" className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400">
                                    {t("groups.aboutLabel", "Description")}
                                </Label>
                                <Textarea
                                    id="group-about"
                                    value={info.about}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInfo(prev => ({ ...prev, about: e.target.value }))}
                                    placeholder="What is this group about?"
                                    className="bg-zinc-50 dark:bg-[#121214] border-zinc-200 dark:border-[#222224] text-zinc-900 dark:text-white rounded-xl min-h-[80px] py-3 resize-none focus-visible:ring-primary/40 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-sm"
                                />
                            </div>

                            {/* Host Section */}
                            <div className="space-y-2">
                                <Label htmlFor="group-host" className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400">
                                    {t("groups.hostLabel", "Relay Host")}
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="group-host"
                                        value={info.host}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInfo(prev => ({ ...prev, host: e.target.value }))}
                                        placeholder="e.g. groups.fiatjaf.com"
                                        className="bg-zinc-50 dark:bg-[#121214] border-zinc-200 dark:border-[#222224] text-zinc-900 dark:text-white rounded-xl h-11 focus-visible:ring-primary/40 pr-28 text-sm font-medium"
                                    />
                                    <div className="absolute right-1.5 top-1.5 bottom-1.5">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    className="h-full px-3 rounded-lg text-[10px] font-black uppercase tracking-wider text-primary dark:text-primary hover:bg-primary/10"
                                                >
                                                    {t("common.select", "Select")}
                                                    <ChevronDown className="ml-1.5 h-3 w-3" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent
                                                align="end"
                                                className="z-[200] w-56 rounded-2xl p-2 bg-white/95 dark:bg-[#0a0a0c]/95 backdrop-blur-2xl border border-zinc-200 dark:border-[#1a1a1c] shadow-2xl"
                                            >
                                                <div className="px-3 py-2 text-[9px] font-black uppercase tracking-[0.15em] text-zinc-400">
                                                    {t("groups.availableRelays", "Available Relays")}
                                                </div>
                                                <div className="max-h-[200px] overflow-y-auto scrollbar-hide space-y-0.5">
                                                    {allRelays.map((relay) => (
                                                        <DropdownMenuItem
                                                            key={relay.url}
                                                            onClick={() => setInfo(prev => ({ ...prev, host: relay.url }))}
                                                            className={cn(
                                                                "flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all text-sm",
                                                                info.host === relay.url
                                                                    ? "bg-primary/10 text-primary"
                                                                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#121214]"
                                                            )}
                                                        >
                                                            <span className="font-medium truncate max-w-[120px]">{relay.url}</span>
                                                            {relay.type === "NIP-29" && <Zap className="h-3 w-3 text-emerald-500" />}
                                                        </DropdownMenuItem>
                                                    ))}
                                                </div>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                                <p className="text-[10px] text-zinc-500 dark:text-zinc-500 leading-relaxed">
                                    {t("groups.hostHint", "This room publishes through the selected relay host while still following your current relay settings baseline.")}
                                </p>
                            </div>

                            {/* Privacy Policy */}
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400 block">
                                    {t("groups.privacyLabel", "Privacy Policy")}
                                </Label>
                                <div className="flex bg-zinc-50 dark:bg-[#121214] border border-zinc-200 dark:border-[#222224] rounded-xl p-1 gap-1 shadow-inner">
                                    <button
                                        type="button"
                                        onClick={() => setInfo(prev => ({ ...prev, access: "open" }))}
                                        className={cn(
                                            "flex-1 flex flex-col items-center justify-center py-2.5 rounded-lg transition-all duration-200",
                                            info.access === "open"
                                                ? "bg-white dark:bg-[#222224] text-zinc-900 dark:text-zinc-100 shadow-sm border border-zinc-200 dark:border-zinc-700/50"
                                                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                        )}
                                    >
                                        <Globe className={cn("h-4 w-4 mb-1 transition-transform", info.access === "open" ? "text-primary scale-110" : "opacity-40")} />
                                        <span className={cn("text-[10px] tracking-wide", info.access === "open" ? "font-bold" : "font-medium opacity-60")}>Open</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setInfo(prev => ({ ...prev, access: "discoverable" }))}
                                        className={cn(
                                            "flex-1 flex flex-col items-center justify-center py-2.5 rounded-lg transition-all duration-200",
                                            info.access === "discoverable"
                                                ? "bg-white dark:bg-[#222224] text-zinc-900 dark:text-zinc-100 shadow-sm border border-zinc-200 dark:border-zinc-700/50"
                                                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                        )}
                                    >
                                        <Users className={cn("h-4 w-4 mb-1 transition-transform", info.access === "discoverable" ? "text-primary scale-110" : "opacity-40")} />
                                        <span className={cn("text-[10px] tracking-wide", info.access === "discoverable" ? "font-bold" : "font-medium opacity-60")}>Public</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setInfo(prev => ({ ...prev, access: "invite-only" }))}
                                        className={cn(
                                            "flex-1 flex flex-col items-center justify-center py-2.5 rounded-lg transition-all duration-200",
                                            info.access === "invite-only"
                                                ? "bg-white dark:bg-[#222224] text-zinc-900 dark:text-zinc-100 shadow-sm border border-zinc-200 dark:border-zinc-700/50"
                                                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                        )}
                                    >
                                        <Lock className={cn("h-4 w-4 mb-1 transition-transform", info.access === "invite-only" ? "text-rose-500 scale-110" : "opacity-40")} />
                                        <span className={cn("text-[10px] tracking-wide", info.access === "invite-only" ? "font-bold" : "font-medium opacity-60")}>Secret</span>
                                    </button>
                                </div>
                                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 text-center leading-relaxed">
                                    {info.access === "open" && t("groups.accessOpenDesc", "Anyone with the community link can join and read instantly.")}
                                    {info.access === "discoverable" && t("groups.accessDiscoverableDesc", "Visible on relay. Users can request to join via direct messages.")}
                                    {info.access === "invite-only" && t("groups.accessInviteOnlyDesc", "Stealth mode. No traces on relay. Join only via direct invite.")}
                                </p>
                            </div>
                        </div>

                        {/* Right Column - Community Mode & Advanced */}
                        <div className="space-y-4">
                            {/* Relay Baseline Card */}
                            <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 dark:border-[#222224] dark:bg-[#121214]/50">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400">
                                        {t("groups.relayBaselineLabel", "Relay Baseline")}
                                    </p>
                                    <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-zinc-500 dark:border-zinc-700 dark:bg-[#0a0a0c] dark:text-zinc-400">
                                        {relayAssessment.enabledRelayCount > 0
                                            ? `${relayAssessment.enabledRelayCount} enabled`
                                            : "No relays"}
                                    </span>
                                </div>
                                <p className="mt-1 text-sm font-bold text-zinc-900 dark:text-white">
                                    {relayAssessment.label}
                                </p>
                                <p className="mt-1 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-500">
                                    {relayAssessment.summary}
                                </p>
                            </div>

                            {/* Community Mode Selection */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-3 px-1">
                                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                                        {t("groups.modeLabel", "Community Mode")}
                                    </Label>
                                    <button
                                        type="button"
                                        onClick={() => setShowAdvancedModeOptions((prev) => !prev)}
                                        className="text-[10px] font-black uppercase tracking-[0.2em] text-primary transition-opacity hover:opacity-80"
                                    >
                                        {showAdvancedModeOptions
                                            ? t("groups.hideAdvancedMode", "Hide Advanced")
                                            : t("groups.showAdvancedMode", "Advanced")}
                                    </button>
                                </div>

                                {/* Mode Selection Buttons */}
                                <div className="space-y-2">
                                    <button
                                        type="button"
                                        onClick={() => setInfo((prev) => ({ ...prev, communityMode: "sovereign_room" }))}
                                        className={cn(
                                            "w-full rounded-xl border p-3 text-left transition-all duration-200",
                                            info.communityMode === "sovereign_room"
                                                ? "border-primary/40 bg-primary/5 shadow-sm"
                                                : "border-zinc-200 bg-white hover:border-primary/20 dark:border-[#222224] dark:bg-[#0f0f11]",
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
                                                <Shield className="h-4 w-4 text-primary" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-zinc-900 dark:text-white">
                                                    {sovereignRoomDefinition.label}
                                                </p>
                                                <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                                                    {sovereignRoomDefinition.shortDescription}
                                                </p>
                                            </div>
                                            {info.communityMode === "sovereign_room" && <Check className="h-4 w-4 text-primary shrink-0" />}
                                        </div>
                                    </button>

                                    {showAdvancedModeOptions ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!relayAssessment.supportsManagedWorkspace) return;
                                                setInfo((prev) => ({ ...prev, communityMode: "managed_workspace" }));
                                            }}
                                            disabled={!relayAssessment.supportsManagedWorkspace}
                                            className={cn(
                                                "w-full rounded-xl border p-3 text-left transition-all duration-200",
                                                !relayAssessment.supportsManagedWorkspace
                                                    ? "cursor-not-allowed border-zinc-200 bg-zinc-100/70 opacity-60 dark:border-[#222224] dark:bg-[#18181b]"
                                                    : info.communityMode === "managed_workspace"
                                                        ? "border-emerald-500/40 bg-emerald-500/5 shadow-sm"
                                                        : "border-zinc-200 bg-white hover:border-emerald-500/20 dark:border-[#222224] dark:bg-[#0f0f11]",
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 shrink-0 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                                    <Building2 className="h-4 w-4 text-emerald-500" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-zinc-900 dark:text-white">
                                                        {managedWorkspaceDefinition.label}
                                                    </p>
                                                    <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                                                        {relayAssessment.supportsManagedWorkspace
                                                            ? managedWorkspaceDefinition.shortDescription
                                                            : t("groups.managedWorkspaceLocked", "Requires trusted/private relays")}
                                                    </p>
                                                </div>
                                                {info.communityMode === "managed_workspace" && relayAssessment.supportsManagedWorkspace && (
                                                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                                                )}
                                            </div>
                                        </button>
                                    ) : (
                                        <div className="rounded-xl border border-dashed border-zinc-200 px-3 py-2 text-[11px] leading-relaxed text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
                                            {t("groups.managedWorkspaceCollapsedHint", "Advanced mode available with trusted relays.")}
                                        </div>
                                    )}
                                </div>

                                {/* Selected Guarantees */}
                                <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-[#222224] dark:bg-[#0f0f11]">
                                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">
                                        {t("groups.guaranteesLabel", "Selected Guarantees")}
                                    </p>
                                    <p className="mt-1 text-sm font-bold text-zinc-900 dark:text-white">
                                        {selectedModeDefinition.label}
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {selectedModeDefinition.guarantees.slice(0, 3).map((guarantee: string) => (
                                            <span
                                                key={guarantee}
                                                className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-600 dark:border-zinc-700 dark:bg-[#161618] dark:text-zinc-300"
                                            >
                                                {guarantee}
                                            </span>
                                        ))}
                                    </div>
                                    <p className="mt-2 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-500">
                                        {selectedModeDefinition.caution}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-zinc-100 dark:border-[#1a1a1c] bg-zinc-50/50 dark:bg-[#0f0f11]/50 shrink-0">
                    <Button variant="ghost" onClick={onClose} disabled={isCreating}>
                        {t("common.cancel", "Cancel")}
                    </Button>
                    <Button
                        onClick={() => onCreate({ ...info, relayCapabilityTier: relayAssessment.tier })}
                        disabled={!isValid || isCreating || isUploading}
                    >
                        {isCreating ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white mr-2" />
                        ) : null}
                        {createActionLabel}
                    </Button>
                </div>
            </Card>
        </div>
    );
}

