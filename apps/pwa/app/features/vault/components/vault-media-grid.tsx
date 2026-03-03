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
    Square
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { cn } from "@/app/lib/utils";
import type { VaultMediaItem } from "../hooks/use-vault-media";

type VaultMediaGridProps = Readonly<{
    mediaItems: ReadonlyArray<VaultMediaItem>;
    isLoading: boolean;
    stats: Readonly<{ imageCount: number; videoCount: number; total: number }>;
    refresh: () => void;
    deleteLocalCopy: (remoteUrl: string) => Promise<void>;
}>;

type VisibilityFilter = "all" | "local" | "remote" | "favorites";

const FILTER_STORAGE_KEY = "obscur.vault.filter.preference";
const FAVORITES_STORAGE_KEY = "obscur.vault.favorites";

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
    const [favorites, setFavorites] = React.useState<ReadonlySet<string>>(() => readFavorites());
    const [selectionMode, setSelectionMode] = React.useState(false);
    const [selectedIds, setSelectedIds] = React.useState<ReadonlySet<string>>(new Set());
    const [openMenuItemId, setOpenMenuItemId] = React.useState<string | null>(null);
    const [isDragSelecting, setIsDragSelecting] = React.useState(false);
    const dragSelectValueRef = React.useRef<boolean>(true);
    const longPressTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const longPressStateRef = React.useRef<{ itemId: string | null; triggered: boolean }>({ itemId: null, triggered: false });

    React.useEffect(() => {
        if (typeof window === "undefined") return;
        localStorage.setItem(FILTER_STORAGE_KEY, visibilityFilter);
    }, [visibilityFilter]);

    React.useEffect(() => {
        const stopDragSelect = () => setIsDragSelecting(false);
        window.addEventListener("mouseup", stopDragSelect);
        return () => window.removeEventListener("mouseup", stopDragSelect);
    }, []);

    React.useEffect(() => {
        const closeMenu = () => setOpenMenuItemId(null);
        window.addEventListener("click", closeMenu);
        return () => window.removeEventListener("click", closeMenu);
    }, []);

    const localCount = props.mediaItems.filter((item) => item.isLocalCached).length;
    const remoteCount = props.mediaItems.length - localCount;
    const favoritesCount = props.mediaItems.filter((item) => favorites.has(item.remoteUrl)).length;

    const filteredItems = props.mediaItems.filter((item) => {
        if (visibilityFilter === "local") return item.isLocalCached;
        if (visibilityFilter === "remote") return !item.isLocalCached;
        if (visibilityFilter === "favorites") return favorites.has(item.remoteUrl);
        return true;
    });

    const visibleItems = [...filteredItems].sort((a, b) => {
        const aFav = favorites.has(a.remoteUrl) ? 1 : 0;
        const bFav = favorites.has(b.remoteUrl) ? 1 : 0;
        return bFav - aFav;
    });

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
        // Reserve a larger hit area than the icon button to avoid accidental preview opens.
        return rightInset >= 0 && rightInset <= 56 && topInset >= 0 && topInset <= 56;
    };

    if (props.isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <LoaderIcon className="h-8 w-8 animate-spin text-primary/40" />
                <p className="text-sm text-muted-foreground animate-pulse">{t("common.loading", "Scanning vault...")}</p>
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
                    <div className="flex items-center gap-1.5 bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                        <ImageIcon className="h-3 w-3 text-primary" />
                        <span className="text-[10px] font-black uppercase text-primary">{props.stats.imageCount} {t("common.images", "Images")}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                        <VideoIcon className="h-3 w-3 text-indigo-400" />
                        <span className="text-[10px] font-black uppercase text-indigo-400">{props.stats.videoCount} {t("common.videos", "Videos")}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                        <Music2 className="h-3 w-3 text-emerald-400" />
                        <span className="text-[10px] font-black uppercase text-emerald-400">
                            {props.stats.total - props.stats.imageCount - props.stats.videoCount} {t("common.audio", "Audio")}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-zinc-500/10 px-2 py-1 rounded-full border border-zinc-500/20">
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
                    >
                        {selectionMode ? <CheckSquare className="h-4 w-4 mr-1.5" /> : <Square className="h-4 w-4 mr-1.5" />}
                        {selectionMode ? "Cancel Select" : "Select Multiple"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={props.refresh} className="h-8 w-8 p-0 rounded-full hover:bg-muted">
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {selectionMode && selectedIds.size > 0 ? (
                <div className="rounded-2xl border border-border bg-muted/20 p-3 flex items-center gap-2 flex-wrap">
                    <div className="text-sm font-bold mr-2">{selectedIds.size} selected</div>
                    <Button type="button" variant="secondary" size="sm" onClick={handleBulkFavorite}>
                        <Star className="h-4 w-4 mr-1.5" />
                        Favorite Selected
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => void handleBulkDeleteLocal()} disabled={selectedLocalCount === 0}>
                        <Trash2 className="h-4 w-4 mr-1.5" />
                        Delete Local ({selectedLocalCount})
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>Clear</Button>
                </div>
            ) : null}

            {visibleItems.length === 0 ? (
                <div className="rounded-2xl border border-border/50 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                    No items in this filter.
                </div>
            ) : null}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
                {visibleItems.map((item, index) => {
                    const isFavorite = favorites.has(item.remoteUrl);
                    const isSelected = selectedIds.has(item.id);
                    const showMenu = openMenuItemId === item.id;

                    return (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.03 }}
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                                if (isNoPreviewTarget(e.target) || isInTopRightNoPreviewZone(e.currentTarget, e)) return;
                                if (longPressStateRef.current.triggered && longPressStateRef.current.itemId === item.id) {
                                    longPressStateRef.current = { itemId: null, triggered: false };
                                    return;
                                }
                                if (selectionMode) {
                                    toggleSelect(item.id);
                                    return;
                                }
                                setSelectedItem(item);
                            }}
                            onKeyDown={(e) => {
                                if (e.key !== "Enter" && e.key !== " ") return;
                                e.preventDefault();
                                if (selectionMode) toggleSelect(item.id);
                                else setSelectedItem(item);
                            }}
                            onMouseDown={(e) => {
                                if (!selectionMode || e.button !== 0 || isNoPreviewTarget(e.target)) return;
                                const shouldSelect = !selectedIds.has(item.id);
                                setSelected(item.id, shouldSelect);
                                dragSelectValueRef.current = shouldSelect;
                                setIsDragSelecting(true);
                            }}
                            onMouseEnter={() => {
                                if (!selectionMode || !isDragSelecting) return;
                                setSelected(item.id, dragSelectValueRef.current);
                            }}
                            onPointerDown={(e) => {
                                if (e.pointerType !== "touch" || isNoPreviewTarget(e.target)) return;
                                if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                                longPressStateRef.current = { itemId: item.id, triggered: false };
                                longPressTimerRef.current = setTimeout(() => {
                                    setSelectionMode(true);
                                    setSelected(item.id, true);
                                    longPressStateRef.current = { itemId: item.id, triggered: true };
                                }, 450);
                            }}
                            onPointerUp={() => {
                                if (longPressTimerRef.current) {
                                    clearTimeout(longPressTimerRef.current);
                                    longPressTimerRef.current = null;
                                }
                            }}
                            onPointerCancel={() => {
                                if (longPressTimerRef.current) {
                                    clearTimeout(longPressTimerRef.current);
                                    longPressTimerRef.current = null;
                                }
                            }}
                            className={cn(
                                "group relative aspect-square rounded-[24px] overflow-hidden bg-muted border border-border/50 hover:shadow-xl hover:shadow-primary/5 transition-all text-left",
                                isSelected && "ring-2 ring-primary"
                            )}
                        >
                            {item.attachment.kind === "image" ? (
                                <img
                                    src={item.attachment.url}
                                    alt={item.attachment.fileName}
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                />
                            ) : item.attachment.kind === "video" ? (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-indigo-500/5 transition-colors group-hover:bg-indigo-500/10">
                                    <VideoIcon className="h-8 w-8 text-indigo-500/40" />
                                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-500/40 mt-2">VIDEO</span>
                                </div>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-emerald-500/5 transition-colors group-hover:bg-emerald-500/10">
                                    <Music2 className="h-8 w-8 text-emerald-500/50" />
                                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-500/50 mt-2">AUDIO</span>
                                </div>
                            )}

                            <div className="absolute top-2 left-2 rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-widest bg-black/60 text-white backdrop-blur-sm">
                                {item.isLocalCached ? "Local" : "Remote"}
                            </div>

                            {isFavorite ? (
                                <div data-no-preview="true" className="absolute top-2 right-12 rounded-md bg-amber-400/90 p-1 text-black">
                                    <Star className="h-3.5 w-3.5 fill-current" />
                                </div>
                            ) : null}

                            {selectionMode ? (
                                <button
                                    data-no-preview="true"
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleSelect(item.id);
                                    }}
                                    className="absolute top-2 right-2 h-8 w-8 rounded-md bg-black/60 text-white flex items-center justify-center z-20"
                                >
                                    {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                                </button>
                            ) : (
                                <div
                                    data-no-preview="true"
                                    className="absolute top-1 right-1 z-20 h-12 w-12 rounded-xl"
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => e.stopPropagation()}
                                    onPointerDown={(e) => e.stopPropagation()}
                                >
                                    <button
                                        data-no-preview="true"
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenMenuItemId((prev) => prev === item.id ? null : item.id);
                                        }}
                                        className="h-8 w-8 rounded-md bg-black/60 text-white flex items-center justify-center"
                                    >
                                        <MoreVertical className="h-4 w-4" />
                                    </button>
                                    {showMenu ? (
                                        <div
                                            data-no-preview="true"
                                            onClick={(e) => e.stopPropagation()}
                                            className="absolute right-0 mt-1 min-w-[170px] rounded-lg border border-black/10 bg-white p-1 text-xs shadow-xl dark:border-white/10 dark:bg-zinc-900"
                                        >
                                            <button
                                                data-no-preview="true"
                                                type="button"
                                                onClick={() => {
                                                    toggleFavorite(item.remoteUrl);
                                                    setOpenMenuItemId(null);
                                                }}
                                                className="w-full text-left rounded px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/5"
                                            >
                                                {isFavorite ? "Unfavorite" : "Favorite"}
                                            </button>
                                            <button
                                                data-no-preview="true"
                                                type="button"
                                                onClick={() => {
                                                    setSelectionMode(true);
                                                    setSelected(item.id, true);
                                                    setOpenMenuItemId(null);
                                                }}
                                                className="w-full text-left rounded px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/5"
                                            >
                                                Select
                                            </button>
                                            <button
                                                data-no-preview="true"
                                                type="button"
                                                onClick={async () => {
                                                    await props.deleteLocalCopy(item.remoteUrl);
                                                    setOpenMenuItemId(null);
                                                }}
                                                disabled={!item.isLocalCached}
                                                className="w-full text-left rounded px-2 py-1.5 text-rose-600 disabled:opacity-50 hover:bg-rose-500/10"
                                            >
                                                Delete Local Copy
                                            </button>
                                        </div>
                                    ) : null}
                                </div>
                            )}

                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                                <div className="text-[9px] text-white/80 truncate font-bold">{item.attachment.fileName}</div>
                                <div className="text-[9px] text-white/60">{item.timestamp.toLocaleString()}</div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            <AnimatePresence>
                {selectedItem ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm p-4"
                    >
                        <div className="mx-auto h-full max-w-5xl flex flex-col">
                            <div className="flex justify-between items-center pb-3">
                                <div className="min-w-0">
                                    <div className="text-sm font-black text-white truncate">{selectedItem.attachment.fileName}</div>
                                    <div className="text-xs text-white/70 truncate">
                                        {selectedItem.isLocalCached ? "Stored locally" : "Remote-only preview"} {selectedItem.localRelativePath ? `• ${selectedItem.localRelativePath}` : ""}
                                    </div>
                                </div>
                                <Button type="button" variant="ghost" size="icon" onClick={() => setSelectedItem(null)} className="text-white hover:bg-white/10">
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>

                            <div className="flex-1 rounded-2xl border border-white/10 bg-black/30 p-3 flex items-center justify-center overflow-hidden">
                                {selectedItem.attachment.kind === "image" ? (
                                    <img src={selectedItem.attachment.url} alt={selectedItem.attachment.fileName} className="max-h-full max-w-full object-contain rounded-xl" />
                                ) : selectedItem.attachment.kind === "video" ? (
                                    <video src={selectedItem.attachment.url} controls className="max-h-full max-w-full rounded-xl" />
                                ) : (
                                    <div className="w-full max-w-xl bg-black/40 rounded-xl p-6 border border-white/10">
                                        <div className="mb-4 text-white/80 text-sm">Audio preview</div>
                                        <audio src={selectedItem.attachment.url} controls className="w-full" />
                                    </div>
                                )}
                            </div>

                            <div className="pt-3 flex flex-wrap gap-2">
                                <Button type="button" variant="secondary" onClick={() => window.open(selectedItem.remoteUrl, "_blank")}>
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    Open Source URL
                                </Button>
                                <Button type="button" variant="outline" onClick={() => toggleFavorite(selectedItem.remoteUrl)}>
                                    <Star className={cn("h-4 w-4 mr-2", favorites.has(selectedItem.remoteUrl) ? "fill-current" : "")} />
                                    {favorites.has(selectedItem.remoteUrl) ? "Favorited" : "Favorite"}
                                </Button>
                                {selectedItem.isLocalCached ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={async () => {
                                            await props.deleteLocalCopy(selectedItem.remoteUrl);
                                            setSelectedItem(null);
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete Local Copy
                                    </Button>
                                ) : (
                                    <Button type="button" variant="ghost" disabled>
                                        <HardDrive className="h-4 w-4 mr-2" />
                                        No local copy available
                                    </Button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </div>
    );
}
