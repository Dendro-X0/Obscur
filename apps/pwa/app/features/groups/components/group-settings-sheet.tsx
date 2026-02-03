"use client";

import React, { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Label } from "../../../components/ui/label";
import { useTranslation } from "react-i18next";
import { UserPlus, UserMinus, Shield, ShieldCheck, X, Camera, Info, Users } from "lucide-react";
import type { GroupConversation } from "../../messaging/types";
import { useNip29Group } from "../hooks/use-nip29-group";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

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
    const { state, approveJoin, denyJoin } = useNip29Group({
        groupId: group.groupId,
        relayUrl: group.relayUrl,
        pool,
        myPublicKeyHex,
        myPrivateKeyHex,
    });

    if (!isOpen) return null;

    const isAdmin = state.membership.role === "owner" || state.membership.role === "moderator";

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
                    <div className="flex flex-col items-center text-center space-y-3">
                        <div className="h-24 w-24 rounded-[32px] bg-gradient-to-br from-zinc-800 to-black dark:from-zinc-200 dark:to-white flex items-center justify-center shadow-xl">
                            <span className="text-4xl font-black text-white dark:text-black">
                                {state.metadata?.name?.[0] || group.displayName[0]}
                            </span>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">{state.metadata?.name || group.displayName}</h3>
                            <p className="text-xs text-zinc-500 font-mono">{group.groupId}@{new URL(group.relayUrl).hostname}</p>
                        </div>
                        {state.metadata?.about && (
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-2xl w-full">
                                {state.metadata.about}
                            </p>
                        )}
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
                            <Label className="text-xs font-bold uppercase tracking-widest text-rose-500 px-1">
                                {t("groups.joinRequests", "Join Requests")} ({state.joinRequests.length})
                            </Label>
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
                    <div className="space-y-3 pb-8">
                        <Label className="text-xs font-bold uppercase tracking-widest text-zinc-500 px-1">
                            {t("groups.members", "Members")}
                        </Label>
                        <div className="space-y-1">
                            {group.memberPubkeys.map((pubkey) => (
                                <div key={pubkey} className="flex items-center gap-3 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-xl transition-colors">
                                    <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                                        <Shield className="h-3 w-3 text-zinc-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-mono truncate">{pubkey}</p>
                                    </div>
                                </div>
                            ))}
                            {group.memberPubkeys.length === 0 && (
                                <p className="text-xs text-zinc-400 text-center py-4 italic">No members listed yet.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-black/5 dark:border-white/5 space-y-3">
                    <Button variant="secondary" className="w-full rounded-xl gap-2 font-bold opacity-50 cursor-not-allowed">
                        <UserPlus className="h-4 w-4" />
                        {t("groups.inviteMembers", "Invite Members")}
                    </Button>
                    <Button variant="secondary" className="w-full rounded-xl gap-2 font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30">
                        <UserMinus className="h-4 w-4" />
                        {t("groups.leaveGroup", "Leave Group")}
                    </Button>
                </div>
            </div>
        </div>
    );
}
