"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@dweb/ui-kit";
import {
    LoaderIcon,
    ImageIcon,
    VideoIcon,
    Music2,
    ExternalLink,
    RefreshCw,
    Trash2,
    HardDrive,
    X,
    MoreVertical,
    Star,
    CheckSquare,
    Square,
    FileIcon,
    FileText,
    Download,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    EyeOff,
    Search,
    ZoomIn,
    ZoomOut,
    RotateCcw,
    Maximize2
} from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useTranslation } from "react-i18next";
import { cn } from "@/app/lib/utils";
import type { VaultMediaItem } from "../hooks/use-vault-media";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { logRuntimeEvent } from "@/app/shared/runtime-log-classification";
import { isGroupConversationId } from "@/app/features/groups/utils/group-conversation-id";

type VaultMediaGridProps = Readonly<{
    mediaItems: ReadonlyArray<VaultMediaItem>;
    isLoading: boolean;
    stats: Readonly<{ imageCount: number; videoCount: number; audioCount: number; fileCount: number; total: number }>;
    refresh: () => void;
    deleteLocalCopy: (remoteUrl: string) => Promise<void>;
}>;

type VisibilityFilter = "all" | "local" | "remote" | "favorites" | "hidden";
type SortMode = "newest" | "oldest" | "file_name";
type VaultSourceKind = "direct" | "community" | "unknown";

const FILTER_STORAGE_KEY = "obscur.vault.filter.preference";
const FAVORITES_STORAGE_KEY = "obscur.vault.favorites";
const HIDDEN_STORAGE_KEY = "obscur.vault.hidden";
const scopedFilterStorageKey = (): string => getScopedStorageKey(FILTER_STORAGE_KEY);
const scopedFavoritesStorageKey = (): string => getScopedStorageKey(FAVORITES_STORAGE_KEY);
const scopedHiddenStorageKey = (): string => getScopedStorageKey(HIDDEN_STORAGE_KEY);

const readHidden = (): ReadonlySet<string> => {
    if (typeof window === "undefined") return new Set<string>();
    try {
        const raw = localStorage.getItem(scopedHiddenStorageKey()) ?? localStorage.getItem(HIDDEN_STORAGE_KEY);
        if (!raw) return new Set<string>();
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return new Set<string>();
        return new Set(parsed.filter((v): v is string => typeof v === "string"));
    } catch {
        return new Set<string>();
    }
};

const persistHidden = (ids: ReadonlySet<string>): void => {
    if (typeof window === "undefined") return;
    localStorage.setItem(scopedHiddenStorageKey(), JSON.stringify(Array.from(ids)));
};

const readFilterPreference = (): VisibilityFilter => {
    if (typeof window === "undefined") return "all";
    const raw = localStorage.getItem(scopedFilterStorageKey()) ?? localStorage.getItem(FILTER_STORAGE_KEY);
    if (raw === "local" || raw === "remote" || raw === "favorites" || raw === "hidden") return raw;
    return "all";
};

const readFavorites = (): ReadonlySet<string> => {
    if (typeof window === "undefined") return new Set<string>();
    try {
        const raw = localStorage.getItem(scopedFavoritesStorageKey()) ?? localStorage.getItem(FAVORITES_STORAGE_KEY);
        if (!raw) return new Set<string>();
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return new Set<string>();
        return new Set(parsed.filter((v): v is string => typeof v === "string"));
    } catch {
        return new Set<string>();
    }
};

const persistFavorites = (favorites: ReadonlySet<string>): void => {
    if (typeof window === "undefined") return;
    localStorage.setItem(scopedFavoritesStorageKey(), JSON.stringify(Array.from(favorites)));
};

const sameMediaUrl = (a: string, b: string): boolean => a.trim() === b.trim();

const buildVideoPreviewUrl = (sourceUrl: string): string => {
    if (!sourceUrl || sourceUrl.includes("#")) {
        return sourceUrl;
    }
    return `${sourceUrl}#t=0.1`;
};

const isPdfAttachment = (attachment: VaultMediaItem["attachment"]): boolean => {
    const contentType = (attachment.contentType ?? "").toLowerCase();
    if (contentType.includes("pdf")) return true;
    const name = (attachment.fileName ?? "").toLowerCase();
    return name.endsWith(".pdf");
};

const resolveVaultSourceKind = (item: VaultMediaItem): VaultSourceKind => {
    const conversationId = item.sourceConversationId?.trim() ?? "";
    if (conversationId.length === 0) {
        return "unknown";
    }
    if (isGroupConversationId(conversationId)) {
        return "community";
    }
    return "direct";
};

export function VaultMediaGrid(props: VaultMediaGridProps) {
    const { t } = useTranslation();
    const router = useRouter();
    const [selectedItem, setSelectedItem] = React.useState<VaultMediaItem | null>(null);
    const [visibilityFilter, setVisibilityFilter] = React.useState<VisibilityFilter>(() => readFilterPreference());
    const [typeFilter, setTypeFilter] = React.useState<"all" | "image" | "video" | "audio" | "file">("all");
    const [favorites, setFavorites] = React.useState<ReadonlySet<string>>(() => readFavorites());
    const [hiddenIds, setHiddenIds] = React.useState<ReadonlySet<string>>(() => readHidden());
    const [searchQuery, setSearchQuery] = React.useState("");
    const [sortMode, setSortMode] = React.useState<SortMode>("newest");
    const [selectionMode, setSelectionMode] = React.useState(false);
    const [selectedIds, setSelectedIds] = React.useState<ReadonlySet<string>>(new Set());
    const [openMenuItemId, setOpenMenuItemId] = React.useState<string | null>(null);
    const [isSortMenuOpen, setIsSortMenuOpen] = React.useState(false);
    const [currentPage, setCurrentPage] = React.useState(1);
    const [itemsPerPage, setItemsPerPage] = React.useState(25);

    React.useEffect(() => {
        const updateItemsPerPage = () => {
            setItemsPerPage(window.innerWidth < 768 ? 12 : 25);
        };
        updateItemsPerPage();
        window.addEventListener("resize", updateItemsPerPage);
        return () => window.removeEventListener("resize", updateItemsPerPage);
    }, []);

    React.useEffect(() => {
        setCurrentPage(1);
    }, [visibilityFilter, typeFilter, searchQuery, sortMode]);

    React.useEffect(() => {
        if (typeof window === "undefined") return;
        localStorage.setItem(scopedFilterStorageKey(), visibilityFilter);
    }, [visibilityFilter]);

    React.useEffect(() => {
        const closeMenus = () => {
            setOpenMenuItemId(null);
            setIsSortMenuOpen(false);
        };
        window.addEventListener("click", closeMenus);
        return () => window.removeEventListener("click", closeMenus);
    }, []);

    const localCount = props.mediaItems.filter((item) => item.isLocalCached).length;
    const remoteCount = props.mediaItems.length - localCount;
    const favoritesCount = props.mediaItems.filter((item) => favorites.has(item.remoteUrl)).length;
    const hiddenCount = props.mediaItems.filter((item) => hiddenIds.has(item.id)).length;

    const normalizedSearchQuery = searchQuery.trim().toLowerCase();

    const filteredItems = props.mediaItems.filter((item) => {
        const isHidden = hiddenIds.has(item.id);
        if (visibilityFilter === "hidden") return isHidden;
        if (isHidden) return false;
        if (visibilityFilter === "local" && !item.isLocalCached) return false;
        if (visibilityFilter === "remote" && item.isLocalCached) return false;
        if (visibilityFilter === "favorites" && !favorites.has(item.remoteUrl)) return false;
        if (typeFilter !== "all" && item.attachment.kind !== typeFilter) return false;
        if (normalizedSearchQuery.length > 0) {
            const contentType = (item.attachment.contentType ?? "").toLowerCase();
            const fileName = (item.attachment.fileName ?? "").toLowerCase();
            const remoteUrl = item.remoteUrl.toLowerCase();
            const kind = item.attachment.kind.toLowerCase();
            const haystack = `${fileName}\n${contentType}\n${remoteUrl}\n${kind}`;
            if (!haystack.includes(normalizedSearchQuery)) {
                return false;
            }
        }
        return true;
    });

    const visibleItems = [...filteredItems].sort((a, b) => {
        const aFav = favorites.has(a.remoteUrl) ? 1 : 0;
        const bFav = favorites.has(b.remoteUrl) ? 1 : 0;
        if (bFav !== aFav) {
            return bFav - aFav;
        }
        if (sortMode === "oldest") {
            return a.timestamp.getTime() - b.timestamp.getTime();
        }
        if (sortMode === "file_name") {
            return a.attachment.fileName.localeCompare(b.attachment.fileName, undefined, { sensitivity: "base" });
        }
        return b.timestamp.getTime() - a.timestamp.getTime();
    });
    const selectedItemIndex = selectedItem
        ? visibleItems.findIndex((item) => item.id === selectedItem.id)
        : -1;
    const hasPreviewPrevious = selectedItemIndex > 0;
    const hasPreviewNext = selectedItemIndex >= 0 && selectedItemIndex < visibleItems.length - 1;

    const totalPages = Math.ceil(visibleItems.length / itemsPerPage);
    const paginatedItems = visibleItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const selectedItems = visibleItems.filter((item) => selectedIds.has(item.id));
    const selectedLocalCount = selectedItems.filter((item) => item.isLocalCached).length;

    const setSelected = (itemId: string, selected: boolean): void => {
        const next = new Set(selectedIds);
        if (selected) next.add(itemId);
        else next.delete(itemId);
        setSelectedIds(next);
    };

    const toggleSelect = (itemId: string): void => {
        setSelected(itemId, !selectedIds.has(itemId));
    };

    const clearSelection = (): void => {
        setSelectedIds(new Set());
        setSelectionMode(false);
    };

    const toggleFavorite = (remoteUrl: string): void => {
        const next = new Set(favorites);
        if (next.has(remoteUrl)) next.delete(remoteUrl);
        else next.add(remoteUrl);
        setFavorites(next);
        persistFavorites(next);
    };

    const handleBulkFavorite = (): void => {
        const next = new Set(favorites);
        selectedItems.forEach((item) => next.add(item.remoteUrl));
        setFavorites(next);
        persistFavorites(next);
    };

    const handleBulkHide = (): void => {
        const next = new Set(hiddenIds);
        selectedIds.forEach((id) => next.add(id));
        setHiddenIds(next);
        persistHidden(next);
        clearSelection();
    };

    const handleHideItem = (itemId: string): void => {
        const next = new Set(hiddenIds);
        next.add(itemId);
        setHiddenIds(next);
        persistHidden(next);
    };

    const handleRestoreItem = (itemId: string): void => {
        const next = new Set(hiddenIds);
        next.delete(itemId);
        setHiddenIds(next);
        persistHidden(next);
    };

    const handleBulkRestore = (): void => {
        const next = new Set(hiddenIds);
        selectedIds.forEach((id) => next.delete(id));
        setHiddenIds(next);
        persistHidden(next);
        clearSelection();
    };

    const openSourceConversation = React.useCallback((item: VaultMediaItem): void => {
        if (!item.sourceConversationId) {
            return;
        }
        void router.push(`/?convId=${encodeURIComponent(item.sourceConversationId)}`);
    }, [router]);

    const getSourceLabel = React.useCallback((item: VaultMediaItem): string => {
        const sourceKind = resolveVaultSourceKind(item);
        if (sourceKind === "community") {
            return t("vault.origin.community", "Community");
        }
        if (sourceKind === "direct") {
            return t("vault.origin.direct", "Direct message");
        }
        return t("vault.origin.chat", "Chat");
    }, [t]);

    const getSourceDescription = React.useCallback((item: VaultMediaItem): string => {
        const sourceKind = resolveVaultSourceKind(item);
        if (sourceKind === "community") {
            return t("vault.origin.communitySource", "Community source");
        }
        if (sourceKind === "direct") {
            return t("vault.origin.directSource", "Direct message source");
        }
        return t("vault.origin.chatSource", "Chat source");
    }, [t]);

    const getOpenSourceLabel = React.useCallback((item: VaultMediaItem): string => {
        const sourceKind = resolveVaultSourceKind(item);
        if (sourceKind === "community") {
            return t("vault.actions.openCommunity", "Open Community");
        }
        if (sourceKind === "direct") {
            return t("vault.actions.openDirectMessage", "Open Direct Message");
        }
        return t("vault.actions.openSourceChat", "Open Source Chat");
    }, [t]);

    const handleBulkDeleteLocal = async (): Promise<void> => {
        const localSelected = selectedItems.filter((item) => item.isLocalCached);
        await Promise.all(localSelected.map((item) => props.deleteLocalCopy(item.remoteUrl)));
        clearSelection();
        await props.refresh();
    };

    const isNoPreviewTarget = (target: EventTarget | null): boolean => {
        const el = target as HTMLElement | null;
        return !!el?.closest('[data-no-preview="true"]');
    };

    const isInTopRightNoPreviewZone = (
        currentTarget: EventTarget & HTMLDivElement,
        event: React.MouseEvent<HTMLDivElement>
    ): boolean => {
        const rect = currentTarget.getBoundingClientRect();
        const rightInset = rect.right - event.clientX;
        const topInset = event.clientY - rect.top;
        return rightInset >= 0 && rightInset <= 56 && topInset >= 0 && topInset <= 56;
    };

    React.useEffect(() => {
        const handleKeyboardControls = (event: KeyboardEvent): void => {
            if (event.key === "Escape") {
                if (openMenuItemId !== null) {
                    event.preventDefault();
                    event.stopPropagation();
                    setOpenMenuItemId(null);
                    return;
                }
                if (selectedItem) {
                    event.preventDefault();
                    event.stopPropagation();
                    setSelectedItem(null);
                    return;
                }
                return;
            }

            if (!selectedItem) {
                return;
            }

            const target = event.target as HTMLElement | null;
            const isEditableTarget = Boolean(
                target?.isContentEditable
                || (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
            );
            if (isEditableTarget) {
                return;
            }

            if (event.key === "ArrowLeft" && hasPreviewPrevious) {
                event.preventDefault();
                event.stopPropagation();
                setSelectedItem(visibleItems[selectedItemIndex - 1] ?? selectedItem);
                return;
            }

            if (event.key === "ArrowRight" && hasPreviewNext) {
                event.preventDefault();
                event.stopPropagation();
                setSelectedItem(visibleItems[selectedItemIndex + 1] ?? selectedItem);
            }
        };

        window.addEventListener("keydown", handleKeyboardControls);
        return () => {
            window.removeEventListener("keydown", handleKeyboardControls);
        };
    }, [hasPreviewNext, hasPreviewPrevious, openMenuItemId, selectedItem, selectedItemIndex, visibleItems]);

    if (props.isLoading) {
        return (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
                {Array.from({ length: 15 }).map((_, i) => (
                    <div key={i} className="aspect-square rounded-[24px] bg-muted animate-pulse border border-border/50 overflow-hidden relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
                        <div className="absolute bottom-4 left-4 right-8 h-2 bg-white/5 rounded-full" />
                        <div className="absolute bottom-8 left-4 right-12 h-2 bg-white/5 rounded-full" />
                    </div>
                ))}
            </div>
        );
    }

    if (props.mediaItems.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-[50vh] text-center space-y-6 animate-in fade-in duration-700">
                <div className="h-24 w-24 rounded-[32px] bg-muted flex items-center justify-center border border-border/50 shadow-inner">
                    <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
                </div>
                <div className="space-y-1">
                    <h3 className="text-xl font-black">{t("vault.empty", "Vault is Empty")}</h3>
                    <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                        {t("vault.emptyDesc", "Shared media from your chats will appear here automatically.")}
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={props.refresh} className="mt-4 rounded-xl font-bold bg-background shadow-sm hover:scale-105 transition-all">
                    <RefreshCw className="h-3 w-3 mr-2" />
                    {t("common.refresh", "Refresh")}
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                    <Button
                        type="button"
                        variant={typeFilter === "image" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setTypeFilter(prev => prev === "image" ? "all" : "image")}
                        className={cn("h-8 gap-2 rounded-full border px-4 transition-all duration-300", typeFilter === "image" ? "bg-primary/20 border-primary/40 text-primary" : "border-border/40 text-zinc-700 hover:bg-zinc-200/70 dark:text-zinc-200 dark:hover:bg-white/5")}
                    >
                        <ImageIcon className={cn("h-3.5 w-3.5", typeFilter === "image" ? "text-primary" : "text-muted-foreground")} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{props.stats.imageCount} {t("common.images", "Images")}</span>
                    </Button>

                    <Button
                        type="button"
                        variant={typeFilter === "video" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setTypeFilter(prev => prev === "video" ? "all" : "video")}
                        className={cn("h-8 gap-2 rounded-full border px-4 transition-all duration-300", typeFilter === "video" ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-700 dark:text-indigo-300" : "border-border/40 text-zinc-700 hover:bg-zinc-200/70 dark:text-zinc-200 dark:hover:bg-white/5")}
                    >
                        <VideoIcon className={cn("h-3.5 w-3.5", typeFilter === "video" ? "text-indigo-400" : "text-muted-foreground")} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{props.stats.videoCount} {t("common.videos", "Videos")}</span>
                    </Button>

                    <Button
                        type="button"
                        variant={typeFilter === "audio" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setTypeFilter(prev => prev === "audio" ? "all" : "audio")}
                        className={cn("h-8 gap-2 rounded-full border px-4 transition-all duration-300", typeFilter === "audio" ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-700 dark:text-emerald-300" : "border-border/40 text-zinc-700 hover:bg-zinc-200/70 dark:text-zinc-200 dark:hover:bg-white/5")}
                    >
                        <Music2 className={cn("h-3.5 w-3.5", typeFilter === "audio" ? "text-emerald-400" : "text-muted-foreground")} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{props.stats.audioCount} {t("common.audio", "Audio")}</span>
                    </Button>

                    <Button
                        type="button"
                        variant={typeFilter === "file" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setTypeFilter(prev => prev === "file" ? "all" : "file")}
                        className={cn("h-8 gap-2 rounded-full border px-4 transition-all duration-300", typeFilter === "file" ? "bg-amber-500/20 border-amber-500/40 text-amber-700 dark:text-amber-300" : "border-border/40 text-zinc-700 hover:bg-zinc-200/70 dark:text-zinc-200 dark:hover:bg-white/5")}
                    >
                        <FileText className={cn("h-3.5 w-3.5", typeFilter === "file" ? "text-amber-400" : "text-muted-foreground")} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{props.stats.fileCount} Others</span>
                    </Button>

                    <div className="flex items-center gap-1.5 bg-zinc-500/10 px-2 py-1 rounded-full border border-zinc-500/20 ml-2">
                        <Button type="button" variant={visibilityFilter === "all" ? "secondary" : "ghost"} size="sm" onClick={() => setVisibilityFilter("all")} className="h-6 px-2 text-[10px]">All ({props.mediaItems.length})</Button>
                        <Button type="button" variant={visibilityFilter === "local" ? "secondary" : "ghost"} size="sm" onClick={() => setVisibilityFilter("local")} className="h-6 px-2 text-[10px]">Local ({localCount})</Button>
                        <Button type="button" variant={visibilityFilter === "remote" ? "secondary" : "ghost"} size="sm" onClick={() => setVisibilityFilter("remote")} className="h-6 px-2 text-[10px]">Remote ({remoteCount})</Button>
                        <Button type="button" variant={visibilityFilter === "favorites" ? "secondary" : "ghost"} size="sm" onClick={() => setVisibilityFilter("favorites")} className="h-6 px-2 text-[10px]">Favorites ({favoritesCount})</Button>
                        <Button type="button" variant={visibilityFilter === "hidden" ? "secondary" : "ghost"} size="sm" onClick={() => setVisibilityFilter("hidden")} className="h-6 px-2 text-[10px]">Hidden ({hiddenCount})</Button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant={selectionMode ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => {
                            if (selectionMode) clearSelection();
                            else setSelectionMode(true);
                        }}
                        className="rounded-xl font-bold"
                    >
                        {selectionMode ? <CheckSquare className="h-4 w-4 mr-2" /> : <Square className="h-4 w-4 mr-2" />}
                        {selectionMode ? "Cancel Select" : "Select Multiple"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={props.refresh} className="h-8 w-8 p-0 rounded-full hover:bg-muted">
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <label className="relative w-full md:max-w-sm">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 dark:text-zinc-400" />
                    <input
                        type="search"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder={visibilityFilter === "hidden" ? "Search hidden Vault media" : "Search Vault media"}
                        className="h-11 w-full rounded-2xl border border-zinc-300/70 bg-white/85 pl-10 pr-4 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
                    />
                </label>

                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                    Sort
                    <div className="relative" data-no-preview="true">
                        <button
                            type="button"
                            aria-haspopup="listbox"
                            aria-expanded={isSortMenuOpen}
                            aria-label={`Sort Vault media: ${sortMode === "newest" ? "Newest first" : sortMode === "oldest" ? "Oldest first" : "File name"}`}
                            onClick={(event) => {
                                event.stopPropagation();
                                setIsSortMenuOpen((current) => !current);
                            }}
                            className="flex h-11 min-w-[132px] items-center justify-between gap-3 rounded-2xl border border-zinc-300/70 bg-white/90 px-4 text-sm font-semibold normal-case tracking-normal text-zinc-900 shadow-sm outline-none transition hover:bg-white focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/20 dark:border-white/10 dark:bg-white/8 dark:text-zinc-100 dark:hover:bg-white/12"
                        >
                            <span>{sortMode === "newest" ? "Newest first" : sortMode === "oldest" ? "Oldest first" : "File name"}</span>
                            <ChevronDown className={cn("h-4 w-4 text-zinc-500 transition-transform dark:text-zinc-300", isSortMenuOpen && "rotate-180")} />
                        </button>
                        {isSortMenuOpen ? (
                            <div
                                role="listbox"
                                className="absolute right-0 top-full z-40 mt-2 min-w-[180px] overflow-hidden rounded-2xl border border-zinc-200 bg-white/98 p-1.5 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-950/96"
                            >
                                {([
                                    { value: "newest", label: "Newest first" },
                                    { value: "oldest", label: "Oldest first" },
                                    { value: "file_name", label: "File name" },
                                ] as const).map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        role="option"
                                        aria-selected={sortMode === option.value}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setSortMode(option.value);
                                            setIsSortMenuOpen(false);
                                        }}
                                        className={cn(
                                            "flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors",
                                            sortMode === option.value
                                                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
                                                : "text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-white/8"
                                        )}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </label>
            </div>

            {selectionMode && selectedIds.size > 0 && (
                <div className="rounded-2xl border border-border bg-muted/20 p-3 flex items-center gap-2 flex-wrap">
                    <div className="text-sm font-bold mr-2 ml-2">{selectedIds.size} selected</div>
                    <Button type="button" variant="secondary" size="sm" onClick={handleBulkFavorite} className="rounded-xl">
                        <Star className="h-4 w-4 mr-1.5" />
                        Favorite
                    </Button>
                    {visibilityFilter === "hidden" ? (
                        <Button type="button" variant="secondary" size="sm" onClick={handleBulkRestore} className="rounded-xl">
                            <EyeOff className="h-4 w-4 mr-1.5" />
                            Restore
                        </Button>
                    ) : (
                        <Button type="button" variant="secondary" size="sm" onClick={handleBulkHide} className="rounded-xl">
                            <EyeOff className="h-4 w-4 mr-1.5" />
                            Hide
                        </Button>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={() => void handleBulkDeleteLocal()} disabled={selectedLocalCount === 0} className="rounded-xl">
                        <Trash2 className="h-4 w-4 mr-1.5" />
                        Delete Local ({selectedLocalCount})
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={clearSelection} className="rounded-xl ml-auto">Clear</Button>
                </div>
            )}

            {paginatedItems.length === 0 ? (
                <div className="rounded-2xl border border-border/50 bg-muted/20 p-12 text-center text-sm text-muted-foreground font-medium">
                    {visibilityFilter === "hidden"
                        ? "No hidden items. Hidden Vault media will appear here until restored."
                        : "No items found in this section."}
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
                    {paginatedItems.map((item, index) => {
                        const isFavorite = favorites.has(item.remoteUrl);
                        const isSelected = selectedIds.has(item.id);
                        const showMenu = openMenuItemId === item.id;
                        const sourceLabel = getSourceLabel(item);
                        const openSourceLabel = getOpenSourceLabel(item);

                        return (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: index * 0.02 }}
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                    if (isNoPreviewTarget(e.target) || isInTopRightNoPreviewZone(e.currentTarget, e)) return;
                                    if (selectionMode) {
                                        toggleSelect(item.id);
                                        return;
                                    }
                                    setSelectedItem(item);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        if (selectionMode) toggleSelect(item.id);
                                        else setSelectedItem(item);
                                    }
                                }}
                                className={cn(
                                    "group relative aspect-square rounded-[24px] bg-muted border border-border/50 hover:shadow-2xl hover:shadow-primary/5 transition-all text-left outline-none focus-visible:ring-2 focus-visible:ring-primary overflow-visible",
                                    isSelected && "ring-2 ring-primary border-primary/50"
                                )}
                            >
                                <div className="absolute inset-0 overflow-hidden rounded-[24px]">
                                    <div className="absolute inset-0 z-0">
                                        {item.attachment.kind === "image" ? (
                                            <VaultImageTile item={item} />
                                        ) : item.attachment.kind === "video" ? (
                                            <VaultVideoTile item={item} />
                                        ) : item.attachment.kind === "audio" ? (
                                            <div className="w-full h-full flex flex-col items-center justify-center bg-emerald-500/5 transition-colors group-hover:bg-emerald-500/10">
                                                <Music2 className="h-8 w-8 text-emerald-500/50" />
                                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-500/50 mt-2">AUDIO</span>
                                            </div>
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center bg-amber-500/5 transition-colors group-hover:bg-amber-500/10 text-center p-4">
                                                <FileIcon className="h-8 w-8 text-amber-500/50" />
                                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-500/50 mt-2">
                                                    {isPdfAttachment(item.attachment) ? "PDF" : "OTHER"}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-5">
                                        <div className="text-[10px] text-white font-black truncate drop-shadow-lg">{item.attachment.fileName}</div>
                                        <div className="text-[9px] text-white/50 font-medium">{item.timestamp.toLocaleDateString()}</div>
                                    </div>
                                </div>

                                <div className="absolute left-3 top-3 z-10 flex max-w-[70%] flex-col gap-1.5">
                                    <div className="rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-widest bg-black/60 text-white backdrop-blur-md border border-white/5">
                                        {item.isLocalCached ? "Local" : "Remote"}
                                    </div>
                                    {item.sourceConversationId ? (
                                        <div
                                            className="rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-widest bg-white/88 text-zinc-900 backdrop-blur-md border border-white/40"
                                            aria-label={t("vault.origin.badgeAria", "Source: {{label}}", { label: sourceLabel })}
                                        >
                                            {sourceLabel}
                                        </div>
                                    ) : (
                                        null
                                    )}
                                </div>

                                {isFavorite && (
                                    <div data-no-preview="true" className="absolute top-3 right-12 rounded-lg bg-amber-400 p-1.5 text-black shadow-lg z-10">
                                        <Star className="h-3 w-3 fill-current" />
                                    </div>
                                )}

                                {selectionMode ? (
                                    <button
                                        data-no-preview="true"
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleSelect(item.id);
                                        }}
                                        className={cn(
                                            "absolute top-3 right-3 h-8 w-8 rounded-xl flex items-center justify-center z-20 transition-all",
                                            isSelected ? "bg-primary text-primary-foreground scale-110 shadow-lg" : "bg-black/40 text-white backdrop-blur-md border border-white/10"
                                        )}
                                    >
                                        {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                                    </button>
                                ) : (
                                    <div data-no-preview="true" className="absolute top-2 right-2 z-20">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenMenuItemId(prev => prev === item.id ? null : item.id);
                                            }}
                                            aria-label={`Vault item actions for ${item.attachment.fileName}`}
                                            className="h-9 w-9 rounded-xl bg-black/40 text-white flex items-center justify-center backdrop-blur-md border border-white/5 hover:bg-black/60 transition-colors"
                                        >
                                            <MoreVertical className="h-4 w-4" />
                                        </button>
                                        {showMenu && (
                                            <div
                                                data-escape-layer="open"
                                                className="absolute right-0 mt-2 min-w-[170px] rounded-[18px] border border-zinc-200 bg-white/95 backdrop-blur-2xl p-1.5 shadow-2xl z-30 animate-in fade-in zoom-in duration-200"
                                            >
                                                <button
                                                    onClick={() => { toggleFavorite(item.remoteUrl); setOpenMenuItemId(null); }}
                                                    className="w-full text-left rounded-xl px-3 py-2 text-xs font-bold text-zinc-800 hover:bg-zinc-100 transition-colors flex items-center gap-2"
                                                >
                                                    <Star className={cn("h-3.5 w-3.5", isFavorite && "fill-current text-amber-400")} />
                                                    {isFavorite ? "Unfavorite" : "Favorite"}
                                                </button>
                                                {hiddenIds.has(item.id) ? (
                                                    <button
                                                        onClick={() => { handleRestoreItem(item.id); setOpenMenuItemId(null); }}
                                                        className="w-full text-left rounded-xl px-3 py-2 text-xs font-bold text-zinc-800 hover:bg-zinc-100 transition-colors flex items-center gap-2"
                                                    >
                                                        <EyeOff className="h-3.5 w-3.5" />
                                                        Restore
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => { handleHideItem(item.id); setOpenMenuItemId(null); }}
                                                        className="w-full text-left rounded-xl px-3 py-2 text-xs font-bold text-zinc-800 hover:bg-zinc-100 transition-colors flex items-center gap-2"
                                                    >
                                                        <EyeOff className="h-3.5 w-3.5" />
                                                        Hide
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => { setSelectionMode(true); setSelected(item.id, true); setOpenMenuItemId(null); }}
                                                    className="w-full text-left rounded-xl px-3 py-2 text-xs font-bold text-zinc-800 hover:bg-zinc-100 transition-colors flex items-center gap-2"
                                                >
                                                    <CheckSquare className="h-3.5 w-3.5" />
                                                    Select
                                                </button>
                                                <button
                                                    onClick={() => { openSourceConversation(item); setOpenMenuItemId(null); }}
                                                    disabled={!item.sourceConversationId}
                                                    className="w-full text-left rounded-xl px-3 py-2 text-xs font-bold text-zinc-800 hover:bg-zinc-100 disabled:opacity-30 transition-colors flex items-center gap-2"
                                                >
                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                    {openSourceLabel}
                                                </button>
                                                <div className="h-px bg-zinc-200 my-1 mx-2" />
                                                <button
                                                    onClick={async () => { await props.deleteLocalCopy(item.remoteUrl); setOpenMenuItemId(null); }}
                                                    disabled={!item.isLocalCached}
                                                    className="w-full text-left rounded-xl px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-30 transition-colors flex items-center gap-2"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                    Delete Local
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                            </motion.div>
                        );
                    })}
                </div>
            )}

            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 pt-10">
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={currentPage === 1}
                        onClick={() => {
                            setCurrentPage(p => Math.max(1, p - 1));
                            window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="rounded-xl bg-zinc-100/80 border border-zinc-300/70 text-zinc-800 dark:bg-white/5 dark:border-white/10 dark:text-zinc-100 text-[9px] font-black uppercase tracking-widest px-6 hover:bg-zinc-200/80 dark:hover:bg-white/10 active:scale-95 disabled:opacity-20 transition-all"
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                    </Button>
                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-white/40 flex items-center gap-2">
                        Page <span className="text-zinc-900 bg-zinc-200/90 dark:text-white dark:bg-white/10 px-2 py-0.5 rounded-md">{currentPage}</span> of {totalPages}
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={currentPage === totalPages}
                        onClick={() => {
                            setCurrentPage(p => Math.min(totalPages, p + 1));
                            window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="rounded-xl bg-zinc-100/80 border border-zinc-300/70 text-zinc-800 dark:bg-white/5 dark:border-white/10 dark:text-zinc-100 text-[9px] font-black uppercase tracking-widest px-6 hover:bg-zinc-200/80 dark:hover:bg-white/10 active:scale-95 disabled:opacity-20 transition-all"
                    >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                </div>
            )}

            <AnimatePresence>
                {selectedItem && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        data-escape-layer="open"
                        className="media-preview-backdrop fixed inset-0 z-[120] flex flex-col items-center justify-center overflow-hidden backdrop-blur-xl"
                    >
                        <div className="absolute inset-0 pointer-events-none overflow-hidden">
                            <div className="media-preview-depth-layer absolute inset-0" />
                            <div className="absolute -top-[10%] -left-[10%] h-[40%] w-[40%] rounded-full bg-purple-300/25 blur-[120px] dark:bg-primary/10" />
                            <div className="absolute -bottom-[10%] -right-[10%] h-[40%] w-[40%] rounded-full bg-sky-300/20 blur-[120px] dark:bg-indigo-500/10" />
                        </div>

                        <div className="relative w-full h-full flex flex-col p-4 md:p-8 pt-20 md:pt-24 lg:pt-28">
                            <motion.div
                                initial={{ y: -20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.1 }}
                                className="flex justify-between items-center z-10 w-full max-w-7xl mx-auto mb-10 md:mb-12 px-6 md:px-10"
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3">
                                        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                                        <h3 className="max-w-md truncate text-xl font-black tracking-tight text-zinc-950 md:max-w-xl dark:text-white">
                                            {selectedItem.attachment.fileName}
                                        </h3>
                                    </div>
                                    <p className="ml-5 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 dark:text-white/40">
                                        {selectedItem.isLocalCached ? "Locally Synchronized" : "Decentralized Relay"} - {getSourceDescription(selectedItem)} - {selectedItem.timestamp.toLocaleString()}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedItem(null)}
                                    className="h-14 w-14 rounded-full bg-white/85 text-zinc-900 hover:bg-white border border-zinc-300/80 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 dark:border-white/10 flex items-center justify-center transition-all group active:scale-90"
                                >
                                    <X className="h-6 w-6 group-hover:rotate-90 transition-transform duration-500" />
                                </button>
                            </motion.div>

                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                                className={cn(
                                    "group/stage relative mx-auto flex w-full max-w-7xl flex-1 items-center justify-center overflow-hidden rounded-[40px] border shadow-2xl",
                                    selectedItem.attachment.kind === "video"
                                        ? "border-zinc-300/65 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.3),_rgba(255,255,255,0.82)_52%,_rgba(226,232,240,0.94)_100%)] p-2 shadow-[0_30px_100px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.2),_rgba(8,10,16,0.95)_52%,_rgba(0,0,0,0.98)_100%)] dark:shadow-[0_35px_110px_rgba(0,0,0,0.62)] sm:p-3 md:p-4"
                                        : "border-zinc-300/55 bg-white/52 shadow-[0_30px_100px_rgba(15,23,42,0.2)] dark:border-white/5 dark:bg-white/[0.02] dark:shadow-[0_35px_110px_rgba(0,0,0,0.62)]",
                                )}
                            >
                                <MediaStage item={selectedItem} />
                            </motion.div>

                            <motion.div
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                className="flex w-full flex-col items-center gap-3 pt-8 z-10"
                            >
                                {selectedItem.sourceConversationId ? (
                                    <div className="rounded-full border border-zinc-300/70 bg-white/78 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-zinc-700 shadow-lg backdrop-blur-2xl dark:border-white/15 dark:bg-black/35 dark:text-white/70">
                                        {getSourceDescription(selectedItem)}
                                    </div>
                                ) : null}
                                <div className="flex items-center gap-2 rounded-[32px] border border-zinc-300/70 dark:border-white/20 bg-white/90 dark:bg-black/55 p-2 backdrop-blur-3xl shadow-2xl">
                                    <Button
                                        variant="ghost"
                                        onClick={() => openSourceConversation(selectedItem)}
                                        disabled={!selectedItem.sourceConversationId}
                                        className="h-12 rounded-2xl px-6 text-[11px] font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-100 transition-all hover:bg-zinc-200/80 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30"
                                    >
                                        <ExternalLink className="h-4 w-4 mr-3" />
                                        {getOpenSourceLabel(selectedItem)}
                                    </Button>
                                    <div className="mx-1 h-6 w-px bg-zinc-300 dark:bg-white/20" />
                                    <Button
                                        variant="ghost"
                                        onClick={() => window.open(selectedItem.remoteUrl, "_blank")}
                                        className="h-12 rounded-2xl px-6 text-[11px] font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-100 transition-all hover:bg-zinc-200/80 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-white"
                                    >
                                        <ExternalLink className="h-4 w-4 mr-3" />
                                        Source URL
                                    </Button>
                                    <div className="mx-1 h-6 w-px bg-zinc-300 dark:bg-white/20" />
                                    <Button
                                        variant="ghost"
                                        onClick={() => toggleFavorite(selectedItem.remoteUrl)}
                                        className={cn(
                                            "h-12 rounded-2xl px-6 text-[11px] font-black uppercase tracking-widest transition-all",
                                            favorites.has(selectedItem.remoteUrl)
                                                ? "bg-amber-400/18 text-amber-700 hover:bg-amber-400/30 dark:bg-amber-400/12 dark:text-amber-300 dark:hover:bg-amber-400/20"
                                                : "text-zinc-800 dark:text-zinc-100 hover:bg-zinc-200/80 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-white"
                                        )}
                                    >
                                        <Star className={cn("h-4 w-4 mr-3", favorites.has(selectedItem.remoteUrl) && "fill-current")} />
                                        {favorites.has(selectedItem.remoteUrl) ? "Favorited" : "Favorite"}
                                    </Button>
                                    {selectedItem.isLocalCached && (
                                        <>
                                            <div className="mx-1 h-6 w-px bg-zinc-300 dark:bg-white/20" />
                                            <Button
                                                variant="ghost"
                                                onClick={async () => { await props.deleteLocalCopy(selectedItem.remoteUrl); setSelectedItem(null); }}
                                                className="rounded-2xl h-12 px-6 font-black text-[11px] uppercase tracking-widest text-rose-600 dark:text-rose-500 hover:bg-rose-500/10 transition-all"
                                            >
                                                <Trash2 className="h-4 w-4 mr-3" />
                                                Flush Cache
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function VaultImageTile({ item }: { item: VaultMediaItem }) {
    const [currentUrl, setCurrentUrl] = React.useState(item.attachment.url);
    const [failed, setFailed] = React.useState(false);

    React.useEffect(() => {
        setCurrentUrl(item.attachment.url);
        setFailed(false);
    }, [item.attachment.url, item.remoteUrl]);

    const handleError = (): void => {
        if (!sameMediaUrl(currentUrl, item.remoteUrl)) {
            logRuntimeEvent(
                "vault.media.image_preview_fallback_to_remote",
                "degraded",
                ["[Vault] Image preview failed for local URL; retrying with remote URL.", { currentUrl, remoteUrl: item.remoteUrl }]
            );
            setCurrentUrl(item.remoteUrl);
            return;
        }
        setFailed(true);
    };

    if (failed) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-rose-500/5 text-center p-4">
                <ImageIcon className="h-7 w-7 text-rose-300/70" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-rose-200/70 mt-2">No Preview</span>
            </div>
        );
    }

    return (
        <img
            src={currentUrl}
            alt={item.attachment.fileName}
            onError={handleError}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            loading="lazy"
        />
    );
}

function VaultVideoTile({ item }: { item: VaultMediaItem }) {
    const [currentUrl, setCurrentUrl] = React.useState(item.attachment.url);
    const [failed, setFailed] = React.useState(false);

    React.useEffect(() => {
        setCurrentUrl(item.attachment.url);
        setFailed(false);
    }, [item.attachment.url, item.remoteUrl]);

    const handleError = (): void => {
        if (!sameMediaUrl(currentUrl, item.remoteUrl)) {
            logRuntimeEvent(
                "vault.media.video_preview_fallback_to_remote",
                "degraded",
                ["[Vault] Video preview failed for local URL; retrying with remote URL.", { currentUrl, remoteUrl: item.remoteUrl }]
            );
            setCurrentUrl(item.remoteUrl);
            return;
        }
        setFailed(true);
    };

    if (failed) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-indigo-500/5 text-center p-4">
                <VideoIcon className="h-7 w-7 text-indigo-200/70" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-100/70 mt-2">No Preview</span>
            </div>
        );
    }

    return (
        <div className="w-full h-full relative">
            <video
                src={buildVideoPreviewUrl(currentUrl)}
                className="w-full h-full object-cover"
                preload="metadata"
                playsInline
                muted
                onError={handleError}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-indigo-500/5 transition-colors group-hover:bg-indigo-500/10">
                <div className="h-12 w-12 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
                    <VideoIcon className="h-6 w-6 text-white" />
                </div>
            </div>
        </div>
    );
}

function MediaUnavailableStage(props: Readonly<{ icon: React.ReactNode; title: string; note: string }>) {
    return (
        <div className="flex w-full max-w-xl flex-col items-center rounded-[40px] border border-zinc-300/55 bg-white/72 p-10 text-center shadow-2xl backdrop-blur-3xl dark:border-white/10 dark:bg-white/5">
            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-[28px] border border-zinc-300/60 bg-white/70 dark:border-white/10 dark:bg-white/5">
                {props.icon}
            </div>
            <div className="text-lg font-black text-zinc-900 dark:text-white">{props.title}</div>
            <div className="mt-2 text-xs text-zinc-600 dark:text-white/60">{props.note}</div>
        </div>
    );
}

function MediaStage({ item }: { item: VaultMediaItem }) {
    if (item.attachment.kind === "image") {
        return <ImageStage primaryUrl={item.attachment.url} fallbackUrl={item.remoteUrl} name={item.attachment.fileName} />;
    }

    if (item.attachment.kind === "video") {
        return <VideoStage primaryUrl={item.attachment.url} fallbackUrl={item.remoteUrl} fileName={item.attachment.fileName} />;
    }

    if (item.attachment.kind === "audio") {
        return <AudioStage primaryUrl={item.attachment.url} fallbackUrl={item.remoteUrl} fileName={item.attachment.fileName} />;
    }

    if (item.attachment.kind === "file" && isPdfAttachment(item.attachment)) {
        return <PdfStage primaryUrl={item.attachment.url} fallbackUrl={item.remoteUrl} fileName={item.attachment.fileName} />;
    }

    return (
        <div className="flex w-full max-w-md flex-col items-center space-y-10 rounded-[48px] border border-zinc-300/55 bg-white/72 p-12 text-center shadow-2xl backdrop-blur-3xl dark:border-white/10 dark:bg-white/5">
            <div className="h-32 w-32 rounded-[40px] bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center border border-amber-500/20 shadow-inner">
                <FileText className="h-16 w-16 text-amber-500" />
            </div>
            <div className="space-y-3">
                <h4 className="text-2xl font-black text-zinc-900 dark:text-white">{item.attachment.fileName}</h4>
                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500 dark:text-white/30">{item.attachment.contentType || "Binary Asset"}</p>
            </div>
            <Button
                onClick={() => window.open(item.attachment.url, "_blank")}
                className="w-full bg-amber-500 hover:bg-amber-600 text-black font-black rounded-3xl h-16 text-base tracking-tight shadow-[0_20px_40px_-10px_rgba(245,158,11,0.3)] transition-all hover:-translate-y-1"
            >
                <Download className="h-5 w-5 mr-3" />
                Download Asset
            </Button>
        </div>
    );
}

function ImageStage({ primaryUrl, fallbackUrl, name }: { primaryUrl: string; fallbackUrl: string; name: string }) {
    const [scale, setScale] = React.useState(1);
    const [currentUrl, setCurrentUrl] = React.useState(primaryUrl);
    const [failed, setFailed] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const dragRef = React.useRef<HTMLDivElement>(null);
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const springX = useSpring(x, { damping: 40, stiffness: 300 });
    const springY = useSpring(y, { damping: 40, stiffness: 300 });

    const [constraints, setConstraints] = React.useState({ left: 0, right: 0, top: 0, bottom: 0 });

    React.useEffect(() => {
        setCurrentUrl(primaryUrl);
        setFailed(false);
        setScale(1);
        x.set(0);
        y.set(0);
    }, [primaryUrl, fallbackUrl, x, y]);

    React.useEffect(() => {
        if (!containerRef.current || !dragRef.current) return;

        const updateConstraints = () => {
            if (!containerRef.current || !dragRef.current) return;
            const cW = containerRef.current.offsetWidth;
            const cH = containerRef.current.offsetHeight;
            const dW = dragRef.current.offsetWidth;
            const dH = dragRef.current.offsetHeight;

            const xBound = Math.max(0, (dW * scale - cW) / 2);
            const yBound = Math.max(0, (dH * scale - cH) / 2);

            setConstraints({
                left: -xBound,
                right: xBound,
                top: -yBound,
                bottom: yBound,
            });
        };

        // Update aggressively initially to catch late-loading images
        updateConstraints();
        const timeout = setTimeout(updateConstraints, 100);
        return () => clearTimeout(timeout);
    }, [scale, currentUrl]);

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey || e.deltaY) {
            e.preventDefault();
            const delta = -e.deltaY;
            const factor = 1.1;
            const newScale = delta > 0 ? scale * factor : scale / factor;
            const clampedScale = Math.min(Math.max(newScale, 1), 8);
            setScale(clampedScale);

            if (clampedScale === 1) {
                x.set(0);
                y.set(0);
            }
        }
    };

    const handleDragEnd = () => {
        if (scale === 1) {
            x.set(0);
            y.set(0);
        }
    };

    const handleImageError = (): void => {
        if (!sameMediaUrl(currentUrl, fallbackUrl)) {
            logRuntimeEvent(
                "vault.media.image_stage_fallback_to_remote",
                "degraded",
                ["[Vault] Image viewer failed for local URL; retrying with remote URL.", { currentUrl, fallbackUrl }]
            );
            setCurrentUrl(fallbackUrl);
            return;
        }

        setFailed(true);
    };

    if (failed) {
        return (
            <MediaUnavailableStage
                icon={<ImageIcon className="h-10 w-10 text-rose-300/70" />}
                title="Image preview unavailable"
                note="This media could not be rendered from either local or remote source."
            />
        );
    }

    return (
        <div
            ref={containerRef}
            onWheel={handleWheel}
            className="w-full h-full flex items-center justify-center relative touch-none overflow-hidden"
        >
            <motion.div
                ref={dragRef}
                drag={scale > 1}
                dragConstraints={constraints}
                dragElastic={0.1}
                dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
                style={{ x: springX, y: springY }}
                animate={{ scale }}
                transition={{ type: "spring", damping: 30, stiffness: 250 }}
                onDragEnd={handleDragEnd}
                className="relative cursor-grab active:cursor-grabbing flex items-center justify-center"
            >
                <img
                    src={currentUrl}
                    alt={name}
                    onError={handleImageError}
                    draggable={false}
                    className="max-h-[85vh] max-w-full object-contain pointer-events-none select-none rounded-sm"
                />
            </motion.div>

            <AnimatePresence>
                {scale === 1 && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute inset-0 pointer-events-none hidden group-hover/stage:flex items-center justify-center"
                    >
                        <div className="bg-black/60 backdrop-blur-xl px-5 py-2.5 rounded-full border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-2xl">
                            Scroll to Zoom • Drag to Pan
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="absolute bottom-8 right-8 flex items-center gap-2 bg-white/90 dark:bg-black/70 backdrop-blur-2xl p-2 rounded-[24px] border border-zinc-300/80 dark:border-white/15 shadow-2xl z-20">
                <button
                    onClick={() => setScale(s => Math.max(s / 1.5, 1))}
                    className="h-10 w-10 rounded-xl hover:bg-zinc-200/80 dark:hover:bg-white/10 text-zinc-800 dark:text-white flex items-center justify-center transition-all active:scale-90"
                >
                    <ZoomOut className="h-4 w-4" />
                </button>
                <div className="px-2 text-[11px] font-black text-zinc-800 dark:text-white w-12 text-center select-none tabular-nums">
                    {Math.round(scale * 100)}%
                </div>
                <button
                    onClick={() => setScale(s => Math.min(s * 1.5, 8))}
                    className="h-10 w-10 rounded-xl hover:bg-zinc-200/80 dark:hover:bg-white/10 text-zinc-800 dark:text-white flex items-center justify-center transition-all active:scale-90"
                >
                    <ZoomIn className="h-4 w-4" />
                </button>
                <div className="h-4 w-px bg-zinc-300/80 dark:bg-white/15 mx-1" />
                <button
                    onClick={() => { setScale(1); x.set(0); y.set(0); }}
                    className="h-10 px-4 rounded-xl hover:bg-zinc-200/80 dark:hover:bg-white/10 text-zinc-800 dark:text-white flex items-center justify-center gap-2 transition-all text-[10px] font-black uppercase tracking-widest active:scale-90"
                >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                </button>
            </div>
        </div>
    );
}

function VideoStage({
    primaryUrl,
    fallbackUrl,
    fileName
}: {
    primaryUrl: string;
    fallbackUrl: string;
    fileName: string;
}) {
    const [currentUrl, setCurrentUrl] = React.useState(primaryUrl);
    const [failed, setFailed] = React.useState(false);

    React.useEffect(() => {
        setCurrentUrl(primaryUrl);
        setFailed(false);
    }, [primaryUrl, fallbackUrl]);

    const handleVideoError = (): void => {
        if (!sameMediaUrl(currentUrl, fallbackUrl)) {
            logRuntimeEvent(
                "vault.media.video_stage_fallback_to_remote",
                "degraded",
                ["[Vault] Video playback failed for local URL; retrying with remote URL.", { currentUrl, fallbackUrl }]
            );
            setCurrentUrl(fallbackUrl);
            return;
        }
        setFailed(true);
    };

    if (failed) {
        return (
            <MediaUnavailableStage
                icon={<VideoIcon className="h-10 w-10 text-indigo-200/70" />}
                title="Video playback unavailable"
                note={`Unable to render "${fileName}" from local or remote source.`}
            />
        );
    }

    return (
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[28px] border border-white/10 bg-black">
            <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/45 via-transparent to-black/20" />
            <video
                src={currentUrl}
                controls
                autoPlay
                playsInline
                preload="metadata"
                onError={handleVideoError}
                className="z-0 h-full w-full object-contain shadow-[0_0_100px_rgba(0,0,0,0.55)]"
            />
        </div>
    );
}

function AudioStage({
    primaryUrl,
    fallbackUrl,
    fileName
}: {
    primaryUrl: string;
    fallbackUrl: string;
    fileName: string;
}) {
    const [currentUrl, setCurrentUrl] = React.useState(primaryUrl);
    const [failed, setFailed] = React.useState(false);

    React.useEffect(() => {
        setCurrentUrl(primaryUrl);
        setFailed(false);
    }, [primaryUrl, fallbackUrl]);

    const handleAudioError = (): void => {
        if (!sameMediaUrl(currentUrl, fallbackUrl)) {
            logRuntimeEvent(
                "vault.media.audio_stage_fallback_to_remote",
                "degraded",
                ["[Vault] Audio playback failed for local URL; retrying with remote URL.", { currentUrl, fallbackUrl }]
            );
            setCurrentUrl(fallbackUrl);
            return;
        }
        setFailed(true);
    };

    if (failed) {
        return (
            <MediaUnavailableStage
                icon={<Music2 className="h-10 w-10 text-emerald-200/70" />}
                title="Audio playback unavailable"
                note={`Unable to play "${fileName}" from local or remote source.`}
            />
        );
    }

    return (
        <div className="flex w-full max-w-xl flex-col items-center rounded-[48px] border border-zinc-300/55 bg-white/72 p-12 shadow-2xl backdrop-blur-3xl dark:border-white/10 dark:bg-white/5">
            <div className="h-32 w-32 rounded-[40px] bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center border border-emerald-500/20 mb-8 shadow-inner">
                <Music2 className="h-16 w-16 text-emerald-400" />
            </div>
            <div className="text-center mb-10 space-y-2">
                <div className="text-xl font-black text-zinc-900 dark:text-white">{fileName}</div>
                <div className="text-[10px] font-black uppercase italic tracking-[0.3em] text-zinc-500 dark:text-white/30">HIFI-AUDIO.DAT</div>
            </div>
            <audio src={currentUrl} controls className="w-full" onError={handleAudioError} />
        </div>
    );
}

function PdfStage({
    primaryUrl,
    fallbackUrl,
    fileName
}: {
    primaryUrl: string;
    fallbackUrl: string;
    fileName: string;
}) {
    const [currentUrl, setCurrentUrl] = React.useState(primaryUrl);
    const [failed, setFailed] = React.useState(false);

    React.useEffect(() => {
        setCurrentUrl(primaryUrl);
        setFailed(false);
    }, [primaryUrl, fallbackUrl]);

    const handlePdfError = (): void => {
        if (!sameMediaUrl(currentUrl, fallbackUrl)) {
            logRuntimeEvent(
                "vault.media.pdf_stage_fallback_to_remote",
                "degraded",
                ["[Vault] PDF preview failed for local URL; retrying with remote URL.", { currentUrl, fallbackUrl }]
            );
            setCurrentUrl(fallbackUrl);
            return;
        }
        setFailed(true);
    };

    if (failed) {
        return (
            <MediaUnavailableStage
                icon={<FileText className="h-10 w-10 text-amber-200/70" />}
                title="PDF preview unavailable"
                note={`Unable to render "${fileName}" in-app. Use Source URL to open externally.`}
            />
        );
    }

    return (
        <div className="h-full w-full p-4 md:p-6">
            <div className="h-full w-full rounded-2xl overflow-hidden border border-white/10 bg-black/20">
                <iframe
                    src={currentUrl}
                    title={`PDF preview: ${fileName}`}
                    className="h-full w-full"
                    onError={handlePdfError}
                />
            </div>
        </div>
    );
}
