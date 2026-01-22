"use client";

import React from "react";
import { MessageSquarePlus, QrCode, Search, UserPlus } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

interface EmptyStateHeroProps {
    onNewChat: () => void;
    onNewGroup: () => void;
    onSearch: () => void;
    myPublicKeyHex?: string;
}

/**
 * EmptyStateHero component
 * A welcoming hero section for when no conversation is selected.
 */
export function EmptyStateHero({ onNewChat, onNewGroup, onSearch, myPublicKeyHex }: EmptyStateHeroProps) {
    return (
        <div className="flex flex-1 items-center justify-center p-6 bg-gradient-to-b from-transparent to-zinc-50/30 dark:to-zinc-950/20">
            <div className="w-full max-w-2xl space-y-10 text-center">
                <div className="space-y-6">
                    <div className="flex justify-center">
                        <div className="relative">
                            <div className="flex h-28 w-28 items-center justify-center rounded-[2.5rem] bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 shadow-2xl ring-1 ring-black/5 dark:ring-white/10 group hover:scale-105 transition-transform duration-500">
                                <MessageSquarePlus className="h-12 w-12 text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors" />
                            </div>
                            <div className="absolute -bottom-3 -right-3 h-12 w-12 rounded-2xl bg-zinc-950 dark:bg-zinc-50 flex items-center justify-center shadow-xl transform rotate-12 ring-4 ring-zinc-50 dark:ring-black">
                                <QrCode className="h-6 w-6 text-white dark:text-zinc-950" />
                            </div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-5xl">
                            Start messaging
                        </h2>
                        <p className="mx-auto max-w-md text-base text-zinc-600 dark:text-zinc-400">
                            Obscur is a private, decentralized messenger. Choose an option below to begin.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Button
                        variant="primary"
                        size="lg"
                        className="h-20 text-lg rounded-3xl shadow-lg border border-white/10 hover:shadow-emerald-500/10 transition-all active:scale-95"
                        onClick={onNewChat}
                    >
                        <UserPlus className="mr-3 h-6 w-6" />
                        Find Friend
                    </Button>
                    <Button
                        variant="secondary"
                        size="lg"
                        className="h-20 text-lg rounded-3xl shadow-lg border border-black/5 dark:border-white/5 transition-all active:scale-95"
                        onClick={onNewGroup}
                    >
                        <MessageSquarePlus className="mr-3 h-6 w-6" />
                        Create Group
                    </Button>
                </div>

                <div className="pt-4">
                    <Button
                        variant="ghost"
                        onClick={onSearch}
                        className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                    >
                        <Search className="mr-2 h-4 w-4" />
                        Search by public key
                    </Button>
                </div>

                {myPublicKeyHex && (
                    <Card className="bg-white/40 dark:bg-zinc-950/40 backdrop-blur-xl border-dashed border-zinc-300 dark:border-zinc-800 p-1">
                        <div className="p-4 space-y-3">
                            <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Your Shareable Public Key</div>
                            <div className="font-mono text-[10px] break-all p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 select-all">
                                {myPublicKeyHex}
                            </div>
                            <div className="flex items-center justify-center gap-4 text-[11px] text-zinc-500">
                                <div className="flex items-center gap-1">
                                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    Encrypted
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                    Local-first
                                </div>
                            </div>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
}
