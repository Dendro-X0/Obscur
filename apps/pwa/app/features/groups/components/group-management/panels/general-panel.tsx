"use client";

import React from "react";
import Image from "next/image";
import { Camera, Globe, Loader2, Lock, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { cn } from "@/app/lib/cn";
import { RelayCapabilityBadge } from "@/app/features/relays/components/relay-capability-badge";
import {
    isManagedWorkspaceRelayGateBlocking,
    type ManagedWorkspaceRelayGate,
} from "../../../services/community-mode-contract";
import type { CommunityStewardPolicy } from "../../../services/community-steward-policy";
import type { CommunityConvertAssessment } from "../../../services/community-mode-convert-policy";
import { CommunityBotsSection } from "../community-bots-section";
import { CommunityBotTriggersSection } from "../community-bot-triggers-section";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunityBotTriggerEntry } from "../../../services/community-bot-triggers-policy";
import type { CommunityMode, GroupAccessMode } from "../../../types";
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
    canConvertDirect,
    showStewardBootstrapHint,
    editCommunityMode,
    setEditCommunityMode,
    editRelayHost,
    setEditRelayHost,
    convertHonestyAcked,
    setConvertHonestyAcked,
    convertAssessment,
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
    canConvertDirect: boolean;
    /** Local admin / creator can claim steward when list is empty. */
    showStewardBootstrapHint: boolean;
    editCommunityMode: CommunityMode;
    setEditCommunityMode: (mode: CommunityMode) => void;
    editRelayHost: string;
    setEditRelayHost: (host: string) => void;
    convertHonestyAcked: boolean;
    setConvertHonestyAcked: (acked: boolean) => void;
    convertAssessment: CommunityConvertAssessment;
}>): React.JSX.Element {
    const managedSettingsBlocked = isManagedWorkspaceRelayGateBlocking(managedWorkspaceRelayGate);
    const compact = useMobileCompactLayout();
    const { t } = useTranslation();
    const sectionClass = compact ? mgmtCompactSectionClass : mgmtSectionClass;

    return (
        <div className={cn("mx-auto max-w-2xl", compact ? "space-y-3" : "space-y-5")}>
            <section className={sectionClass}>
                <Label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("groups.management.general.avatar")}</Label>
                <div className={cn(
                    "mt-3 flex gap-4",
                    compact ? "flex-col items-center" : "flex-col sm:flex-row sm:items-center",
                )}>
                    <div className={cn("relative shrink-0", compact ? "self-center" : "self-start")}>
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
                                "flex flex-col items-center text-center font-medium transition-colors disabled:opacity-50",
                                compact
                                    ? "gap-2 rounded-xl border px-1.5 py-3 text-[11px] leading-tight"
                                    : "gap-1.5 rounded-lg border px-3 py-3 text-xs",
                                editAccess === mode
                                    ? "border-violet-500/60 bg-violet-100 text-violet-900 dark:border-violet-500/50 dark:bg-violet-600/15 dark:text-violet-100"
                                    : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-600",
                            )}
                        >
                            {mode === "open" ? <Globe className={compact ? "h-6 w-6" : "h-4 w-4"} strokeWidth={compact ? 2 : undefined} /> : null}
                            {mode === "discoverable" ? <Users className={compact ? "h-6 w-6" : "h-4 w-4"} strokeWidth={compact ? 2 : undefined} /> : null}
                            {mode === "invite-only" ? <Lock className={compact ? "h-6 w-6" : "h-4 w-4"} strokeWidth={compact ? 2 : undefined} /> : null}
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

            {isAdmin ? (
                <section className={sectionClass} data-testid="group-manage-convert-section">
                    <Label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        {t("groups.manage.convert.title")}
                    </Label>
                    <p className="mt-1 text-xs text-zinc-500">
                        {t("groups.manage.convert.hint")}
                    </p>
                    {!canConvertDirect ? (
                        <p
                            className="mt-3 rounded-lg border border-amber-500/35 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
                            data-testid="group-manage-convert-locked"
                        >
                            {t("groups.manage.convert.lockedBody")}
                        </p>
                    ) : showStewardBootstrapHint ? (
                        <p
                            className="mt-3 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-950 dark:text-sky-100"
                            data-testid="group-manage-convert-bootstrap"
                        >
                            {t("groups.manage.convert.bootstrapHint")}
                        </p>
                    ) : null}
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <button
                            type="button"
                            data-testid="group-manage-convert-mode-interest"
                            disabled={!canConvertDirect || managedSettingsBlocked}
                            onClick={() => setEditCommunityMode("sovereign_room")}
                            className={cn(
                                "rounded-xl border p-3 text-left transition-colors disabled:opacity-50",
                                editCommunityMode === "sovereign_room"
                                    ? "border-primary/50 bg-primary/10"
                                    : "border-zinc-200 dark:border-[#222224] hover:border-zinc-300 dark:hover:border-zinc-600",
                            )}
                        >
                            <p className="text-sm font-bold text-zinc-900 dark:text-white">
                                {t("groups.manage.convert.mode.interest")}
                            </p>
                            <p className="mt-1 text-[11px] leading-snug text-zinc-500">
                                {t("groups.manage.convert.mode.interestHint")}
                            </p>
                        </button>
                        <button
                            type="button"
                            data-testid="group-manage-convert-mode-team"
                            disabled={!canConvertDirect || managedSettingsBlocked}
                            onClick={() => setEditCommunityMode("managed_workspace")}
                            className={cn(
                                "rounded-xl border p-3 text-left transition-colors disabled:opacity-50",
                                editCommunityMode === "managed_workspace"
                                    ? "border-primary/50 bg-primary/10"
                                    : "border-zinc-200 dark:border-[#222224] hover:border-zinc-300 dark:hover:border-zinc-600",
                            )}
                        >
                            <p className="text-sm font-bold text-zinc-900 dark:text-white">
                                {t("groups.manage.convert.mode.team")}
                            </p>
                            <p className="mt-1 text-[11px] leading-snug text-zinc-500">
                                {t("groups.manage.convert.mode.teamHint")}
                            </p>
                        </button>
                    </div>
                    <div className="mt-4 space-y-2">
                        <Label htmlFor="community-convert-host" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            {t("groups.manage.convert.hostLabel")}
                        </Label>
                        <Input
                            id="community-convert-host"
                            data-testid="group-manage-convert-host"
                            value={editRelayHost}
                            onChange={(event) => setEditRelayHost(event.target.value)}
                            disabled={!canConvertDirect || managedSettingsBlocked}
                            className={mgmtFieldClass}
                            placeholder={t("groups.manage.convert.hostPlaceholder")}
                        />
                        <p className="text-[10px] text-zinc-500">
                            {t("groups.manage.convert.hostExamples")}
                        </p>
                    </div>
                    {canConvertDirect && (convertAssessment.requiresHonestyAck
                        || convertAssessment.reasonCode === "demote_honesty_required"
                        || convertAssessment.reasonCode === "public_honesty_required") ? (
                        <div
                            className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-[11px] leading-relaxed text-amber-950 dark:text-amber-100"
                            role="status"
                            data-testid="group-manage-convert-honesty"
                        >
                            <p className="font-semibold">
                                {convertAssessment.reasonCode === "demote_honesty_required"
                                    || (convertAssessment.modeChanged
                                        && editCommunityMode === "sovereign_room"
                                        && communityMode === "managed_workspace")
                                    ? t("groups.manage.convert.demoteWarningTitle")
                                    : t("groups.manage.convert.publicWarningTitle")}
                            </p>
                            <p className="mt-1 opacity-90">{convertAssessment.userMessage || t("groups.manage.convert.publicWarningBody")}</p>
                            <label className="mt-3 flex items-start gap-2 text-[11px] font-medium">
                                <input
                                    type="checkbox"
                                    className="mt-0.5"
                                    checked={convertHonestyAcked}
                                    onChange={(event) => setConvertHonestyAcked(event.target.checked)}
                                    data-testid="group-manage-convert-honesty-ack"
                                />
                                <span>
                                    {convertAssessment.reasonCode === "demote_honesty_required"
                                        || (editCommunityMode === "sovereign_room" && communityMode === "managed_workspace")
                                        ? t("groups.manage.convert.demoteAck")
                                        : t("groups.manage.convert.publicAck")}
                                </span>
                            </label>
                        </div>
                    ) : null}
                    {canConvertDirect && !convertAssessment.allowed && convertAssessment.reasonCode !== "no_change"
                        && convertAssessment.reasonCode !== "demote_honesty_required"
                        && convertAssessment.reasonCode !== "public_honesty_required" ? (
                        <p
                            className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-900 dark:text-rose-100"
                            data-testid="group-manage-convert-blocked"
                        >
                            {convertAssessment.userMessage}
                        </p>
                    ) : null}
                </section>
            ) : null}

            {communityMode === "managed_workspace" && isAdmin ? (
                <>
                    <CommunityBotsSection
                        botPubkeys={editBotPubkeys}
                        onChange={onEditBotPubkeysChange}
                        disabled={managedSettingsBlocked || requiresMemberVote}
                        requiresGovernanceProposal={requiresGovernanceProposal}
                    />
                    <CommunityBotTriggersSection
                        botPubkeys={editBotPubkeys}
                        botTriggers={editBotTriggers}
                        onChange={onEditBotTriggersChange}
                        disabled={managedSettingsBlocked || requiresMemberVote}
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
                    {compact ? t("groups.management.general.relayProtocol") : t("groups.management.general.relayHealthDetails")}
                </summary>
                <div className="mt-4 space-y-3">
                    <p className="text-xs text-zinc-500">
                        {t("groups.management.general.relayHealthHint")}
                    </p>
                    {!compact ? (
                        <RelayCapabilityBadge
                            capabilities={relayCapabilities}
                            relayUrl={relayUrl}
                            isLoading={isRelayCapabilitiesLoading}
                            className="w-full"
                        />
                    ) : (
                        <p className="text-xs text-zinc-500 truncate" title={relayUrl}>
                            {t("groups.management.general.relayHostPrefix", { host: relayUrl.replace(/^wss?:\/\//, "") })}
                        </p>
                    )}
                    <p className="text-xs text-zinc-500">
                        {t("groups.management.general.authorityPrefix", {
                            mode: stewardPolicy.authorityMode.replace(/_/g, " "),
                        })}
                        {stewardPolicy.isDesignatedSteward ? ` ${t("groups.management.general.youAreSteward")}` : ""}
                    </p>
                </div>
            </details>
        </div>
    );
}

// Avoid importing GroupConversation - use inline type
type GroupConversationCommunityMode = "managed_workspace" | "sovereign_room" | undefined;
