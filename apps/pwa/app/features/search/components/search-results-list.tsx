import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";
import { Button } from "@/app/components/ui/button";
import { CheckCircle2, UserCheck } from "lucide-react";
import type { ProfileSearchResult } from "../services/profile-search-service";

interface SearchResultsListProps {
    results: ProfileSearchResult[];
    onSelect: (result: ProfileSearchResult) => void;
    isAccepted: (pubkey: string) => boolean;
    showSuggestions?: boolean;
}

export function SearchResultsList({ results, onSelect, isAccepted, showSuggestions }: SearchResultsListProps) {
    if (results.length === 0) {
        if (showSuggestions) {
            const SUGGESTED_RELAYS = [
                "wss://relay.damus.io",
                "wss://nos.lol",
                "wss://relay.primal.net",
                "wss://purplepag.es"
            ];

            return (
                <div className="mt-4 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-center">
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">No users found.</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                        Try searching on these popular relays:
                    </p>
                    <div className="mt-2 text-xs font-mono bg-white dark:bg-black/20 rounded border border-zinc-100 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
                        {SUGGESTED_RELAYS.map(relay => (
                            <div key={relay} className="p-1.5 hover:bg-zinc-50 dark:hover:bg-white/5 select-all">
                                {relay}
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        return null;
    }

    return (
        <div className="mt-4 space-y-2 max-h-72 overflow-y-auto pr-1">
            <p className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider px-1 mb-2">Search Results</p>
            {results.map((profile) => {
                const trusted = isAccepted(profile.pubkey);
                const displayName = profile.displayName || profile.name || "Anonymous";
                return (
                    <button
                        key={profile.pubkey}
                        onClick={() => onSelect(profile)}
                        className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-transparent hover:border-black/5 dark:hover:border-white/5 transition-all text-left group"
                    >
                        <Avatar className="h-11 w-11 border border-black/5 dark:border-white/10 shrink-0">
                            {profile.picture ? (
                                <AvatarImage src={profile.picture} alt={profile.name} className="object-cover" />
                            ) : null}
                            <AvatarFallback className="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs font-bold">
                                {(profile.displayName || profile.name || "A").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                    {displayName}
                                </h3>
                                {profile.nip05 && (
                                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono" title={profile.nip05}>
                                        {profile.nip05.replace('_@', '')}
                                    </span>
                                )}
                            </div>

                            {/* Trust Signals */}
                            <div className="flex items-center gap-2 mt-0.5">
                                {trusted && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 uppercase tracking-tighter shadow-sm border border-emerald-200 dark:border-emerald-500/10">
                                        Trusted
                                    </span>
                                )}
                                {profile.mutuals && profile.mutuals.length > 0 && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20">
                                        <UserCheck className="w-3 h-3" />
                                        {profile.mutuals.length} Mutual{profile.mutuals.length !== 1 ? 's' : ''}
                                    </span>
                                )}
                            </div>

                            {profile.about && (
                                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-snug mt-1">
                                    {profile.about}
                                </p>
                            )}
                            <p className="text-[9px] text-zinc-400 dark:text-zinc-500 font-mono">
                                {profile.pubkey.slice(0, 12)}...{profile.pubkey.slice(-8)}
                            </p>
                        </div>
                        <div className="self-center">
                            <Button variant="secondary" size="sm" className="h-8 px-3 text-[11px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                Select
                            </Button>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
