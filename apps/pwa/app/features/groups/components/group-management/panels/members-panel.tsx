"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Bell, Loader2, MoreVertical, Search, UserMinus, UserPlus, Users, X } from "lucide-react";
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
import { CommunitySyncIndicator } from "../../community-sync-indicator";
import { getPublicProfileHref } from "@/app/features/navigation/public-routes";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { mgmtFieldClass, formatParticipantLabel } from "../constants";
import type { summarizeCommunityOperatorHealth } from "../../../services/community-operator-health";
import { CommunityMembershipEvidenceChip } from "../../community-membership-evidence-chip";
import { resolveCommunityMemberEvidenceTier } from "../../../utils/community-member-evidence-tier";
import { CommunityMembershipEvidenceToolbar } from "../../community-membership-evidence-toolbar";
import type { CommunityDirectoryMaterializationHonesty } from "../../../services/community-directory-materialization-policy";

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
    syncConfidenceLevel,
    isPoolConnected,
    terminalRecordCount,
    onReconcileMembership,
    onClearTerminalMembership,
    managedWorkspaceActionsBlocked,
    directoryHonesty,
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
    syncConfidenceLevel: "seed_only" | "warming_up" | "partial_eose" | "steady_state";
    isPoolConnected: boolean;
    terminalRecordCount: number;
    onReconcileMembership: () => void;
    onClearTerminalMembership: () => void;
    managedWorkspaceActionsBlocked: boolean;
    directoryHonesty: CommunityDirectoryMaterializationHonesty;
}>): React.JSX.Element {
    const router = useRouter();
    const { t } = useTranslation();
    const filtered = visibleMemberPubkeys.filter((pubkey) => {
        const query = memberSearchQuery.toLowerCase();
        const name = (resolvedNames[pubkey] || "").toLowerCase();
        return pubkey.toLowerCase().includes(query) || name.includes(query);
    });

    return (
        <div className="mx-auto max-w-2xl space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                        {formatParticipantLabel(visibleMemberPubkeys.length)}
                    </p>
                    <p className="text-xs text-zinc-500">{onlineMemberCount} online now</p>
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
                        className="gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50"
                    >
                        <UserPlus className="h-4 w-4" />
                        Invite
                    </Button>
                </div>
            </div>

            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                    value={memberSearchQuery}
                    onChange={(event) => setMemberSearchQuery(event.target.value)}
                    placeholder="Search by name or pubkey"
                    className={`${mgmtFieldClass} pl-9`}
                />
            </div>

            {operatorHealth.signals.length > 0 ? (
                <ul className="space-y-2">
                    {operatorHealth.signals.map((signal) => (
                        <li
                            key={signal.id}
                            className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300"
                        >
                            <span className="font-medium text-zinc-800 dark:text-zinc-200">{signal.label}.</span>{" "}
                            {signal.detail}
                        </li>
                    ))}
                </ul>
            ) : null}

            {!directoryHonesty.claimsAuthoritativeDirectory ? (
                <p className="rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-400">
                    <span className="font-medium text-zinc-300">{directoryHonesty.summary}.</span>
                    {" "}
                    {directoryHonesty.detail}
                </p>
            ) : null}

            <CommunitySyncIndicator
                confidenceLevel={syncConfidenceLevel}
                memberCount={visibleMemberPubkeys.length}
                isConnected={isPoolConnected}
            />

            {filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 px-6 py-10 text-center dark:border-zinc-700">
                    <Users className="mx-auto h-8 w-8 text-zinc-400 dark:text-zinc-600" />
                    <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        {memberSearchQuery ? "No matching participants" : "No participants yet"}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                        {memberSearchQuery
                            ? "Try another search term."
                            : "Invite someone or wait for membership sync from the relay."}
                    </p>
                </div>
            ) : (
                <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                    {filtered.map((pubkey) => {
                        const isMe = pubkey === myPublicKeyHex;
                        const isMuted = mutedMembers.includes(pubkey);
                        const displayName = resolvedNames[pubkey] || `Member ${pubkey.slice(0, 8)}…`;
                        const evidenceTier = resolveCommunityMemberEvidenceTier(pubkey, {
                            activeMemberPubkeys: relayBackedMemberPubkeys,
                            provisionalMemberPubkeys,
                        });
                        return (
                            <li key={pubkey}>
                                <div className="flex items-center gap-3 bg-zinc-50/80 px-3 py-3 dark:bg-zinc-900/40">
                                    <button
                                        type="button"
                                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                                        onClick={() => router.push(getPublicProfileHref(pubkey))}
                                    >
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                                            {displayName.slice(0, 1).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">{displayName}</p>
                                            <div className="mt-0.5 flex flex-wrap items-center gap-2">
                                                <CommunityMembershipEvidenceChip tier={evidenceTier} />
                                                {isMe ? (
                                                    <span className="text-[10px] font-medium uppercase text-violet-400">You</span>
                                                ) : null}
                                                {isMuted ? (
                                                    <span className="text-[10px] font-medium text-rose-400">Muted</span>
                                                ) : null}
                                                <PresenceBadge publicKeyHex={pubkey} currentTime={currentTime} />
                                            </div>
                                        </div>
                                    </button>
                                    {!isMe ? (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-44">
                                                <DropdownMenuItem onClick={() => onToggleMute(pubkey)}>
                                                    {isMuted ? <Bell className="mr-2 h-4 w-4" /> : <X className="mr-2 h-4 w-4" />}
                                                    {isMuted ? "Unmute" : "Mute"}
                                                </DropdownMenuItem>
                                                {isAdmin ? (
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
                                                            Vote to remove
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
