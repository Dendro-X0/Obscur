
import React from "react";
import Image from "next/image";
import { Button } from "../../../components/ui/button";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "../types";

interface LightboxProps {
    item: MediaItem | undefined;
    onClose: () => void;
}

export function Lightbox({ item, onClose }: LightboxProps) {
    const { t } = useTranslation();
    if (!item) return null;

    return (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4" onPointerDown={onClose}>
            <div className="relative w-full max-w-5xl" onPointerDown={(e) => e.stopPropagation()}>
                <div className="absolute right-2 top-2 z-10">
                    <Button type="button" variant="secondary" onClick={onClose}>
                        {t("common.close")}
                    </Button>
                </div>
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
                    {item.attachment.kind === "image" ? (
                        <Image src={item.attachment.url} alt={item.attachment.fileName} width={1280} height={720} unoptimized className="h-auto w-full max-h-[90vh] object-contain" />
                    ) : (
                        <video src={item.attachment.url} controls className="h-auto w-full max-h-[90vh]" />
                    )}
                </div>
            </div>
        </div>
    );
}
