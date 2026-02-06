"use client";

import React from "react";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { User, ShieldCheck, ShieldOff, VolumeX, Volume2, Search, Trash2, EyeOff, ShieldAlert } from "lucide-react";
import { usePeerTrust } from "../../contacts/hooks/use-peer-trust";
import { useBlocklist } from "../../contacts/hooks/use-blocklist";
import { useIdentity } from "../../auth/hooks/use-identity";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { useState } from "react";
import { cn } from "@/app/lib/utils";
import { useTranslation } from "react-i18next";

export function TrustSettingsPanel() {
    const { t } = useTranslation();
    const identity = useIdentity();
    const myPublicKeyHex = identity.state.publicKeyHex ?? null;
    const peerTrust = usePeerTrust({ publicKeyHex: myPublicKeyHex });
    const blocklist = useBlocklist({ publicKeyHex: myPublicKeyHex as any });
    const [searchQuery, setSearchQuery] = useState("");

    const acceptedPeers = peerTrust.state.acceptedPeers;
    const mutedPeers = peerTrust.state.mutedPeers;
    const blockedPeers = blocklist.state.blockedPublicKeys;

    const filterByQuery = (pk: string) => pk.toLowerCase().includes(searchQuery.toLowerCase());

    const filteredAccepted = acceptedPeers.filter(filterByQuery);
    const filteredMuted = mutedPeers.filter(filterByQuery);
    const filteredBlocked = blockedPeers.filter(filterByQuery);

    return (
        <div className="space-y-6">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <Input
                    placeholder={t("settings.security.searchPeers")}
                    className="pl-9 h-11 bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 focus:ring-purple-500/20"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Accepted Peers */}
            <section className="space-y-3">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        {t("settings.security.acceptedContacts")} ({acceptedPeers.length})
                    </h3>
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-1 rounded-full uppercase tracking-tight">
                        <ShieldCheck className="h-3 w-3" />
                        {t("invites.trusted")}
                    </div>
                </div>

                {filteredAccepted.length === 0 ? (
                    <Card className="p-8 text-center text-zinc-400 bg-zinc-50/30 dark:bg-zinc-900/30 border-dashed border-zinc-200 dark:border-zinc-800">
                        <p className="text-xs italic">{t("settings.security.noTrustedFound")}</p>
                    </Card>
                ) : (
                    <div className="grid gap-2">
                        {filteredAccepted.map((pk) => (
                            <div key={pk} className="group flex items-center justify-between p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors shadow-sm">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="h-9 w-9 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                                        <User className="h-4 w-4 text-zinc-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-mono truncate text-zinc-900 dark:text-zinc-100">
                                            {pk}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-1 shrink-0 ml-4">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                                        onClick={() => peerTrust.mutePeer({ publicKeyHex: pk })}
                                        title={t("settings.security.mutePeer")}
                                    >
                                        <VolumeX className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                                        onClick={() => peerTrust.unacceptPeer({ publicKeyHex: pk })}
                                        title={t("settings.security.revokeTrust")}
                                    >
                                        <ShieldOff className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Muted Peers */}
            {mutedPeers.length > 0 && (
                <section className="space-y-3 pt-2">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-1">
                        {t("settings.security.mutedPeers")} ({mutedPeers.length})
                    </h3>

                    <div className="grid gap-2">
                        {filteredMuted.map((pk) => (
                            <div key={pk} className="flex items-center justify-between p-3 rounded-xl border border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-950/40 opacity-70">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="h-9 w-9 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                                        <VolumeX className="h-4 w-4 text-zinc-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-mono truncate text-zinc-500">
                                            {pk}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-1 shrink-0 ml-4">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                                        onClick={() => peerTrust.unmutePeer({ publicKeyHex: pk })}
                                        title={t("settings.security.unmutePeer")}
                                    >
                                        <Volume2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Blocked Peers */}
            {(blockedPeers.length > 0 || filteredBlocked.length > 0) && (
                <section className="space-y-3 pt-2">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                            {t("settings.blocklist.title")} ({blockedPeers.length})
                        </h3>
                        <div className="flex items-center gap-1.5 text-[10px] text-red-600 dark:text-red-400 font-bold bg-red-500/10 px-2 py-1 rounded-full uppercase tracking-tight">
                            <EyeOff className="h-3 w-3" />
                            {t("settings.security.invisible")}
                        </div>
                    </div>

                    {filteredBlocked.length === 0 && blockedPeers.length > 0 ? (
                        <p className="text-[10px] italic text-zinc-400 text-center py-2">{t("settings.security.noBlockedFound")}</p>
                    ) : (
                        <div className="grid gap-2">
                            {filteredBlocked.map((pk) => (
                                <div key={pk} className="flex items-center justify-between p-3 rounded-xl border border-red-100 dark:border-red-900/20 bg-red-50/30 dark:bg-red-950/10">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="h-9 w-9 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                                            <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-mono truncate text-red-700/70 dark:text-red-400/70">
                                                {pk}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 shrink-0 ml-4">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-[10px] font-bold text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30 px-3 h-8 rounded-lg transition-colors"
                                            onClick={() => blocklist.removeBlocked({ publicKeyHex: pk as any })}
                                        >
                                            {t("settings.blocklist.unblock")}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            <Card className="p-4 bg-purple-500/5 border-purple-500/10 shadow-none">
                <div className="flex items-start gap-4">
                    <div className="h-10 w-10 shrink-0 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <ShieldCheck className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="space-y-1">
                        <h4 className="text-sm font-bold text-purple-900 dark:text-purple-300">{t("settings.security.guideTitle")}</h4>
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-sm space-y-1">
                            <span className="block">{t("settings.security.acceptedDesc")}</span>
                            <span className="block">{t("settings.security.mutedDesc")}</span>
                            <span className="block">{t("settings.security.blockedDesc")}</span>
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
}
