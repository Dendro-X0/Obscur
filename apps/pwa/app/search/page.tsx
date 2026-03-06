"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
    Search as SearchIcon,
    ArrowLeft,
    History,
    X,
    Users,
    User,
    Globe,
    Sparkles,
    TrendingUp,
    Filter,
    LayoutGrid,
    List,
    ChevronRight,
    SearchX
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@dweb/ui-kit";
import { Button } from "@dweb/ui-kit";
import { cn } from "@dweb/ui-kit";
import { useNetwork } from "@/app/features/network/providers/network-provider";
import { useGlobalSearch, type SearchResult } from "@/app/features/search/hooks/use-global-search";
import { SearchResultCard } from "@/app/features/search/components/search-result-card";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { PageShell } from "@/app/components/page-shell";
import useNavBadges from "@/app/features/main-shell/hooks/use-nav-badges";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";

type SearchFilter = "all" | "person" | "community";
const getRecentSearchesStorageKey = (): string => getScopedStorageKey("recent_searches");
const LEGACY_RECENT_SEARCHES_STORAGE_KEY = "recent_searches";

export default function SearchPage() {
    const { t } = useTranslation();
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialQuery = searchParams.get("q") || "";

    const { identity } = useNetwork();
    const publicKeyHex = (identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? null) as PublicKeyHex | null;
    const navBadges = useNavBadges({ publicKeyHex });

    const [query, setQuery] = useState(initialQuery);
    const [activeFilter, setActiveFilter] = useState<SearchFilter>("all");
    const [recentSearches, setRecentSearches] = useState<string[]>([]);

    const { results, isSearching, search, clearResults } = useGlobalSearch({
        myPublicKeyHex: publicKeyHex
    });

    // Load recent searches from localStorage
    useEffect(() => {
        const saved = localStorage.getItem(getRecentSearchesStorageKey()) ?? localStorage.getItem(LEGACY_RECENT_SEARCHES_STORAGE_KEY);
        if (saved) {
            try {
                setRecentSearches(JSON.parse(saved));
            } catch (e) {
                setRecentSearches([]);
            }
        }
    }, []);

    const lastSearchedRef = useRef("");

    // Perform initial search if query exists in URL
    useEffect(() => {
        if (initialQuery && initialQuery !== lastSearchedRef.current) {
            search(initialQuery);
            lastSearchedRef.current = initialQuery;
        }
    }, [initialQuery, search]);

    const addToRecent = (searchTerm: string) => {
        if (!searchTerm.trim()) return;
        const next = [searchTerm, ...recentSearches.filter(s => s !== searchTerm)].slice(0, 5);
        setRecentSearches(next);
        localStorage.setItem(getRecentSearchesStorageKey(), JSON.stringify(next));
    };

    const handleSearch = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (query.trim()) {
            search(query);
            addToRecent(query);
            lastSearchedRef.current = query;
            // Update URL without refresh
            const params = new URLSearchParams(searchParams);
            params.set("q", query);
            window.history.replaceState(null, "", `?${params.toString()}`);
        }
    };

    const clearSearch = () => {
        setQuery("");
        clearResults();
        const params = new URLSearchParams(searchParams);
        params.delete("q");
        window.history.replaceState(null, "", `/search`);
    };

    const filteredResults = useMemo(() => {
        if (activeFilter === "all") return results;
        return results.filter(r => r.type === activeFilter);
    }, [results, activeFilter]);

    return (
        <PageShell
            title={t("search.title", "Global Discovery")}
            navBadgeCounts={navBadges.navBadgeCounts}
            hideHeader={true}
        >
            <div className="flex flex-col h-full bg-background overflow-hidden px-0 md:px-4">
            {/* Premium Header */}
            <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/40 p-4 pb-6">
                <div className="max-w-4xl mx-auto w-full space-y-6">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.back()}
                            className="h-10 w-10 rounded-full hover:bg-muted"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <h1 className="text-2xl font-black tracking-tight text-foreground">
                            {t("search.title", "Global Discovery")}
                        </h1>
                    </div>

                    {/* Search Input Box */}
                    <form onSubmit={handleSearch} className="relative group">
                        <div className="absolute inset-x-0 -inset-y-2 bg-primary/5 rounded-[32px] blur-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 pointer-events-none" />
                        <div className="relative flex items-center gap-3 bg-muted/30 border border-border/50 group-focus-within:border-primary/30 group-focus-within:bg-background rounded-[24px] px-6 py-2 shadow-sm transition-all duration-300">
                            <SearchIcon className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={t("search.placeholder", "Search for people, communities, or enter an invite code...")}
                                className="flex-1 h-10 border-none bg-transparent focus-visible:ring-0 text-lg font-medium p-0"
                                autoFocus
                            />
                            {query && (
                                <button
                                    type="button"
                                    onClick={clearSearch}
                                    className="p-1.5 rounded-full hover:bg-muted text-muted-foreground transition-colors"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                            <div className="h-8 w-[1px] bg-border/50 mx-2" />
                            <Button
                                type="submit"
                                disabled={isSearching || !query.trim()}
                                className="h-10 px-6 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 transition-all"
                            >
                                {isSearching ? (
                                    <div className="h-4 w-4 border-2 border-current border-t-transparent animate-spin rounded-full" />
                                ) : (
                                    t("common.search", "Search")
                                )}
                            </Button>
                        </div>
                    </form>

                    {/* Quick Filters */}
                    <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
                        {(["all", "person", "community"] as SearchFilter[]).map((filter) => (
                            <button
                                key={filter}
                                onClick={() => setActiveFilter(filter)}
                                className={cn(
                                    "px-5 h-9 rounded-full text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap border",
                                    activeFilter === filter
                                        ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                                        : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground"
                                )}
                            >
                                {filter === "all" && <Sparkles className="h-3 w-3 inline-block mr-2" />}
                                {filter === "person" && <User className="h-3 w-3 inline-block mr-2" />}
                                {filter === "community" && <Users className="h-3 w-3 inline-block mr-2" />}
                                {t(`search.filter.${filter}`, filter === "all" ? "Expore All" : filter)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto scrollbar-thin pb-24 flex flex-col">
                <div className="max-w-4xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-12">

                    {/* Empty State / Welcome */}
                    {!query && recentSearches.length === 0 && (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-[50vh] text-center animate-in fade-in duration-700">
                            <div className="mb-8 p-10 bg-primary/5 rounded-[48px] relative group">
                                <SearchIcon className="h-16 w-16 text-primary/40 group-hover:scale-110 transition-transform duration-500" />
                                <div className="absolute -top-2 -right-2 h-10 w-10 bg-amber-500/20 rounded-full blur-xl animate-pulse" />
                                <div className="absolute -bottom-2 -left-2 h-10 w-10 bg-indigo-500/20 rounded-full blur-xl animate-pulse delay-700" />
                            </div>
                            <h2 className="text-2xl font-black text-foreground mb-3">
                                {t("search.discoverTitle", "The Network Awaits")}
                            </h2>
                            <p className="max-w-md text-muted-foreground text-sm leading-relaxed mb-8">
                                {t("search.discoverDesc", "Connect with peers, join vibrant communities, or resolve secure invitation codes across the decentralized web.")}
                            </p>
                            <div className="flex flex-wrap justify-center gap-3">
                                {["#privacy", "#decentralized", "#censorship-free"].map(tag => (
                                    <span key={tag} className="px-4 py-2 bg-muted rounded-2xl text-[10px] font-black tracking-widest uppercase opacity-60">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recent Searches */}
                    {!query && recentSearches.length > 0 && (
                        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center justify-between px-2">
                                <div className="flex items-center gap-3">
                                    <History className="h-4 w-4 text-primary" />
                                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/80">
                                        {t("search.recent", "Recent Searches")}
                                    </h3>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-[10px] font-black text-rose-500 hover:text-rose-600 hover:bg-rose-500/5 px-4 rounded-full"
                                    onClick={() => {
                                        setRecentSearches([]);
                                        localStorage.removeItem(getRecentSearchesStorageKey());
                                        localStorage.removeItem(LEGACY_RECENT_SEARCHES_STORAGE_KEY);
                                    }}
                                >
                                    {t("common.clear", "Clear History")}
                                </Button>
                            </div>
                            <div className="flex flex-col gap-2">
                                {recentSearches.map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => {
                                            setQuery(s);
                                            search(s);
                                        }}
                                        className="flex items-center justify-between p-4 rounded-3xl bg-muted/20 hover:bg-muted/50 border border-border/20 transition-all text-left group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="h-8 w-8 rounded-xl bg-background flex items-center justify-center border border-border/50 text-muted-foreground group-hover:text-primary transition-all">
                                                <History className="h-4 w-4" />
                                            </div>
                                            <span className="font-bold text-sm text-foreground/80 group-hover:text-foreground">
                                                {s}
                                            </span>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Results Count Header */}
                    {query && (
                        <div className="flex items-center justify-between px-2 animate-in fade-in duration-300">
                            <div className="flex items-center gap-3">
                                <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
                                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/80">
                                    {isSearching
                                        ? t("search.searching", "Scanning Network...")
                                        : t("search.resultsCount", "{{count}} Results Found", { count: filteredResults.length })}
                                </h3>
                            </div>
                            {isSearching && (
                                <div className="flex items-center gap-2">
                                    <div className="flex gap-1">
                                        {[0, 1, 2].map(i => (
                                            <div key={i} className="h-1 w-4 bg-primary/20 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-primary animate-progress-fast"
                                                    style={{ animationDelay: `${i * 0.2}s` }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Results List */}
                    {query && (
                        <div className="flex flex-col gap-4">
                            {filteredResults.map((result, idx) => (
                                <div key={result.pubkey || result.id || idx} className="animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${idx * 50}ms` }}>
                                    <SearchResultCard result={result} />
                                </div>
                            ))}

                            {!isSearching && filteredResults.length === 0 && (
                                <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-[50vh] text-center">
                                    <div className="h-20 w-20 bg-muted/30 rounded-full flex items-center justify-center mb-6">
                                        <SearchX className="h-10 w-10 text-muted-foreground/40" />
                                    </div>
                                    <h4 className="text-xl font-bold text-foreground">No matches found</h4>
                                    <p className="text-sm text-muted-foreground mt-2 max-w-xs">
                                        We couldn't find anything matching your query. Try a different term or invite code.
                                    </p>
                                    <Button
                                        variant="outline"
                                        className="mt-8 rounded-2xl h-11 px-6 border-border"
                                        onClick={clearSearch}
                                    >
                                        Clear Search
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Discovery Suggestions (Randomized/Trending Placeholder) */}
                    {!query && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
                            <div className="flex items-center justify-between px-2">
                                <div className="flex items-center gap-3">
                                    <TrendingUp className="h-4 w-4 text-amber-500" />
                                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/80">
                                        {t("search.trending", "Trending Communities")}
                                    </h3>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {[
                                    { name: "Global Relay Lounge", label: "Relay Hub", icon: Globe, color: "bg-blue-500" },
                                    { name: "Cypherpunks Network", label: "Protocol Dev", icon: Users, color: "bg-purple-500" },
                                ].map((group) => (
                                    <div key={group.name} className="p-6 rounded-[32px] bg-card/40 border border-border/40 hover:border-primary/20 transition-all group cursor-pointer relative overflow-hidden">
                                        <div className={cn("absolute top-0 right-0 w-32 h-32 blur-[80px] opacity-10 group-hover:opacity-20 transition-opacity", group.color)} />
                                        <div className="flex items-center gap-4 relative z-10">
                                            <div className="h-12 w-12 rounded-2xl bg-muted/80 flex items-center justify-center border border-border/50">
                                                <group.icon className="h-6 w-6 text-foreground/70" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-foreground">{group.name}</h4>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{group.label}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Visual Flare */}
            <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
                <div className="absolute top-[20%] left-[10%] w-[50%] h-[50%] bg-primary/5 blur-[150px] rounded-full animate-pulse opacity-40" />
                <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] bg-indigo-500/5 blur-[150px] rounded-full animate-pulse delay-1000 opacity-40" />
            </div>
            </div>
        </PageShell>
    );
}
