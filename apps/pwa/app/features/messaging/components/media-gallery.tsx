
import React from "react";
import Image from "next/image";
import { Button } from "../../../components/ui/button";
import { useTranslation } from "react-i18next";
import { Play, Headphones } from "lucide-react";
import type { MediaItem } from "../types";
import { inferAttachmentKind } from "../utils/logic";

interface MediaGalleryProps {
    isOpen: boolean;
    onClose: () => void;
    conversationDisplayName: string;
    mediaItems: ReadonlyArray<MediaItem>;
    onSelect: (index: number) => void;
}

export function MediaGallery({ isOpen, onClose, conversationDisplayName, mediaItems, onSelect }: MediaGalleryProps) {
    const { t } = useTranslation();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onPointerDown={onClose}>
            <div
                className="w-full max-w-4xl rounded-2xl border border-black/10 bg-white shadow-xl dark:border-white/10 dark:bg-zinc-950"
                onPointerDown={(e) => e.stopPropagation()}
            >
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
                    {mediaItems.length === 0 ? (
                        <div className="rounded-xl border border-black/10 bg-zinc-50 p-6 text-sm text-zinc-700 dark:border-white/10 dark:bg-zinc-950/60 dark:text-zinc-300">
                            {t("messaging.noMedia")}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                            {mediaItems.map((item, index) => (
                                (() => {
                                    const effectiveKind = inferAttachmentKind(item.attachment);
                                    return (
                                <button
                                    key={item.messageId}
                                    type="button"
                                    className="group relative overflow-hidden rounded-xl border border-black/10 bg-zinc-50 dark:border-white/10 dark:bg-zinc-950/60"
                                    onClick={() => onSelect(index)}
                                >
                                    <div className="aspect-square">
                                        {effectiveKind === "image" ? (
                                            <Image src={item.attachment.url} alt={item.attachment.fileName} width={480} height={480} unoptimized className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                                        ) : effectiveKind === "audio" ? (
                                            <div className="flex h-full w-full flex-col items-center justify-center bg-purple-600/90 text-white">
                                                <Headphones className="h-8 w-8 mb-2" />
                                                <div className="text-[10px] font-black uppercase tracking-widest opacity-60">Audio</div>
                                            </div>
                                        ) : (
                                            <div className="relative flex h-full w-full flex-col items-center justify-center bg-zinc-900 text-white">
                                                <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md mb-2">
                                                    <Play className="h-5 w-5 fill-current ml-0.5" />
                                                </div>
                                                <div className="text-[10px] font-black uppercase tracking-widest opacity-40">Video</div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-2 text-left text-[10px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
                                        <div className="truncate">{item.attachment.fileName}</div>
                                    </div>
                                </button>
                                    );
                                })()
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
