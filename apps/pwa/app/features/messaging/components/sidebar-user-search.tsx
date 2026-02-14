"use client";

import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ProfileSearchService, type ProfileSearchResult } from "../../search/services/profile-search-service";
import { useRelay } from "../../relays/providers/relay-provider";
import { Avatar, AvatarImage, AvatarFallback } from "@/app/components/ui/avatar";
import { Button } from "@/app/components/ui/button";
import { Search, UserPlus, Loader2, Info } from "lucide-react";
import { useIdentity } from "../../auth/hooks/use-identity";

/**
 * Global User Search for Sidebar
 */
export const SidebarUserSearch = ({ onUserSelect }: { onUserSelect: (user: ProfileSearchResult) => void }) => {
    const { t } = useTranslation();
    const { relayPool: pool } = useRelay();
    const { state: identityState } = useIdentity();

    const [query, setQuery] = useState("");
    const [results, setResults] = useState<ProfileSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);

    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const searchService = useRef<ProfileSearchService | null>(null);

    useEffect(() => {
        if (pool) {
            searchService.current = new ProfileSearchService(
                pool as any,
                undefined, // Social graph is optional
                identityState.publicKeyHex
            );
        }
    }, [pool, identityState.publicKeyHex]);

    const handleSearch = (val: string) => {
        setQuery(val);
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

        if (val.length < 3) {
            setResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        setShowResults(true);

        searchTimeoutRef.current = setTimeout(async () => {
            if (!searchService.current) return;
            const searchResults = await searchService.current.searchByName(val);
            setResults(searchResults);
            setIsSearching(false);
        }, 500);
    };

    return (
        <div className="relative w-full">
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 transition-colors group-focus-within:text-purple-500" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder={t("messaging.searchGlobalUsers")}
                    className="w-full pl-9 pr-4 py-2 text-[11px] bg-black/[0.02] dark:bg-white/[0.02] border border-transparent focus:bg-white dark:focus:bg-zinc-900 focus:border-purple-500/20 rounded-2xl transition-all outline-none"
                    onFocus={() => query.length >= 3 && setShowResults(true)}
                />
                {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-purple-500/50" />
                )}
            </div>

            {showResults && (query.length >= 3) && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowResults(false)}
                    />
                    <div className="absolute top-full left-0 w-[280px] mt-2 bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 rounded-[24px] shadow-2xl z-50 overflow-hidden max-h-80 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="p-3 border-b border-black/[0.03] dark:border-white/[0.03] bg-zinc-50/50 dark:bg-zinc-800/50 flex items-center gap-2">
                            <Info className="h-3 w-3 text-zinc-400" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{t("messaging.globalDiscovery")}</span>
                        </div>

                        {results.length === 0 && !isSearching ? (
                            <div className="p-6 text-center text-xs text-zinc-500 italic">
                                {t("common.noUsersFound")}
                            </div>
                        ) : (
                            <div className="p-1">
                                {results.map((user) => (
                                    <button
                                        key={user.pubkey}
                                        onClick={() => {
                                            onUserSelect(user);
                                            setShowResults(false);
                                            setQuery("");
                                        }}
                                        className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group text-left"
                                    >
                                        <Avatar className="h-10 w-10 border border-black/5 dark:border-white/5 shadow-sm">
                                            <AvatarImage src={user.picture} />
                                            <AvatarFallback className="text-[10px] font-black bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900">
                                                {(user.displayName || user.name || "?").slice(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 overflow-hidden">
                                                <span className="text-xs font-bold truncate text-zinc-900 dark:text-zinc-100">
                                                    {user.displayName || user.name || t("common.unknown")}
                                                </span>
                                                {user.nip05 && (
                                                    <div className="flex h-3 w-3 items-center justify-center rounded-full bg-blue-500 text-[6px] text-white" title={user.nip05}>
                                                        ✓
                                                    </div>
                                                )}
                                                {user.trustScore && user.trustScore > 0 && (
                                                    <div className="flex h-3 w-3 items-center justify-center rounded-full bg-amber-500 text-[6px] text-white">
                                                        ★
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] text-zinc-500 truncate">
                                                <span className="font-mono">{user.pubkey.slice(0, 8)}</span>
                                                {user.mutuals && user.mutuals.length > 0 && (
                                                    <span className="flex items-center gap-0.5 text-purple-500 font-bold">
                                                        • {user.mutuals.length} {t("common.mutuals")}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity mr-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-600"
                                                onClick={(e: React.MouseEvent) => {
                                                    e.stopPropagation();
                                                    onUserSelect(user);
                                                    setShowResults(false);
                                                    setQuery("");
                                                }}
                                            >
                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-600"
                                            >
                                                <UserPlus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};
