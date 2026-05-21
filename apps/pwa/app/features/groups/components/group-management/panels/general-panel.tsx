"use client";

import React from "react";
import Image from "next/image";
import { Camera, Globe, Loader2, Lock, Users } from "lucide-react";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { cn } from "@/app/lib/cn";
import { CommunityModeBadge } from "../../community-mode-badge";
import { RelayCapabilityBadge } from "@/app/features/relays/components/relay-capability-badge";
import {
    isManagedWorkspaceRelayGateBlocking,
    type ManagedWorkspaceRelayGate,
} from "../../../services/community-mode-contract";
import type { CommunityStewardPolicy } from "../../../services/community-steward-policy";
import type { GroupAccessMode } from "../../../types";
import { mgmtFieldClass, mgmtSectionClass, mgmtTextareaClass } from "../constants";

export function GroupManagementGeneralPanel({
    editName,
    setEditName,
    editAbout,
    setEditAbout,
    editPicture,
    editAccess,
    setEditAccess,
    isAdmin,
    isUploading,
    onPickAvatar,
    requiresMemberVote,
    stewardPolicy,
    communityMode,
    relayUrl,
    relayCapabilities,
    isRelayCapabilitiesLoading,
    managedWorkspaceRelayGate,
}: Readonly<{
    editName: string;
    setEditName: (value: string) => void;
    editAbout: string;
    setEditAbout: (value: string) => void;
    editPicture: string;
    editAccess: GroupAccessMode;
    setEditAccess: (mode: GroupAccessMode) => void;
    isAdmin: boolean;
    isUploading: boolean;
    onPickAvatar: () => void;
    requiresMemberVote: boolean;
    stewardPolicy: CommunityStewardPolicy;
    communityMode: GroupConversationCommunityMode;
    relayUrl: string;
    relayCapabilities: Parameters<typeof RelayCapabilityBadge>[0]["capabilities"];
    isRelayCapabilitiesLoading: boolean;
    managedWorkspaceRelayGate: ManagedWorkspaceRelayGate;
}>): React.JSX.Element {
    const managedSettingsBlocked = isManagedWorkspaceRelayGateBlocking(managedWorkspaceRelayGate);

    return (
        <div className="mx-auto max-w-2xl space-y-5">
            <section className={mgmtSectionClass}>
                <Label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Avatar</Label>
                <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="relative shrink-0 self-start">
                        <div className="relative h-20 w-20 overflow-hidden rounded-xl border border-dashed border-zinc-300 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800">
                            {editPicture ? (
                                <Image src={editPicture} alt="" fill unoptimized className="object-cover" />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                    <Camera className="h-7 w-7 text-zinc-500" />
                                </div>
                            )}
                            {isUploading ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                                </div>
                            ) : null}
                        </div>
                        {isAdmin ? (
                            <button
                                type="button"
                                onClick={onPickAvatar}
                                disabled={isUploading || managedSettingsBlocked}
                                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white shadow-lg hover:bg-violet-500 disabled:opacity-50"
                                aria-label="Upload community avatar"
                            >
                                <Camera className="h-4 w-4" />
                            </button>
                        ) : null}
                    </div>
                    <p className="text-sm text-zinc-500">
                        Shown in discovery and on your community home. Square image, at least 256×256, max 5&nbsp;MB.
                    </p>
                </div>
            </section>

            <section className={mgmtSectionClass}>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="community-name" className="text-sm font-medium text-zinc-300">
                            Community name
                        </Label>
                        <Input
                            id="community-name"
                            value={editName}
                            onChange={(event) => setEditName(event.target.value)}
                            disabled={!isAdmin || managedSettingsBlocked}
                            className={mgmtFieldClass}
                            placeholder="My community"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="community-about" className="text-sm font-medium text-zinc-300">
                            About
                        </Label>
                        <Textarea
                            id="community-about"
                            value={editAbout}
                            onChange={(event) => setEditAbout(event.target.value)}
                            disabled={!isAdmin || managedSettingsBlocked}
                            placeholder="What is this community for?"
                            className={mgmtTextareaClass}
                        />
                    </div>
                </div>
            </section>

            <section className={mgmtSectionClass}>
                <Label className="text-sm font-medium text-zinc-300">Who can find this community</Label>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {(["open", "discoverable", "invite-only"] as const).map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            disabled={!isAdmin || managedSettingsBlocked}
                            onClick={() => setEditAccess(mode)}
                            className={cn(
                                "flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-center text-xs font-medium transition-colors disabled:opacity-50",
                                editAccess === mode
                                    ? "border-violet-500/50 bg-violet-600/15 text-violet-100"
                                    : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600",
                            )}
                        >
                            {mode === "open" ? <Globe className="h-4 w-4" /> : null}
                            {mode === "discoverable" ? <Users className="h-4 w-4" /> : null}
                            {mode === "invite-only" ? <Lock className="h-4 w-4" /> : null}
                            <span>{mode === "discoverable" ? "Listed" : mode === "invite-only" ? "Invite only" : "Open"}</span>
                        </button>
                    ))}
                </div>
            </section>

            {requiresMemberVote && isAdmin ? (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                    This community has multiple members. Saving will create a governance proposal instead of applying immediately.
                </p>
            ) : null}
            {communityMode === "managed_workspace" && stewardPolicy.isDesignatedSteward && isAdmin ? (
                <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                    You are a designated steward — descriptor and member removal can apply without a community vote.
                </p>
            ) : null}

            <details className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-3">
                <summary className="cursor-pointer text-sm font-medium text-zinc-400">Relay & protocol details</summary>
                <div className="mt-4 space-y-3">
                    <CommunityModeBadge
                        mode={communityMode}
                        enabledRelayUrls={[relayUrl].filter(Boolean)}
                        selectedRelayHost={relayUrl}
                        className="w-full"
                    />
                    <RelayCapabilityBadge
                        capabilities={relayCapabilities}
                        relayUrl={relayUrl}
                        isLoading={isRelayCapabilitiesLoading}
                        className="w-full"
                    />
                    {communityMode === "managed_workspace" ? (
                        <p className="text-xs text-zinc-500">
                            Authority: {stewardPolicy.authorityMode.replace(/_/g, " ")}
                            {stewardPolicy.isDesignatedSteward ? " · you are a steward" : ""}
                        </p>
                    ) : null}
                </div>
            </details>
        </div>
    );
}

// Avoid importing GroupConversation - use inline type
type GroupConversationCommunityMode = "managed_workspace" | "sovereign_room" | undefined;
