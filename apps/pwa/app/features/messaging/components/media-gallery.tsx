import React from "react";
import Image from "next/image";
import { Button } from "../../../components/ui/button";
import { useTranslation } from "react-i18next";
import { Music2, Mic, FileText } from "lucide-react";
import type { MediaItem } from "../types";
import { inferAttachmentKind } from "../utils/logic";
import { getVoiceNoteAttachmentMetadata } from "@/app/features/messaging/services/voice-note-metadata";
import { cn } from "@/app/lib/utils";
import { AttachmentContextMenu, type AttachmentContextMenuState } from "./attachment-context-menu";
import { getAttachmentContextMenuTriggerProps } from "./attachment-context-menu-handlers";
import { MESSAGING_OVERLAY_BACKDROP_CLASS, MessagingOverlayPortal } from "./messaging-overlay-portal";
import { VideoPosterTile } from "./video-poster-tile";
interface MediaGalleryProps {
    isOpen: boolean;
    onClose: () => void;
    conversationDisplayName: string;
    mediaItems: ReadonlyArray<MediaItem>;
    onSelect: (index: number) => void;
}
export function MediaGallery({ isOpen, onClose, conversationDisplayName, mediaItems, onSelect }: MediaGalleryProps) {
    const { t } = useTranslation();
    const [activeFilter, setActiveFilter] = React.useState<"all" | "image" | "video" | "voice_note">("all");
    const [attachmentContextMenu, setAttachmentContextMenu] = React.useState<AttachmentContextMenuState>(null);
    const openAttachmentContextMenu = React.useCallback((params: NonNullable<AttachmentContextMenuState>): void => {
        setAttachmentContextMenu(params);
    }, []);
    const enrichedMediaItems = React.useMemo(() => (mediaItems.map((item, index) => {
        const kind = inferAttachmentKind(item.attachment);
        const voiceNoteMetadata = getVoiceNoteAttachmentMetadata(item.attachment);
        return {
            item,
            index,
            kind,
            voiceNoteMetadata,
        } as const;
    })), [mediaItems]);
    const filteredMediaItems = React.useMemo(() => (enrichedMediaItems.filter((entry) => {
        if (activeFilter === "all")
            return true;
        if (activeFilter === "voice_note")
            return entry.voiceNoteMetadata.isVoiceNote;
        return entry.kind === activeFilter;
    })), [activeFilter, enrichedMediaItems]);
    const filterCounts = React.useMemo(() => ({
        all: enrichedMediaItems.length,
        image: enrichedMediaItems.filter((entry) => entry.kind === "image").length,
        video: enrichedMediaItems.filter((entry) => entry.kind === "video").length,
        voice_note: enrichedMediaItems.filter((entry) => entry.voiceNoteMetadata.isVoiceNote).length,
    }), [enrichedMediaItems]);
    React.useEffect(() => {
        if (!isOpen) {
            return;
        }
        setActiveFilter("all");
        const handleEscapeDismiss = (event: KeyboardEvent): void => {
            if (event.key !== "Escape") {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            onClose();
        };
        window.addEventListener("keydown", handleEscapeDismiss);
        return () => {
            window.removeEventListener("keydown", handleEscapeDismiss);
        };
    }, [isOpen, onClose]);
    if (!isOpen)
        return null;
    return (<MessagingOverlayPortal>
        <div data-escape-layer="open" className={cn(MESSAGING_OVERLAY_BACKDROP_CLASS, "flex items-center justify-center p-4")} onPointerDown={onClose}>
            <div className="w-full max-w-4xl rounded-2xl border border-black/10 bg-white shadow-xl dark:border-white/10 dark:bg-zinc-950" onPointerDown={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-black/10 dark:border-white/10">
                    <div>
                        <div className="text-sm font-medium">{t("messaging.media")}</div>
                        <div className="text-xs text-zinc-600 dark:text-zinc-400">{conversationDisplayName}</div>
                    </div>
                    <Button type="button" variant="secondary" onClick={onClose}>
                        {t("common.close")}
                    </Button>
                </div>
                <div className="p-4 max-h-[80vh] overflow-y-auto">
                    {mediaItems.length === 0 ? (<div className="rounded-xl border border-black/10 bg-zinc-50 p-6 text-sm text-zinc-700 dark:border-white/10 dark:bg-zinc-950/60 dark:text-zinc-300">
                            {t("messaging.noMedia")}
                        </div>) : (<div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                {[
                { id: "all", label: t("common.all"), count: filterCounts.all },
                { id: "image", label: t("common.images"), count: filterCounts.image },
                { id: "video", label: t("common.videos"), count: filterCounts.video },
                { id: "voice_note", label: t("messaging.voiceNotes"), count: filterCounts.voice_note },
            ].map((filter) => (<button key={filter.id} type="button" onClick={() => setActiveFilter(filter.id as "all" | "image" | "video" | "voice_note")} className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest transition-colors", activeFilter === filter.id
                    ? "border-purple-400/30 bg-purple-500/10 text-purple-700 dark:text-purple-300"
                    : "border-black/10 bg-white/70 text-zinc-500 hover:text-zinc-800 dark:border-white/10 dark:bg-zinc-900/70 dark:text-zinc-400 dark:hover:text-zinc-100")}>
                                        {filter.label}
                                        <span className="text-[9px] opacity-80">{filter.count}</span>
                                    </button>))}
                            </div>
                            {filteredMediaItems.length === 0 ? (<div className="rounded-xl border border-black/10 bg-zinc-50 p-6 text-sm text-zinc-700 dark:border-white/10 dark:bg-zinc-950/60 dark:text-zinc-300">
                                    {activeFilter === "voice_note"
                    ? t("messaging.noMatchingVoiceNotes")
                    : t("messaging.noMatchingMedia")}
                                </div>) : (<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                            {filteredMediaItems.map(({ item, index, kind, voiceNoteMetadata }) => ((() => {
                    return (<button key={item.messageId} type="button" className="group relative overflow-hidden rounded-xl border border-black/10 bg-zinc-50 dark:border-white/10 dark:bg-zinc-950/60" onClick={() => onSelect(index)} {...getAttachmentContextMenuTriggerProps(item.attachment, openAttachmentContextMenu)}>
                                    <div className="aspect-square">
                                        {kind === "image" ? (<Image src={item.attachment.url} alt={item.attachment.fileName} width={480} height={480} unoptimized className="h-full w-full object-cover transition-transform group-hover:scale-105"/>) : voiceNoteMetadata.isVoiceNote || kind === "voice_note" ? (<div className="flex h-full w-full flex-col items-center justify-center bg-violet-600/90 text-white">
                                                <Mic className="mb-2 h-8 w-8" aria-hidden/>
                                                <div className="text-[10px] font-black uppercase tracking-widest opacity-70">
                                                    Voice Note
                                                </div>
                                                {voiceNoteMetadata.durationLabel ? (<div className="mt-1 text-[10px] font-black tracking-widest opacity-90">
                                                        {voiceNoteMetadata.durationLabel}
                                                    </div>) : null}
                                            </div>) : kind === "audio" ? (<div className="flex h-full w-full flex-col items-center justify-center bg-emerald-700/90 text-white">
                                                <Music2 className="mb-2 h-8 w-8" aria-hidden/>
                                                <div className="text-[10px] font-black uppercase tracking-widest opacity-70">
                                                    Audio
                                                </div>
                                            </div>) : kind === "file" ? (<div className="flex h-full w-full flex-col items-center justify-center bg-amber-500/15 text-amber-900 dark:text-amber-100">
                                                <FileText className="h-8 w-8 mb-2"/>
                                                <div className="text-[10px] font-black uppercase tracking-widest opacity-70">
                                                    PDF
                                                </div>
                                            </div>) : (
                                              <VideoPosterTile src={item.attachment.url} fileName={item.attachment.fileName} />
                                            )}
                                    </div>
                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-2 text-left text-[10px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
                                        <div className="truncate">{item.attachment.fileName}</div>
                                    </div>
                                </button>);
                })()))}
                        </div>)}
                        </div>)}
                </div>
            </div>
            <AttachmentContextMenu
                state={attachmentContextMenu}
                onClose={() => setAttachmentContextMenu(null)}
            />
        </div>
    </MessagingOverlayPortal>);
}
