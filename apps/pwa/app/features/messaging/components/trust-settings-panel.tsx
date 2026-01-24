"use client";

import React from "react";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { User, ShieldCheck, ShieldOff, VolumeX, Volume2, Search, Trash2 } from "lucide-react";
import { usePeerTrust } from "../../../lib/use-peer-trust";
import { useIdentity } from "../../../lib/use-identity";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { useState } from "react";

export function TrustSettingsPanel() {
    const identity = useIdentity();
    const peerTrust = usePeerTrust({ publicKeyHex: identity.state.publicKeyHex ?? null });
    const [searchQuery, setSearchQuery] = useState("");

    const acceptedPeers = peerTrust.state.acceptedPeers;
    const mutedPeers = peerTrust.state.mutedPeers;

    const filteredAccepted = acceptedPeers.filter(pk =>
        pk.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredMuted = mutedPeers.filter(pk =>
        pk.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <Input
                    placeholder="Search peers by public key..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <section className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500">
                        Accepted Peers ({acceptedPeers.length})
                    </h3>
                    <div className="flex items-center gap-2 text-[10px] text-emerald-600 font-bold bg-emerald-500/10 px-2 py-1 rounded-full uppercase tracking-tighter">
                        <ShieldCheck className="h-3 w-3" /> Auto-Accept Active
                    </div>
                </div>

                {filteredAccepted.length === 0 ? (
                    <Card className="p-8 text-center text-zinc-400 bg-zinc-50/50 dark:bg-zinc-900/50 border-dashed">
                        <p className="text-xs italic">No accepted peers found matching your search.</p>
                    </Card>
                ) : (
                    <div className="grid gap-2">
                        {filteredAccepted.map((pk) => (
                            <div key={pk} className="flex items-center justify-between p-3 rounded-xl border border-black/5 dark:border-white/5 bg-white dark:bg-zinc-900 shadow-sm">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                                        <User className="h-4 w-4 text-zinc-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-mono truncate text-zinc-600 dark:text-zinc-400">
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
                                        title="Mute Peer"
                                    >
                                        <VolumeX className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-zinc-400 hover:text-red-500"
                                        onClick={() => peerTrust.unacceptPeer({ publicKeyHex: pk })}
                                        title="Revoke Trust"
                                    >
                                        <ShieldOff className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {mutedPeers.length > 0 && (
                <section className="space-y-3 pt-4 border-t border-black/5 dark:border-white/5">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500">
                        Muted Peers ({mutedPeers.length})
                    </h3>

                    <div className="grid gap-2">
                        {filteredMuted.map((pk) => (
                            <div key={pk} className="flex items-center justify-between p-3 rounded-xl border border-black/5 dark:border-white/5 bg-zinc-50 dark:bg-zinc-950/60 opacity-60">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0">
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
                                        title="Unmute Peer"
                                    >
                                        <Volume2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <Card className="p-4 bg-purple-500/5 border-purple-500/10">
                <div className="flex items-start gap-3">
                    <ShieldCheck className="h-5 w-5 text-purple-600 mt-0.5 shrink-0" />
                    <div>
                        <h4 className="text-sm font-bold text-purple-900 dark:text-purple-300">About Privacy & Trust</h4>
                        <p className="mt-1 text-xs text-purple-700/70 dark:text-purple-400/70 leading-relaxed">
                            Accepted peers skip the request inbox and can see your presence updates.
                            Users with your invite codes are automatically added here.
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
}
