import React from "react";
import Image from "next/image";
import { Button } from "../../../components/ui/button";
import { useTranslation } from "react-i18next";
import { VideoPlayer } from "./video-player";
import { AudioPlayer } from "./audio-player";
import type { MediaItem } from "../types";
import { inferAttachmentKind } from "../utils/logic";
import { Minus, Plus, X } from "lucide-react";

interface LightboxProps {
    item: MediaItem | undefined;
    onClose: () => void;
}

export function Lightbox({ item, onClose }: LightboxProps) {
    const { t } = useTranslation();
    if (!item) return null;
    const effectiveKind = inferAttachmentKind(item.attachment);
    const MIN_ZOOM = 1;
    const MAX_ZOOM = 4;
    const ZOOM_STEP = 0.2;
    const [zoom, setZoom] = React.useState(1);
    const pinchStartDistanceRef = React.useRef<number | null>(null);
    const pinchStartZoomRef = React.useRef(1);

    React.useEffect(() => {
        setZoom(1);
    }, [item.attachment.url]);

    const clampZoom = React.useCallback((value: number): number => {
        return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
    }, []);

    const zoomIn = React.useCallback(() => {
        setZoom((prev) => clampZoom(prev + ZOOM_STEP));
    }, [clampZoom]);

    const zoomOut = React.useCallback(() => {
        setZoom((prev) => clampZoom(prev - ZOOM_STEP));
    }, [clampZoom]);

    const getTouchDistance = (touches: React.TouchList): number | null => {
        if (touches.length < 2) return null;
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.hypot(dx, dy);
    };

    return (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4" onPointerDown={onClose}>
            <div className="relative w-full max-w-5xl" onPointerDown={(e) => e.stopPropagation()}>
                <div className="absolute right-2 top-2 z-20 flex items-center gap-2">
                    {effectiveKind === "image" ? (
                        <>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={zoomOut}
                                disabled={zoom <= MIN_ZOOM}
                                aria-label={t("common.zoomOut", "Zoom out")}
                                title={t("common.zoomOut", "Zoom out")}
                            >
                                <Minus className="h-4 w-4" />
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={zoomIn}
                                disabled={zoom >= MAX_ZOOM}
                                aria-label={t("common.zoomIn", "Zoom in")}
                                title={t("common.zoomIn", "Zoom in")}
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </>
                    ) : null}
                    <Button type="button" variant="secondary" onClick={onClose} aria-label={t("common.close", "Close")} title={t("common.close", "Close")}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
                    {effectiveKind === "image" ? (
                        <div
                            className="relative h-[90vh] w-full overflow-hidden touch-none"
                            onWheel={(event) => {
                                event.preventDefault();
                                const delta = event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
                                setZoom((prev) => clampZoom(prev + delta));
                            }}
                            onTouchStart={(event) => {
                                const dist = getTouchDistance(event.touches);
                                if (dist === null) return;
                                pinchStartDistanceRef.current = dist;
                                pinchStartZoomRef.current = zoom;
                            }}
                            onTouchMove={(event) => {
                                const startDistance = pinchStartDistanceRef.current;
                                const currentDistance = getTouchDistance(event.touches);
                                if (!startDistance || !currentDistance) return;
                                event.preventDefault();
                                const nextZoom = pinchStartZoomRef.current * (currentDistance / startDistance);
                                setZoom(clampZoom(nextZoom));
                            }}
                            onTouchEnd={() => {
                                pinchStartDistanceRef.current = null;
                            }}
                        >
                            <div
                                className="absolute inset-0 flex items-center justify-center"
                                style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
                            >
                                <Image
                                    src={item.attachment.url}
                                    alt={item.attachment.fileName}
                                    width={1280}
                                    height={720}
                                    unoptimized
                                    className="h-auto w-full max-h-[90vh] object-contain"
                                />
                            </div>
                            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold tracking-wider text-white/90">
                                {Math.round(zoom * 100)}%
                            </div>
                        </div>
                    ) : effectiveKind === "audio" ? (
                        <div className="p-6">
                            <AudioPlayer src={item.attachment.url} isOutgoing={false} />
                        </div>
                    ) : (
                        <VideoPlayer src={item.attachment.url} isOutgoing={false} className="max-h-[90vh]" />
                    )}
                </div>
            </div>
        </div>
    );
}
