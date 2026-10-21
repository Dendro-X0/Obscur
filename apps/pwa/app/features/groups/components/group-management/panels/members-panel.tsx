"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Bell, ChevronRight, Loader2, MoreVertical, Search, Shield, ShieldOff, UserMinus, UserPlus, Users, X } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { PresenceBadge } from "@/app/features/network/components/presence-indicator";
import { UserAvatar } from "@/app/features/profile/components/user-avatar";
import { CommunitySyncIndicator } from "../../community-sync-indicator";
import { getPublicProfileHref } from "@/app/features/navigation/public-routes";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { cn } from "@dweb/ui-kit/cn";
import { mgmtFieldClass } from "../constants";
import type { summarizeCommunityOperatorHealth } from "../../../services/community-operator-health";
import { CommunityMembershipEvidenceChip } from "../../community-membership-evidence-chip";
import { resolveCommunityMemberEvidenceTier } from "../../../utils/community-member-evidence-tier";
import { CommunityMembershipEvidenceToolbar } from "../../community-membership-evidence-toolbar";
import type { CommunityDirectoryMaterializationHonesty } from "../../../services/community-directory-materialization-policy";
import { CommunityDirectoryHonestyNotice } from "../../community-directory-honesty-notice";
import type { MembershipEvidenceUiContext } from "../../../utils/community-membership-evidence-display";

export function GroupManagementMembersPanel({
    visibleMemberPubkeys,
    relayBackedMemberPubkeys,
    provisionalMemberPubkeys,
    memberSearchQuery,
    setMemberSearchQuery,
    resolvedNames,
    onlineMemberCount,
    operatorHealth,
    myPublicKeyHex,
    isAdmin,
    mutedMembers,
    kickingMemberPubkey,
    currentTime,
    onInvite,
    onToggleMute,
    onVoteKick,
    stewardPubkeys = [],
    canManageStewards = false,
    onToggleSteward,
    syncConfidenceLevel,
    isPoolConnected,
    terminalRecordCount,
    onReconcileMembership,
    onClearTerminalMembership,
    managedWorkspaceActionsBlocked,
    directoryHonesty,
    membershipEvidenceUiContext,
}: Readonly<{
    visibleMemberPubkeys: ReadonlyArray<PublicKeyHex>;
    relayBackedMemberPubkeys: ReadonlyArray<PublicKeyHex>;
    provisionalMemberPubkeys: ReadonlyArray<PublicKeyHex>;
    memberSearchQuery: string;
    setMemberSearchQuery: (query: string) => void;
    resolvedNames: Record<string, string>;
    onlineMemberCount: number;
    operatorHealth: ReturnType<typeof summarizeCommunityOperatorHealth>;
    myPublicKeyHex: PublicKeyHex | null;
    isAdmin: boolean;
    mutedMembers: ReadonlyArray<string>;
    kickingMemberPubkey: string | null;
    currentTime: number;
    onInvite: () => void;
    onToggleMute: (pubkey: string) => void;
    onVoteKick: (pubkey: string) => void;
    stewardPubkeys?: ReadonlyArray<string>;
    canManageStewards?: boolean;
    onToggleSteward?: (pubkey: string) => void;
    syncConfidenceLevel: "seed_only" | "warming_up" | "partial_eose" | "steady_state";
    isPoolConnected: boolean;
    terminalRecordCount: number;
    onReconcileMembership: () => void;
    onClearTerminalMembership: () => void;
    managedWorkspaceActionsBlocked: boolean;
    directoryHonesty: CommunityDirectoryMaterializationHonesty;
    membershipEvidenceUiContext?: MembershipEvidenceUiContext;
}>) {
    const router = useRouter();
    const { t } = useTranslation();
    const stewardSet = React.useMemo(
        () => new Set(stewardPubkeys.map((entry) => entry.trim().toLowerCase()).filter(Boolean)),
        [stewardPubkeys],
    );
    const isLastSteward = stewardSet.size <= 1;
    const filtered = visibleMemberPubkeys.filter((pubkey) => {
        const query = memberSearchQuery.toLowerCase();
        const name = (resolvedNames[pubkey] || "").toLowerCase();
        return pubkey.toLowerCase().includes(query) || name.includes(query);
    });

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                    <p className="text-base font-semibold text-zinc-900 dark:text-white">
                        {t("groups.management.members.participantCount", { count: visibleMemberPubkeys.length })}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {t("groups.management.members.onlineNow", { count: onlineMemberCount })}
                    </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <CommunityMembershipEvidenceToolbar
                        terminalRecordCount={terminalRecordCount}
                        onReconcile={onReconcileMembership}
                        onClearTerminalConfirmed={onClearTerminalMembership}
                    />
                    <Button
                        type="button"
                        onClick={onInvite}
                        disabled={managedWorkspaceActionsBlocked}
                        className="gap-2 rounded-xl bg-violet-600 px-4 hover:bg-violet-500 disabled:opacity-50"
                    >
                        <UserPlus className="h-4 w-4" />
                        {t("groups.management.members.invite")}
                    </Button>
                </div>
            </div>

            <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                    value={memberSearchQuery}
                    onChange={(event) => setMemberSearchQuery(event.target.value)}
                    placeholder={t("groups.management.members.searchPlaceholder")}
                    className={cn(mgmtFieldClass, "h-11 rounded-2xl pl-10 pr-10")}
                />
                {memberSearchQuery.length > 0 ? (
                    <button
                        type="button"
                        onClick={() => setMemberSearchQuery("")}
                        className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                        aria-label={t("groups.home.findInCommunity.clearSearch")}
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                ) : null}
            </div>

            {memberSearchQuery.trim().length > 0 ? (
                <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                    {filtered.length === 0
                        ? t("groups.home.findInCommunity.noMatches")
                        : t("groups.home.findInCommunity.matchCount", { count: filtered.length })}
                </p>
            ) : null}

            {operatorHealth.signals.length > 0 ? (
                <ul className="space-y-2">
                    {operatorHealth.signals.map((signal) => (
                        <li
                            key={signal.id}
                            className="rounded-xl border border-zinc-200 bg-zinc-50/90 px-3 py-2.5 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300"
                        >
                            <span className="font-medium text-zinc-800 dark:text-zinc-200">{signal.label}.</span>{" "}
                            {signal.detail}
                        </li>
                    ))}
                </ul>
            ) : null}

            <CommunityDirectoryHonestyNotice honesty={directoryHonesty} compact />

            <CommunitySyncIndicator
                confidenceLevel={syncConfidenceLevel}
                memberCount={visibleMemberPubkeys.length}
                isConnected={isPoolConnected}
            />

            {filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-900">
                        <Users className="h-6 w-6 text-zinc-400 dark:text-zinc-600" />
                    </div>
                    <p className="mt-4 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        {memberSearchQuery ? t("groups.home.findInCommunity.noMatches") : t("groups.management.members.noneYet")}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {memberSearchQuery
                            ? t("groups.home.findInCommunity.tryAnotherSearch")
                            : t("groups.management.members.inviteOrWait")}
                    </p>
                </div>
            ) : (
                <ul className="space-y-1.5">
                    {filtered.map((pubkey) => {
                        const isMe = pubkey === myPublicKeyHex;
                        const isMuted = mutedMembers.includes(pubkey);
                        const isSteward = stewardSet.has(pubkey.trim().toLowerCase());
                        const demoteBlocked = isSteward && isLastSteward;
                        const displayName = resolvedNames[pubkey] || `Member ${pubkey.slice(0, 8)}…`;
                        const evidenceTier = resolveCommunityMemberEvidenceTier(pubkey, {
                            activeMemberPubkeys: relayBackedMemberPubkeys,
                            provisionalMemberPubkeys,
                        });
                        return (
                            <li key={pubkey}>
                                <div className="group flex items-center gap-2 rounded-2xl border border-transparent bg-zinc-50/80 px-2 py-2 transition-colors hover:border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900/40 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/60">
                                    <button
                                        type="button"
                                        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/35"
                                        onClick={() => router.push(getPublicProfileHref(pubkey))}
                                    >
                                        <UserAvatar
                                            pubkey={pubkey}
                                            size="sm"
                                            showProfileOnClick={false}
                                            className="rounded-xl border border-zinc-200 dark:border-zinc-700"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{displayName}</p>
                                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                                <CommunityMembershipEvidenceChip
                                                    tier={evidenceTier}
                                                    uiContext={membershipEvidenceUiContext}
                                                />
                                                {isSteward ? (
                                                    <span
                                                        data-testid="member-steward-badge"
                                                        className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300"
                                                    >
                                                        {t("groups.management.members.stewardBadge")}
                                                    </span>
                                                ) : null}
                                                {isMe ? (
                                                    <span className="rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-300">
                                                        {t("groups.management.members.you")}
                                                    </span>
                                                ) : null}
                                                {isMuted ? (
                                                    <span className="rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-300">
                                                        {t("groups.management.members.muted")}
                                                    </span>
                                                ) : null}
                                                <PresenceBadge publicKeyHex={pubkey} currentTime={currentTime} />
                                            </div>
                                            <p className="mt-0.5 truncate font-mono text-[10px] text-zinc-500 dark:text-zinc-500">
                                                {pubkey.slice(0, 8)}…{pubkey.slice(-4)}
                                            </p>
                                        </div>
                                        <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" />
                                    </button>
                                    {!isMe || canManageStewards ? (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-9 w-9 shrink-0 rounded-xl"
                                                >
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48">
                                                {!isMe ? (
                                                    <DropdownMenuItem onClick={() => onToggleMute(pubkey)}>
                                                        {isMuted ? <Bell className="mr-2 h-4 w-4" /> : <X className="mr-2 h-4 w-4" />}
                                                        {isMuted ? t("groups.management.members.unmute") : t("groups.management.members.mute")}
                                                    </DropdownMenuItem>
                                                ) : null}
                                                {canManageStewards && onToggleSteward ? (
                                                    <>
                                                        {!isMe ? <DropdownMenuSeparator /> : null}
                                                        <DropdownMenuItem
                                                            data-testid={isSteward ? "member-demote-steward" : "member-promote-steward"}
                                                            disabled={managedWorkspaceActionsBlocked || demoteBlocked}
                                                            onClick={() => onToggleSteward(pubkey)}
                                                            title={demoteBlocked ? t("groups.management.members.lastStewardBlocked") : undefined}
                                                        >
                                                            {isSteward
                                                                ? <ShieldOff className="mr-2 h-4 w-4" />
                                                                : <Shield className="mr-2 h-4 w-4" />}
                                                            {isSteward
                                                                ? t("groups.management.members.removeSteward")
                                                                : t("groups.management.members.makeSteward")}
                                                        </DropdownMenuItem>
                                                    </>
                                                ) : null}
                                                {!isMe && isAdmin ? (
                                                    <>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            className="text-rose-500 focus:text-rose-400"
                                                            disabled={managedWorkspaceActionsBlocked || kickingMemberPubkey === pubkey}
                                                            onClick={() => onVoteKick(pubkey)}
                                                        >
                                                            {kickingMemberPubkey === pubkey ? (
                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <UserMinus className="mr-2 h-4 w-4" />
                                                            )}
                                                            {t("groups.management.members.voteToRemove")}
                                                        </DropdownMenuItem>
                                                    </>
                                                ) : null}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    ) : null}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
