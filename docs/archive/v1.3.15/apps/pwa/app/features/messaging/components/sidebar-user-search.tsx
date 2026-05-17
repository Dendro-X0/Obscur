"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ProfileSearchService, type ProfileSearchResult } from "../../search/services/profile-search-service";
import { useRelay } from "../../relays/providers/relay-provider";
import { Avatar, AvatarImage, AvatarFallback } from "@dweb/ui-kit";
import { Button } from "@dweb/ui-kit";
import { Search, UserPlus, Loader2, Info } from "lucide-react";
import { useIdentity } from "../../auth/hooks/use-identity";

type SidebarUserSearchProps = Readonly<{
    query: string;
    onQueryChange: (value: string) => void;
    inputRef?: React.RefObject<HTMLInputElement | null>;
    onUserSelect: (user: ProfileSearchResult) => void;
    dismissSignal?: string;
}>;

export const SidebarUserSearch = ({ query, onQueryChange, inputRef, onUserSelect, dismissSignal }: SidebarUserSearchProps) => {
    const { t } = useTranslation();
    const { relayPool: pool } = useRelay();
    const { state: identityState } = useIdentity();
    const pathname = usePathname();

    const [results, setResults] = useState<ProfileSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const normalizedQuery = query.trim();
    const shouldSearchGlobalUsers = normalizedQuery.length >= 3;

    const searchService = useMemo(() => {
        if (!pool) {
            return null;
        }

        return new ProfileSearchService(
            pool as any,
            undefined,
            identityState.publicKeyHex
        );
    }, [identityState.publicKeyHex, pool]);

    useEffect(() => {
        if (!shouldSearchGlobalUsers) {
            setResults([]);
            setIsSearching(false);
            return;
        }

        if (!searchService) {
            setIsSearching(false);
            return;
        }

        let cancelled = false;
        setIsSearching(true);

        const timeoutId = window.setTimeout(async () => {
            try {
                const searchResults = await searchService.searchByName(normalizedQuery);
                if (!cancelled) {
                    setResults(searchResults);
                }
            } finally {
                if (!cancelled) {
                    setIsSearching(false);
                }
            }
        }, 350);

        return () => {
            cancelled = true;
            window.clearTimeout(timeoutId);
        };
    }, [normalizedQuery, searchService, shouldSearchGlobalUsers]);

    useEffect(() => {
        if (!shouldSearchGlobalUsers) {
            setShowResults(false);
        }
    }, [shouldSearchGlobalUsers]);

    useEffect(() => {
        setShowResults(false);
    }, [dismissSignal, pathname]);

    useEffect(() => {
        if (!showResults) {
            return;
        }
        const handlePointerDown = (event: PointerEvent): void => {
            const container = containerRef.current;
            if (!container) {
                return;
            }
            const target = event.target;
            if (!(target instanceof Node)) {
                return;
            }
            if (!container.contains(target)) {
                setShowResults(false);
            }
        };
        const handleEscape = (event: KeyboardEvent): void => {
            if (event.key === "Escape") {
                setShowResults(false);
            }
        };
        document.addEventListener("pointerdown", handlePointerDown, true);
        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("pointerdown", handlePointerDown, true);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [showResults]);

    return (
        <div ref={containerRef} className="relative w-full">
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 transition-colors group-focus-within:text-purple-500" />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => {
                        const nextValue = e.target.value;
                        onQueryChange(nextValue);
                        if (nextValue.trim().length >= 3) {
                            setShowResults(true);
                        } else {
                            setShowResults(false);
                        }
                    }}
                    placeholder={t("messaging.searchUnified", "Search users and communities...")}
                    className="w-full h-11 pl-9 pr-10 text-[11px] bg-black/[0.02] dark:bg-white/[0.02] border border-transparent focus:bg-white dark:focus:bg-zinc-900 focus:border-purple-500/20 rounded-2xl transition-all outline-none"
                    onFocus={() => shouldSearchGlobalUsers && setShowResults(true)}
                    suppressHydrationWarning
                    data-testid="sidebar-unified-search-input"
                />
                {isSearching ? (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-purple-500/50" />
                ) : null}
            </div>

            {showResults && shouldSearchGlobalUsers ? (
                <div className="absolute top-full left-0 w-[280px] mt-2 bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 rounded-[24px] shadow-2xl z-50 overflow-hidden max-h-80 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-3 border-b border-black/[0.03] dark:border-white/[0.03] bg-zinc-50/50 dark:bg-zinc-800/50 flex items-center gap-2">
                        <Info className="h-4 w-4 text-zinc-400" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{t("messaging.globalDiscovery")}</span>
                    </div>

                    {results.length === 0 && !isSearching ? (
                        <div className="p-6 text-center text-xs text-zinc-500 italic">
                            {t("common.noUsersFound")}
                        </div>
                    ) : (
                        <div className="p-1">
                            {results.map((user) => (
                                <div
                                    role="button"
                                    tabIndex={0}
                                    key={user.pubkey}
                                    onClick={() => {
                                        onUserSelect(user);
                                        setShowResults(false);
                                        onQueryChange("");
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            onUserSelect(user);
                                            setShowResults(false);
                                            onQueryChange("");
                                        }
                                    }}
                                    className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group text-left cursor-pointer outline-none focus-visible:bg-zinc-50 dark:focus-visible:bg-zinc-800/50"
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
                                            {user.nip05 ? (
                                                <div className="flex h-3 w-3 items-center justify-center rounded-full bg-blue-500 text-[6px] text-white" title={user.nip05}>
                                                    V
                                                </div>
                                            ) : null}
                                            {user.trustScore && user.trustScore > 0 ? (
                                                <div className="flex h-3 w-3 items-center justify-center rounded-full bg-amber-500 text-[6px] text-white">
                                                    *
                                                </div>
                                            ) : null}
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 truncate">
                                            <span>{t("messaging.identityHidden", "Identity hidden")}</span>
                                            {user.mutuals && user.mutuals.length > 0 ? (
                                                <span className="flex items-center gap-0.5 text-purple-500 font-bold">
                                                    + {user.mutuals.length} {t("common.mutuals")}
                                                </span>
                                            ) : null}
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
                                                onQueryChange("");
                                            }}
                                        >
                                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-600"
                                        >
                                            <UserPlus className="h-5 w-5" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : null}
        </div>
    );
};
