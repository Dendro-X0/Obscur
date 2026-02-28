"use client";

import React from "react";
import { useVaultMedia } from "../hooks/use-vault-media";
import { useMessaging } from "../../messaging/providers/messaging-provider";
import { Button } from "@dweb/ui-kit";
import { LoaderIcon, ImageIcon, VideoIcon, ExternalLink, RefreshCw, ZoomIn } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

export function VaultMediaGrid() {
    const { t } = useTranslation();
    const { mediaItems, isLoading, stats, refresh } = useVaultMedia();
    const { setIsMediaGalleryOpen, setLightboxIndex } = useMessaging();

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <LoaderIcon className="h-8 w-8 animate-spin text-primary/40" />
                <p className="text-sm text-muted-foreground animate-pulse">{t("common.loading", "Scanning vault...")}</p>
            </div>
        );
    }

    if (mediaItems.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                <div className="h-24 w-24 rounded-[32px] bg-muted flex items-center justify-center">
                    <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
                </div>
                <div className="space-y-1">
                    <h3 className="text-xl font-black">{t("vault.empty", "Vault is Empty")}</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">
                        {t("vault.emptyDesc", "Shared images and videos from your chats will appear here automatically.")}
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={refresh} className="rounded-xl font-bold">
                    <RefreshCw className="h-3 w-3 mr-2" />
                    {t("common.refresh", "Refresh")}
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                        <ImageIcon className="h-3 w-3 text-primary" />
                        <span className="text-[10px] font-black uppercase text-primary">{stats.imageCount} {t("common.images", "Images")}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                        <VideoIcon className="h-3 w-3 text-indigo-400" />
                        <span className="text-[10px] font-black uppercase text-indigo-400">{stats.videoCount} {t("common.videos", "Videos")}</span>
                    </div>
                </div>
                <Button variant="ghost" size="sm" onClick={refresh} className="h-8 w-8 p-0 rounded-full hover:bg-muted">
                    <RefreshCw className="h-4 w-4" />
                </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
                {mediaItems.map((item, index) => (
                    <motion.div
                        key={`${item.messageId}-${index}`}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => {
                            setLightboxIndex(index);
                            setIsMediaGalleryOpen(true);
                        }}
                        className="group relative aspect-square rounded-[24px] overflow-hidden bg-muted border border-border/50 hover:shadow-xl hover:shadow-primary/5 transition-all cursor-pointer"
                    >
                        {item.attachment.kind === "image" ? (
                            <img
                                src={item.attachment.url}
                                alt={item.attachment.fileName}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-indigo-500/5 transition-colors group-hover:bg-indigo-500/10">
                                <VideoIcon className="h-8 w-8 text-indigo-500/40" />
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-500/40 mt-2">VIDEO</span>
                            </div>
                        )}

                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold text-white/60 uppercase">
                                    {item.timestamp.toLocaleDateString()}
                                </span>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg bg-white/10 text-white hover:bg-white/20 hover:text-white backdrop-blur-md">
                                        <ZoomIn className="h-3 w-3" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            window.open(item.attachment.url, "_blank");
                                        }}
                                        className="h-7 w-7 rounded-lg bg-white/10 text-white hover:bg-white/20 hover:text-white backdrop-blur-md"
                                    >
                                        <ExternalLink className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
