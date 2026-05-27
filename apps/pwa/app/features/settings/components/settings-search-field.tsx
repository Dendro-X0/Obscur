"use client";

import React from "react";
import { Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/app/lib/utils";
import { Input } from "@dweb/ui-kit";
import { SEARCH_TARGET_FLASH_CLASS } from "@/app/shared/search-target-highlight";
import {
    filterSettingsSearchEntries,
    type SettingsSearchEntry,
} from "../services/settings-search-index";

export type SettingsSearchNavigateParams = Readonly<{
    tab: SettingsSearchEntry["tab"];
    elementId?: string;
    entryId: string;
}>;

type SettingsSearchFieldProps = Readonly<{
    className?: string;
    onNavigate: (params: SettingsSearchNavigateParams) => void;
}>;

export function SettingsSearchField({
    className,
    onNavigate,
}: SettingsSearchFieldProps): React.JSX.Element {
    const { t } = useTranslation();
    const [query, setQuery] = React.useState("");
    const [isFocused, setIsFocused] = React.useState(false);
    const [selectedEntryFlashId, setSelectedEntryFlashId] = React.useState<string | null>(null);
    const selectedEntryFlashTimeoutRef = React.useRef<number | null>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const results = React.useMemo(
        () => filterSettingsSearchEntries(query),
        [query],
    );

    const showResults = isFocused && query.trim().length > 0;

    React.useEffect(() => () => {
        if (selectedEntryFlashTimeoutRef.current !== null) {
            window.clearTimeout(selectedEntryFlashTimeoutRef.current);
        }
    }, []);

    const handleSelect = (entry: SettingsSearchEntry): void => {
        setSelectedEntryFlashId(entry.id);
        if (selectedEntryFlashTimeoutRef.current !== null) {
            window.clearTimeout(selectedEntryFlashTimeoutRef.current);
        }
        selectedEntryFlashTimeoutRef.current = window.setTimeout(() => {
            setSelectedEntryFlashId((current) => (current === entry.id ? null : current));
            selectedEntryFlashTimeoutRef.current = null;
        }, 900);
        onNavigate({ tab: entry.tab, elementId: entry.elementId, entryId: entry.id });
        setQuery("");
        setIsFocused(false);
        inputRef.current?.blur();
    };

    return (
        <div className={cn("relative", className)} data-testid="settings-search-field">
            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                    ref={inputRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => {
                        window.setTimeout(() => setIsFocused(false), 120);
                    }}
                    placeholder={t(
                        "settings.search.placeholder",
                        "Search settings…",
                    )}
                    className="h-10 rounded-xl border-black/10 bg-black/[0.04] pl-10 pr-10 text-sm dark:border-white/10 dark:bg-white/[0.03]"
                    aria-label={t("settings.search.label", "Search settings")}
                    data-testid="settings-search-input"
                />
                {query.length > 0 ? (
                    <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-zinc-500 hover:bg-black/5 dark:hover:bg-white/10"
                        onClick={() => {
                            setQuery("");
                            inputRef.current?.focus();
                        }}
                        aria-label={t("settings.search.clear", "Clear search")}
                    >
                        <X className="h-4 w-4" />
                    </button>
                ) : null}
            </div>
            {showResults ? (
                <div
                    className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-50 max-h-72 overflow-y-auto rounded-xl border border-black/10 bg-white shadow-xl dark:border-white/10 dark:bg-zinc-950"
                    data-testid="settings-search-results"
                >
                    {results.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-zinc-500">
                            {t("settings.search.noResults", "No matching settings.")}
                        </p>
                    ) : (
                        results.map((entry) => (
                            <button
                                key={entry.id}
                                type="button"
                                className={cn(
                                    "flex w-full flex-col gap-0.5 border-b border-black/5 px-4 py-3 text-left last:border-b-0 hover:bg-purple-500/10 dark:border-white/5 dark:hover:bg-purple-500/15",
                                    selectedEntryFlashId === entry.id && SEARCH_TARGET_FLASH_CLASS,
                                )}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => handleSelect(entry)}
                            >
                                <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                                    {entry.title}
                                </span>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                                    {entry.tab}
                                </span>
                                <span className="text-xs text-zinc-500 line-clamp-2">
                                    {entry.description}
                                </span>
                            </button>
                        ))
                    )}
                </div>
            ) : null}
        </div>
    );
}
