"use client";

import React from "react";
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
    EyeOff,
    ZoomIn,
    ZoomOut,
    RotateCcw,
    Maximize2
} from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useTranslation } from "react-i18next";
import { cn } from "@/app/lib/utils";
import type { VaultMediaItem } from "../hooks/use-vault-media";

type VaultMediaGridProps = Readonly<{
    mediaItems: ReadonlyArray<VaultMediaItem>;
    isLoading: boolean;
    stats: Readonly<{ imageCount: number; videoCount: number; audioCount: number; fileCount: number; total: number }>;
    refresh: () => void;
    deleteLocalCopy: (remoteUrl: string) => Promise<void>;
}>;

type VisibilityFilter = "all" | "local" | "remote" | "favorites";

const FILTER_STORAGE_KEY = "obscur.vault.filter.preference";
const FAVORITES_STORAGE_KEY = "obscur.vault.favorites";
const HIDDEN_STORAGE_KEY = "obscur.vault.hidden";

const readHidden = (): ReadonlySet<string> => {
    if (typeof window === "undefined") return new Set<string>();
    try {
        const raw = localStorage.getItem(HIDDEN_STORAGE_KEY);
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
    localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify(Array.from(ids)));
};

const readFilterPreference = (): VisibilityFilter => {
    if (typeof window === "undefined") return "all";
    const raw = localStorage.getItem(FILTER_STORAGE_KEY);
    if (raw === "local" || raw === "remote" || raw === "favorites") return raw;
    return "all";
};

const readFavorites = (): ReadonlySet<string> => {
    if (typeof window === "undefined") return new Set<string>();
    try {
        const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
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
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(favorites)));
};

export function VaultMediaGrid(props: VaultMediaGridProps) {
    const { t } = useTranslation();
    const [selectedItem, setSelectedItem] = React.useState<VaultMediaItem | null>(null);
    const [visibilityFilter, setVisibilityFilter] = React.useState<VisibilityFilter>(() => readFilterPreference());
    const [typeFilter, setTypeFilter] = React.useState<"all" | "image" | "video" | "audio" | "file">("all");
    const [favorites, setFavorites] = React.useState<ReadonlySet<string>>(() => readFavorites());
    const [hiddenIds, setHiddenIds] = React.useState<ReadonlySet<string>>(() => readHidden());
    const [selectionMode, setSelectionMode] = React.useState(false);
    const [selectedIds, setSelectedIds] = React.useState<ReadonlySet<string>>(new Set());
    const [openMenuItemId, setOpenMenuItemId] = React.useState<string | null>(null);
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
    }, [visibilityFilter, typeFilter]);

    React.useEffect(() => {
        if (typeof window === "undefined") return;
        localStorage.setItem(FILTER_STORAGE_KEY, visibilityFilter);
    }, [visibilityFilter]);

    React.useEffect(() => {
        const closeMenu = () => setOpenMenuItemId(null);
        window.addEventListener("click", closeMenu);
        return () => window.removeEventListener("click", closeMenu);
    }, []);

    const localCount = props.mediaItems.filter((item) => item.isLocalCached).length;
    const remoteCount = props.mediaItems.length - localCount;
    const favoritesCount = props.mediaItems.filter((item) => favorites.has(item.remoteUrl)).length;

    const filteredItems = props.mediaItems.filter((item) => {
        if (hiddenIds.has(item.id)) return false;
        if (visibilityFilter === "local" && !item.isLocalCached) return false;
        if (visibilityFilter === "remote" && item.isLocalCached) return false;
        if (visibilityFilter === "favorites" && !favorites.has(item.remoteUrl)) return false;
        if (typeFilter !== "all" && item.attachment.kind !== typeFilter) return false;
        return true;
    });

    const visibleItems = [...filteredItems].sort((a, b) => {
        const aFav = favorites.has(a.remoteUrl) ? 1 : 0;
        const bFav = favorites.has(b.remoteUrl) ? 1 : 0;
        return bFav - aFav;
    });

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
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                <div className="h-24 w-24 rounded-[32px] bg-muted flex items-center justify-center">
                    <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
                </div>
                <div className="space-y-1">
                    <h3 className="text-xl font-black">{t("vault.empty", "Vault is Empty")}</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">
                        {t("vault.emptyDesc", "Shared media from your chats will appear here automatically.")}
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={props.refresh} className="rounded-xl font-bold">
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
                        className={cn("h-8 gap-2 rounded-full border px-4 transition-all duration-300", typeFilter === "image" ? "bg-primary/20 border-primary/40 text-primary" : "border-border/40 hover:bg-white/5")}
                    >
                        <ImageIcon className={cn("h-3.5 w-3.5", typeFilter === "image" ? "text-primary" : "text-muted-foreground")} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{props.stats.imageCount} {t("common.images", "Images")}</span>
                    </Button>

                    <Button
                        type="button"
                        variant={typeFilter === "video" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setTypeFilter(prev => prev === "video" ? "all" : "video")}
                        className={cn("h-8 gap-2 rounded-full border px-4 transition-all duration-300", typeFilter === "video" ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-400" : "border-border/40 hover:bg-white/5")}
                    >
                        <VideoIcon className={cn("h-3.5 w-3.5", typeFilter === "video" ? "text-indigo-400" : "text-muted-foreground")} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{props.stats.videoCount} {t("common.videos", "Videos")}</span>
                    </Button>

                    <Button
                        type="button"
                        variant={typeFilter === "audio" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setTypeFilter(prev => prev === "audio" ? "all" : "audio")}
                        className={cn("h-8 gap-2 rounded-full border px-4 transition-all duration-300", typeFilter === "audio" ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "border-border/40 hover:bg-white/5")}
                    >
                        <Music2 className={cn("h-3.5 w-3.5", typeFilter === "audio" ? "text-emerald-400" : "text-muted-foreground")} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{props.stats.audioCount} {t("common.audio", "Audio")}</span>
                    </Button>

                    <Button
                        type="button"
                        variant={typeFilter === "file" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setTypeFilter(prev => prev === "file" ? "all" : "file")}
                        className={cn("h-8 gap-2 rounded-full border px-4 transition-all duration-300", typeFilter === "file" ? "bg-amber-500/20 border-amber-500/40 text-amber-400" : "border-border/40 hover:bg-white/5")}
                    >
                        <FileText className={cn("h-3.5 w-3.5", typeFilter === "file" ? "text-amber-400" : "text-muted-foreground")} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{props.stats.fileCount} Documents</span>
                    </Button>

                    <div className="flex items-center gap-1.5 bg-zinc-500/10 px-2 py-1 rounded-full border border-zinc-500/20 ml-2">
                        <Button type="button" variant={visibilityFilter === "all" ? "secondary" : "ghost"} size="sm" onClick={() => setVisibilityFilter("all")} className="h-6 px-2 text-[10px]">All ({props.mediaItems.length})</Button>
                        <Button type="button" variant={visibilityFilter === "local" ? "secondary" : "ghost"} size="sm" onClick={() => setVisibilityFilter("local")} className="h-6 px-2 text-[10px]">Local ({localCount})</Button>
                        <Button type="button" variant={visibilityFilter === "remote" ? "secondary" : "ghost"} size="sm" onClick={() => setVisibilityFilter("remote")} className="h-6 px-2 text-[10px]">Remote ({remoteCount})</Button>
                        <Button type="button" variant={visibilityFilter === "favorites" ? "secondary" : "ghost"} size="sm" onClick={() => setVisibilityFilter("favorites")} className="h-6 px-2 text-[10px]">Favorites ({favoritesCount})</Button>
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

            {selectionMode && selectedIds.size > 0 && (
                <div className="rounded-2xl border border-border bg-muted/20 p-3 flex items-center gap-2 flex-wrap">
                    <div className="text-sm font-bold mr-2 ml-2">{selectedIds.size} selected</div>
                    <Button type="button" variant="secondary" size="sm" onClick={handleBulkFavorite} className="rounded-xl">
                        <Star className="h-4 w-4 mr-1.5" />
                        Favorite
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={handleBulkHide} className="rounded-xl">
                        <EyeOff className="h-4 w-4 mr-1.5" />
                        Hide
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => void handleBulkDeleteLocal()} disabled={selectedLocalCount === 0} className="rounded-xl">
                        <Trash2 className="h-4 w-4 mr-1.5" />
                        Delete Local ({selectedLocalCount})
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={clearSelection} className="rounded-xl ml-auto">Clear</Button>
                </div>
            )}

            {paginatedItems.length === 0 ? (
                <div className="rounded-2xl border border-border/50 bg-muted/20 p-12 text-center text-sm text-muted-foreground font-medium">
                    No items found in this section.
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
                    {paginatedItems.map((item, index) => {
                        const isFavorite = favorites.has(item.remoteUrl);
                        const isSelected = selectedIds.has(item.id);
                        const showMenu = openMenuItemId === item.id;

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
                                    "group relative aspect-square rounded-[24px] overflow-hidden bg-muted border border-border/50 hover:shadow-2xl hover:shadow-primary/5 transition-all text-left outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                    isSelected && "ring-2 ring-primary border-primary/50"
                                )}
                            >
                                <div className="absolute inset-0 z-0">
                                    {item.attachment.kind === "image" ? (
                                        <img
                                            src={item.attachment.url}
                                            alt={item.attachment.fileName}
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                        />
                                    ) : item.attachment.kind === "video" ? (
                                        <div className="w-full h-full relative">
                                            <video
                                                src={`${item.attachment.url}#t=0.1`}
                                                className="w-full h-full object-cover"
                                                preload="metadata"
                                                playsInline
                                                muted
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center bg-indigo-500/5 transition-colors group-hover:bg-indigo-500/10">
                                                <div className="h-12 w-12 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
                                                    <VideoIcon className="h-6 w-6 text-white" />
                                                </div>
                                            </div>
                                        </div>
                                    ) : item.attachment.kind === "audio" ? (
                                        <div className="w-full h-full flex flex-col items-center justify-center bg-emerald-500/5 transition-colors group-hover:bg-emerald-500/10">
                                            <Music2 className="h-8 w-8 text-emerald-500/50" />
                                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-500/50 mt-2">AUDIO</span>
                                        </div>
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center bg-amber-500/5 transition-colors group-hover:bg-amber-500/10 text-center p-4">
                                            <FileIcon className="h-8 w-8 text-amber-500/50" />
                                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-500/50 mt-2">DOCUMENT</span>
                                        </div>
                                    )}
                                </div>

                                <div className="absolute top-3 left-3 rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-widest bg-black/60 text-white backdrop-blur-md border border-white/5 z-10">
                                    {item.isLocalCached ? "Local" : "Remote"}
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
                                            className="h-9 w-9 rounded-xl bg-black/40 text-white flex items-center justify-center backdrop-blur-md border border-white/5 hover:bg-black/60 transition-colors"
                                        >
                                            <MoreVertical className="h-4 w-4" />
                                        </button>
                                        {showMenu && (
                                            <div className="absolute right-0 mt-2 min-w-[170px] rounded-[18px] border border-white/10 bg-zinc-900/95 backdrop-blur-2xl p-1.5 shadow-2xl z-30 animate-in fade-in zoom-in duration-200">
                                                <button
                                                    onClick={() => { toggleFavorite(item.remoteUrl); setOpenMenuItemId(null); }}
                                                    className="w-full text-left rounded-xl px-3 py-2 text-xs font-bold hover:bg-white/5 transition-colors flex items-center gap-2"
                                                >
                                                    <Star className={cn("h-3.5 w-3.5", isFavorite && "fill-current text-amber-400")} />
                                                    {isFavorite ? "Unfavorite" : "Favorite"}
                                                </button>
                                                <button
                                                    onClick={() => { handleHideItem(item.id); setOpenMenuItemId(null); }}
                                                    className="w-full text-left rounded-xl px-3 py-2 text-xs font-bold hover:bg-white/5 transition-colors flex items-center gap-2"
                                                >
                                                    <EyeOff className="h-3.5 w-3.5" />
                                                    Hide
                                                </button>
                                                <button
                                                    onClick={() => { setSelectionMode(true); setSelected(item.id, true); setOpenMenuItemId(null); }}
                                                    className="w-full text-left rounded-xl px-3 py-2 text-xs font-bold hover:bg-white/5 transition-colors flex items-center gap-2"
                                                >
                                                    <CheckSquare className="h-3.5 w-3.5" />
                                                    Select
                                                </button>
                                                <div className="h-px bg-white/5 my-1 mx-2" />
                                                <button
                                                    onClick={async () => { await props.deleteLocalCopy(item.remoteUrl); setOpenMenuItemId(null); }}
                                                    disabled={!item.isLocalCached}
                                                    className="w-full text-left rounded-xl px-3 py-2 text-xs font-bold text-rose-500 hover:bg-rose-500/10 disabled:opacity-30 transition-colors flex items-center gap-2"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                    Delete Local
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-5">
                                    <div className="text-[10px] text-white font-black truncate drop-shadow-lg">{item.attachment.fileName}</div>
                                    <div className="text-[9px] text-white/50 font-medium">{item.timestamp.toLocaleDateString()}</div>
                                </div>
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
                        className="rounded-xl bg-white/5 border border-white/5 text-[9px] font-black uppercase tracking-widest px-6 hover:bg-white/10 active:scale-95 disabled:opacity-20 transition-all"
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                    </Button>
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/30 flex items-center gap-2">
                        Page <span className="text-white bg-white/10 px-2 py-0.5 rounded-md">{currentPage}</span> of {totalPages}
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={currentPage === totalPages}
                        onClick={() => {
                            setCurrentPage(p => Math.min(totalPages, p + 1));
                            window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="rounded-xl bg-white/5 border border-white/5 text-[9px] font-black uppercase tracking-widest px-6 hover:bg-white/10 active:scale-95 disabled:opacity-20 transition-all"
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
                        className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center overflow-hidden"
                    >
                        <div className="absolute inset-0 pointer-events-none overflow-hidden">
                            <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
                            <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px]" />
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
                                        <h3 className="text-xl font-black text-white tracking-tight truncate max-w-md md:max-w-xl">
                                            {selectedItem.attachment.fileName}
                                        </h3>
                                    </div>
                                    <p className="text-[10px] text-white/40 font-black tracking-[0.3em] uppercase ml-5">
                                        {selectedItem.isLocalCached ? "Locally Synchronized" : "Decentralized Relay"} • {selectedItem.timestamp.toLocaleString()}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedItem(null)}
                                    className="h-14 w-14 rounded-full bg-white/5 hover:bg-white/10 text-white flex items-center justify-center border border-white/5 transition-all group active:scale-90"
                                >
                                    <X className="h-6 w-6 group-hover:rotate-90 transition-transform duration-500" />
                                </button>
                            </motion.div>

                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                                className="flex-1 w-full max-w-7xl mx-auto flex items-center justify-center relative rounded-[40px] overflow-hidden bg-white/[0.02] border border-white/5 shadow-2xl group/stage"
                            >
                                <MediaStage item={selectedItem} />
                            </motion.div>

                            <motion.div
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                className="flex justify-center pt-8 w-full z-10"
                            >
                                <div className="flex items-center gap-2 bg-white/5 backdrop-blur-3xl p-2 rounded-[32px] border border-white/10 shadow-2xl">
                                    <Button
                                        variant="ghost"
                                        onClick={() => window.open(selectedItem.remoteUrl, "_blank")}
                                        className="rounded-2xl h-12 px-6 font-black text-[11px] uppercase tracking-widest text-white/70 hover:text-white hover:bg-white/5 transition-all"
                                    >
                                        <ExternalLink className="h-4 w-4 mr-3" />
                                        Source URL
                                    </Button>
                                    <div className="h-6 w-px bg-white/10 mx-1" />
                                    <Button
                                        variant="ghost"
                                        onClick={() => toggleFavorite(selectedItem.remoteUrl)}
                                        className={cn(
                                            "rounded-2xl h-12 px-6 font-black text-[11px] uppercase tracking-widest transition-all",
                                            favorites.has(selectedItem.remoteUrl) ? "text-amber-400 bg-amber-400/10 hover:bg-amber-400/20" : "text-white/70 hover:text-white hover:bg-white/5"
                                        )}
                                    >
                                        <Star className={cn("h-4 w-4 mr-3", favorites.has(selectedItem.remoteUrl) && "fill-current")} />
                                        {favorites.has(selectedItem.remoteUrl) ? "Favorited" : "Favorite"}
                                    </Button>
                                    {selectedItem.isLocalCached && (
                                        <>
                                            <div className="h-6 w-px bg-white/10 mx-1" />
                                            <Button
                                                variant="ghost"
                                                onClick={async () => { await props.deleteLocalCopy(selectedItem.remoteUrl); setSelectedItem(null); }}
                                                className="rounded-2xl h-12 px-6 font-black text-[11px] uppercase tracking-widest text-rose-500 hover:bg-rose-500/10 transition-all"
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

function MediaStage({ item }: { item: VaultMediaItem }) {
    if (item.attachment.kind === "image") {
        return <ImageStage url={item.attachment.url} name={item.attachment.fileName} />;
    }

    if (item.attachment.kind === "video") {
        return (
            <video
                src={item.attachment.url}
                controls
                autoPlay
                className="max-h-full max-w-full rounded-2xl shadow-[0_0_100px_rgba(0,0,0,0.5)] z-0"
            />
        );
    }

    if (item.attachment.kind === "audio") {
        return (
            <div className="w-full max-w-xl bg-white/5 backdrop-blur-3xl rounded-[48px] p-12 border border-white/10 shadow-2xl flex flex-col items-center">
                <div className="h-32 w-32 rounded-[40px] bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center border border-emerald-500/20 mb-8 shadow-inner">
                    <Music2 className="h-16 w-16 text-emerald-400" />
                </div>
                <div className="text-center mb-10 space-y-2">
                    <div className="text-xl font-black text-white">{item.attachment.fileName}</div>
                    <div className="text-[10px] text-white/30 font-black tracking-widest uppercase italic tracking-[0.3em]">HIFI-AUDIO.DAT</div>
                </div>
                <audio src={item.attachment.url} controls className="w-full" />
            </div>
        );
    }

    return (
        <div className="w-full max-w-md bg-white/5 backdrop-blur-3xl rounded-[48px] p-12 border border-white/10 flex flex-col items-center text-center space-y-10 shadow-2xl">
            <div className="h-32 w-32 rounded-[40px] bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center border border-amber-500/20 shadow-inner">
                <FileText className="h-16 w-16 text-amber-500" />
            </div>
            <div className="space-y-3">
                <h4 className="text-2xl font-black text-white">{item.attachment.fileName}</h4>
                <p className="text-[11px] text-white/30 uppercase tracking-[0.3em] font-black">{item.attachment.contentType || "Binary Asset"}</p>
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

function ImageStage({ url, name }: { url: string; name: string }) {
    const [scale, setScale] = React.useState(1);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const dragRef = React.useRef<HTMLDivElement>(null);
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const springX = useSpring(x, { damping: 40, stiffness: 300 });
    const springY = useSpring(y, { damping: 40, stiffness: 300 });

    const [constraints, setConstraints] = React.useState({ left: 0, right: 0, top: 0, bottom: 0 });

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
    }, [scale, url]);

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
                    src={url}
                    alt={name}
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

            <div className="absolute bottom-8 right-8 flex items-center gap-2 bg-black/60 backdrop-blur-2xl p-2 rounded-[24px] border border-white/10 shadow-2xl z-20">
                <button
                    onClick={() => setScale(s => Math.max(s / 1.5, 1))}
                    className="h-10 w-10 rounded-xl hover:bg-white/10 text-white flex items-center justify-center transition-all active:scale-90"
                >
                    <ZoomOut className="h-4 w-4" />
                </button>
                <div className="px-2 text-[11px] font-black text-white w-12 text-center select-none tabular-nums">
                    {Math.round(scale * 100)}%
                </div>
                <button
                    onClick={() => setScale(s => Math.min(s * 1.5, 8))}
                    className="h-10 w-10 rounded-xl hover:bg-white/10 text-white flex items-center justify-center transition-all active:scale-90"
                >
                    <ZoomIn className="h-4 w-4" />
                </button>
                <div className="h-4 w-px bg-white/10 mx-1" />
                <button
                    onClick={() => { setScale(1); x.set(0); y.set(0); }}
                    className="h-10 px-4 rounded-xl hover:bg-white/10 text-white flex items-center justify-center gap-2 transition-all text-[10px] font-black uppercase tracking-widest active:scale-90"
                >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                </button>
            </div>
        </div>
    );
}
