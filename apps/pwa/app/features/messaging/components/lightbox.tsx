import React from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { VideoPlayer } from "./video-player";
import { AudioPlayer } from "./audio-player";
import type { MediaItem } from "../types";
import { inferAttachmentKind } from "../utils/logic";
import { Minus, Plus, X, Download, Maximize2, Minimize2, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence, useMotionValue } from "framer-motion";
import { cn } from "@/app/lib/utils";

interface LightboxProps {
    readonly item: MediaItem | undefined;
    readonly onClose: () => void;
    readonly onPrev?: () => void;
    readonly onNext?: () => void;
    readonly hasPrev?: boolean;
    readonly hasNext?: boolean;
}

export function Lightbox({ item, onClose, onPrev, onNext, hasPrev, hasNext }: LightboxProps) {
    const { t } = useTranslation();
    const MIN_ZOOM = 1;
    const MAX_ZOOM = 4;
    const ZOOM_STEP = 0.5;
    const [zoom, setZoom] = React.useState(1);
    const [constraints, setConstraints] = React.useState({ left: 0, right: 0, top: 0, bottom: 0 });
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const contentRef = React.useRef<HTMLDivElement>(null);
    const pinchStartDistanceRef = React.useRef<number | null>(null);
    const pinchStartZoomRef = React.useRef(1);

    const updateConstraints = React.useCallback(() => {
        if (!containerRef.current || !contentRef.current) return;
        const cW = containerRef.current.offsetWidth;
        const cH = containerRef.current.offsetHeight;
        const dW = contentRef.current.offsetWidth;
        const dH = contentRef.current.offsetHeight;

        const xMax = Math.max(0, (dW * zoom - cW) / 2);
        const yMax = Math.max(0, (dH * zoom - cH) / 2);

        setConstraints({
            left: -xMax,
            right: xMax,
            top: -yMax,
            bottom: yMax
        });
    }, [zoom]);

    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowLeft" && onPrev && hasPrev) onPrev();
            if (e.key === "ArrowRight" && onNext && hasNext) onNext();
        };
        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("resize", updateConstraints);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("resize", updateConstraints);
        };
    }, [onClose, updateConstraints]);

    React.useEffect(() => {
        setZoom(1);
        x.set(0);
        y.set(0);
        setConstraints({ left: 0, right: 0, top: 0, bottom: 0 });
    }, [item?.attachment.url, x, y]);

    // Update constraints whenever zoom changes or image changes
    React.useEffect(() => {
        // We need a slight delay to let the spring animation/transform settle or use requestAnimationFrame
        const timer = setTimeout(updateConstraints, 50);
        return () => clearTimeout(timer);
    }, [zoom, updateConstraints]);

    if (!item) return null;

    const effectiveKind = inferAttachmentKind(item.attachment);

    const clampZoom = (value: number): number => {
        return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
    };

    const handleZoom = (nextZoom: number) => {
        const clamped = clampZoom(nextZoom);
        setZoom(clamped);
        if (clamped === 1) {
            x.set(0);
            y.set(0);
        }
    };

    const zoomIn = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        handleZoom(zoom + ZOOM_STEP);
    };

    const zoomOut = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        handleZoom(zoom - ZOOM_STEP);
    };

    const handleWheel = (event: React.WheelEvent) => {
        event.preventDefault();
        const delta = event.deltaY < 0 ? ZOOM_STEP / 2 : -ZOOM_STEP / 2;
        handleZoom(zoom + delta);
    };

    const getTouchDistance = (touches: React.TouchList): number | null => {
        if (touches.length < 2) return null;
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.hypot(dx, dy);
    };

    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation();
        const link = document.createElement("a");
        link.href = item.attachment.url;
        link.download = item.attachment.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const isDraggable = zoom > 1;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-2xl p-4 sm:p-8"
                onPointerDown={onClose}
            >
                {/* Top Controls Bar */}
                <motion.div
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="absolute top-16 md:top-20 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-2xl"
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center gap-1.5 pr-3 border-r border-white/10 mr-1">
                        <span className="text-[11px] font-bold tracking-tight text-white/40 uppercase hidden sm:inline">
                            {effectiveKind}
                        </span>
                        <span className="text-[13px] font-medium text-white/90 truncate max-w-[120px] sm:max-w-[240px]">
                            {item.attachment.fileName}
                        </span>
                    </div>

                    <div className="flex items-center gap-1">
                        {effectiveKind === "image" && (
                            <>
                                <ControlButton onClick={zoomOut} disabled={zoom <= MIN_ZOOM}>
                                    <Minus className="h-4 w-4" />
                                </ControlButton>
                                <span className="text-[10px] font-black w-8 text-center text-white/60">
                                    {Math.round(zoom * 100)}%
                                </span>
                                <ControlButton onClick={zoomIn} disabled={zoom >= MAX_ZOOM}>
                                    <Plus className="h-4 w-4" />
                                </ControlButton>
                            </>
                        )}

                        <div className="w-px h-4 bg-white/10 mx-1" />

                        <ControlButton onClick={handleDownload} title={t("common.download")}>
                            <Download className="h-4 w-4" />
                        </ControlButton>

                        <ControlButton onClick={onClose} className="hover:bg-red-500/20 hover:text-red-400">
                            <X className="h-4 w-4" />
                        </ControlButton>
                    </div>
                </motion.div>

                {/* Navigation Arrows */}
                <div className="absolute inset-y-0 left-0 flex items-center px-4 pointer-events-none z-[110]">
                    {hasPrev && onPrev && (
                        <ControlButton
                            onClick={(e) => { e.stopPropagation(); onPrev(); }}
                            className="bg-black/20 hover:bg-black/40 h-12 w-12 border-white/10 pointer-events-auto"
                        >
                            <ChevronLeft className="h-6 w-6" />
                        </ControlButton>
                    )}
                </div>
                <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none z-[110]">
                    {hasNext && onNext && (
                        <ControlButton
                            onClick={(e) => { e.stopPropagation(); onNext(); }}
                            className="bg-black/20 hover:bg-black/40 h-12 w-12 border-white/10 pointer-events-auto"
                        >
                            <ChevronRight className="h-6 w-6" />
                        </ControlButton>
                    )}
                </div>

                {/* Content Area */}
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="relative w-full h-full flex items-center justify-center rounded-3xl overflow-hidden shadow-2xl shadow-black/50"
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    {effectiveKind === "image" ? (
                        <div
                            ref={containerRef}
                            className={cn(
                                "relative w-full h-full flex items-center justify-center overflow-hidden touch-none",
                                isDraggable ? "cursor-grab active:cursor-grabbing" : "cursor-default"
                            )}
                            onWheel={handleWheel}
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
                                handleZoom(nextZoom);
                            }}
                            onTouchEnd={() => {
                                pinchStartDistanceRef.current = null;
                            }}
                            onDoubleClick={() => handleZoom(zoom > 1 ? 1 : 2)}
                        >
                            <motion.div
                                ref={contentRef}
                                drag={isDraggable}
                                dragConstraints={constraints}
                                dragElastic={0.1}
                                dragMomentum={true}
                                transition={{ type: "spring", damping: 30, stiffness: 200 }}
                                className="relative flex items-center justify-center shrink-0"
                                style={{
                                    transformOrigin: "center center",
                                    x,
                                    y,
                                    scale: zoom
                                }}
                            >
                                <Image
                                    src={item.attachment.url}
                                    alt={item.attachment.fileName}
                                    width={2048}
                                    height={1152}
                                    unoptimized
                                    className="max-h-[85vh] w-auto max-w-[90vw] object-contain rounded-lg shadow-2xl pointer-events-none"
                                    priority
                                    onLoad={() => {
                                        // The image fully loaded, triggering a final boundary update
                                        updateConstraints();
                                    }}
                                />
                            </motion.div>
                        </div>
                    ) : effectiveKind === "audio" ? (
                        <div className="w-full max-w-lg p-8 bg-zinc-900/50 backdrop-blur-xl rounded-[40px] border border-white/5 ring-1 ring-white/10 shadow-2xl">
                            <AudioPlayer src={item.attachment.url} isOutgoing={false} />
                            <div className="mt-6 flex flex-col items-center gap-1">
                                <span className="text-sm font-bold text-white/90">{item.attachment.fileName}</span>
                                <span className="text-[10px] uppercase font-black tracking-widest text-white/30 truncate px-4">{item.attachment.contentType}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full max-w-5xl aspect-video rounded-3xl overflow-hidden bg-black shadow-2xl relative group">
                            <VideoPlayer src={item.attachment.url} isOutgoing={false} className="w-full h-full" />
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

function ControlButton({
    children,
    onClick,
    disabled = false,
    className,
    title
}: {
    readonly children: React.ReactNode;
    readonly onClick: (e: React.MouseEvent) => void;
    readonly disabled?: boolean;
    readonly className?: string;
    readonly title?: string;
}) {
    return (
        <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={cn(
                "h-9 w-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 text-white/70 hover:text-white transition-all disabled:opacity-30 disabled:pointer-events-none disabled:scale-100 border border-white/5",
                className
            )}
        >
            {children}
        </motion.button>
    );
}
