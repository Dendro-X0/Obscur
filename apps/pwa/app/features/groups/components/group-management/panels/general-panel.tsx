"use client";

import React from "react";
import Image from "next/image";
import { Camera, Globe, Loader2, Lock, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
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
import { CommunityBotsSection } from "../community-bots-section";
import { CommunityBotTriggersSection } from "../community-bot-triggers-section";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunityBotTriggerEntry } from "../../../services/community-bot-triggers-policy";
import type { GroupAccessMode } from "../../../types";
import { mgmtFieldClass, mgmtSectionClass, mgmtCompactSectionClass, mgmtTextareaClass } from "../constants";
import { useMobileCompactLayout } from "@/app/features/runtime/use-mobile-compact-layout";

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
    editBotPubkeys,
    onEditBotPubkeysChange,
    editBotTriggers,
    onEditBotTriggersChange,
    requiresGovernanceProposal,
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
    editBotPubkeys: ReadonlyArray<PublicKeyHex>;
    onEditBotPubkeysChange: (next: ReadonlyArray<PublicKeyHex>) => void;
    editBotTriggers: ReadonlyArray<CommunityBotTriggerEntry>;
    onEditBotTriggersChange: (next: ReadonlyArray<CommunityBotTriggerEntry>) => void;
    /** When true, saving (including bots) goes through governance proposal. */
    requiresGovernanceProposal: boolean;
}>): React.JSX.Element {
    const managedSettingsBlocked = isManagedWorkspaceRelayGateBlocking(managedWorkspaceRelayGate);
    const compact = useMobileCompactLayout();
    const { t } = useTranslation();
    const sectionClass = compact ? mgmtCompactSectionClass : mgmtSectionClass;

    return (
        <div className={cn("mx-auto max-w-2xl", compact ? "space-y-3" : "space-y-5")}>
            <section className={sectionClass}>
                <Label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("groups.management.general.avatar")}</Label>
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
                                aria-label={t("groups.management.general.uploadAvatarAria")}
                            >
                                <Camera className="h-4 w-4" />
                            </button>
                        ) : null}
                    </div>
                    {!compact ? (
                        <p className="text-sm text-zinc-500">
                            {t("groups.management.general.avatarHint")}
                        </p>
                    ) : null}
                </div>
            </section>

            <section className={sectionClass}>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="community-name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            {t("groups.management.general.communityName")}
                        </Label>
                        <Input
                            id="community-name"
                            value={editName}
                            onChange={(event) => setEditName(event.target.value)}
                            disabled={!isAdmin || managedSettingsBlocked}
                            className={mgmtFieldClass}
                            placeholder={t("groups.management.general.communityNamePlaceholder")}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="community-about" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            {t("groups.management.general.about")}
                        </Label>
                        <Textarea
                            id="community-about"
                            value={editAbout}
                            onChange={(event) => setEditAbout(event.target.value)}
                            disabled={!isAdmin || managedSettingsBlocked}
                            placeholder={t("groups.management.general.aboutPlaceholder")}
                            className={mgmtTextareaClass}
                        />
                    </div>
                </div>
            </section>

            <section className={sectionClass}>
                <Label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("groups.management.general.discoveryLabel")}</Label>
                <div className={cn("mt-3 grid gap-2", compact ? "grid-cols-3" : "grid-cols-1 sm:grid-cols-3")}>
                    {(["open", "discoverable", "invite-only"] as const).map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            disabled={!isAdmin || managedSettingsBlocked}
                            onClick={() => setEditAccess(mode)}
                            className={cn(
                                "flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-center text-xs font-medium transition-colors disabled:opacity-50",
                                compact ? "py-2" : "px-3 py-3",
                                editAccess === mode
                                    ? "border-violet-500/60 bg-violet-100 text-violet-900 dark:border-violet-500/50 dark:bg-violet-600/15 dark:text-violet-100"
                                    : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-600",
                            )}
                        >
                            {mode === "open" ? <Globe className="h-4 w-4" /> : null}
                            {mode === "discoverable" ? <Users className="h-4 w-4" /> : null}
                            {mode === "invite-only" ? <Lock className="h-4 w-4" /> : null}
                            <span>
                                {mode === "discoverable"
                                    ? t("groups.management.general.discoveryModeListed")
                                    : mode === "invite-only"
                                        ? t("groups.management.general.discoveryModeInviteOnly")
                                        : t("groups.management.general.discoveryModeOpen")}
                            </span>
                        </button>
                    ))}
                </div>
            </section>

            {communityMode === "managed_workspace" && isAdmin ? (
                <>
                    <CommunityBotsSection
                        botPubkeys={editBotPubkeys}
                        onChange={onEditBotPubkeysChange}
                        disabled={managedSettingsBlocked}
                        requiresGovernanceProposal={requiresGovernanceProposal}
                    />
                    <CommunityBotTriggersSection
                        botPubkeys={editBotPubkeys}
                        botTriggers={editBotTriggers}
                        onChange={onEditBotTriggersChange}
                        disabled={managedSettingsBlocked}
                        requiresGovernanceProposal={requiresGovernanceProposal}
                    />
                </>
            ) : null}

            {requiresMemberVote && isAdmin ? (
                <p className="rounded-lg border border-amber-500/35 bg-amber-50 px-3 py-2 text-xs text-amber-950 sm:text-sm dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                    {t("groups.management.general.multiMemberGovernanceNotice")}
                </p>
            ) : null}
            {communityMode === "managed_workspace" && stewardPolicy.isDesignatedSteward && isAdmin ? (
                <p className="rounded-lg border border-emerald-500/35 bg-emerald-50 px-3 py-2 text-xs text-emerald-950 sm:text-sm dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
                    {t("groups.management.general.designatedStewardNotice")}
                </p>
            ) : null}

            <details className={cn(sectionClass, "px-4 py-3")}>
                <summary className="cursor-pointer text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    {compact ? t("groups.management.general.relayProtocol") : t("groups.management.general.relayProtocolDetails")}
                </summary>
                <div className="mt-4 space-y-3">
                    {!compact ? (
                        <>
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
                        </>
                    ) : (
                        <p className="text-xs text-zinc-500 truncate" title={relayUrl}>
                            {t("groups.management.general.relayHostPrefix", { host: relayUrl.replace(/^wss?:\/\//, "") })}
                        </p>
                    )}
                    {communityMode === "managed_workspace" ? (
                        <p className="text-xs text-zinc-500">
                            {t("groups.management.general.authorityPrefix", {
                                mode: stewardPolicy.authorityMode.replace(/_/g, " "),
                            })}
                            {stewardPolicy.isDesignatedSteward ? ` ${t("groups.management.general.youAreSteward")}` : ""}
                        </p>
                    ) : null}
                </div>
            </details>
        </div>
    );
}

// Avoid importing GroupConversation - use inline type
type GroupConversationCommunityMode = "managed_workspace" | "sovereign_room" | undefined;
