import React from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, useMotionValue } from "framer-motion";
import { AudioPlayer } from "./audio-player";
import { VideoPlayer } from "./video-player";
import { inferAttachmentKind } from "../utils/logic";
import type { MediaItem } from "../types";
import { cn } from "@/app/lib/utils";
import { getVoiceNoteAttachmentMetadata } from "@/app/features/messaging/services/voice-note-metadata";
import { PrivacySettingsService } from "../../settings/services/privacy-settings-service";
import { ChevronLeft, ChevronRight, Download, Minus, Plus, RotateCcw, X } from "lucide-react";
import {
  MEDIA_VIEWER_MIN_ZOOM,
  MEDIA_VIEWER_MAX_ZOOM,
  buildMediaViewerState,
  clampZoom,
  computePinchZoom,
  getTouchDistance,
} from "./media-viewer-interactions";

interface LightboxProps {
  readonly item: MediaItem | undefined;
  readonly onClose: () => void;
  readonly onPrev?: () => void;
  readonly onNext?: () => void;
  readonly hasPrev?: boolean;
  readonly hasNext?: boolean;
}

type TouchListLike = Readonly<{
  length: number;
  item: (index: number) => Readonly<{ clientX: number; clientY: number }> | null;
}>;

const touchListToPoints = (touches: TouchListLike): ReadonlyArray<Readonly<{ x: number; y: number }>> => {
  const points: Array<Readonly<{ x: number; y: number }>> = [];
  for (let i = 0; i < touches.length; i += 1) {
    const point = touches.item(i);
    points.push({
      x: point?.clientX ?? 0,
      y: point?.clientY ?? 0,
    });
  }
  return points;
};

export function Lightbox(props: LightboxProps) {
  const [chatUxV083Enabled, setChatUxV083Enabled] = React.useState<boolean>(() => PrivacySettingsService.getSettings().chatUxV083);

  React.useEffect(() => {
    const onSettingsChanged = () => setChatUxV083Enabled(PrivacySettingsService.getSettings().chatUxV083);
    window.addEventListener("privacy-settings-changed", onSettingsChanged);
    return () => window.removeEventListener("privacy-settings-changed", onSettingsChanged);
  }, []);

  if (!props.item) return null;
  if (!chatUxV083Enabled) {
    return <LegacyLightbox {...props} />;
  }
  return <V083Lightbox {...props} />;
}

function LegacyLightbox({ item, onClose }: LightboxProps) {
  const { t } = useTranslation();
  if (!item) return null;
  const kind = inferAttachmentKind(item.attachment);

  return (
    <div data-escape-layer="open" className="media-preview-backdrop fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-xl" onPointerDown={onClose}>
      <div aria-hidden className="media-preview-depth-layer absolute inset-0" />
      <div className="relative w-full max-w-5xl" onPointerDown={(event) => event.stopPropagation()}>
        <button
          type="button"
          aria-label={t("common.close", "Close")}
          title={t("common.close", "Close")}
          onClick={onClose}
          className="absolute right-2 top-2 z-10 media-viewer-control"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="overflow-hidden rounded-2xl border border-zinc-300/65 bg-white/75 shadow-[0_24px_80px_rgba(15,23,42,0.24)] dark:border-white/10 dark:bg-black/75 dark:shadow-[0_28px_90px_rgba(0,0,0,0.6)]">
          {kind === "image" ? (
            <Image
              src={item.attachment.url}
              alt={item.attachment.fileName}
              width={1280}
              height={720}
              unoptimized
              className="h-auto w-full max-h-[90vh] object-contain"
            />
          ) : kind === "audio" ? (
            <div className="p-6">
              <AudioPlayer
                src={item.attachment.url}
                isOutgoing={false}
                voiceNoteMetadata={getVoiceNoteAttachmentMetadata(item.attachment)}
              />
            </div>
          ) : (
            <VideoPlayer src={item.attachment.url} isOutgoing={false} className="max-h-[90vh]" />
          )}
        </div>
      </div>
    </div>
  );
}

function V083Lightbox({ item, onClose, onPrev, onNext, hasPrev, hasNext }: LightboxProps) {
  const { t } = useTranslation();
  const kind = inferAttachmentKind(item!.attachment);
  const [zoom, setZoom] = React.useState(1);
  const [isPinching, setIsPinching] = React.useState(false);
  const pinchStartDistanceRef = React.useRef<number | null>(null);
  const pinchStartZoomRef = React.useRef(1);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const viewerState = buildMediaViewerState({
    activeIndex: 0,
    zoom,
    pan: { x: x.get(), y: y.get() },
    isPinching,
  });

  const resetView = React.useCallback(() => {
    setZoom(1);
    x.set(0);
    y.set(0);
  }, [x, y]);

  const zoomBy = React.useCallback((delta: number) => {
    setZoom((prev) => clampZoom(prev + delta, MEDIA_VIEWER_MIN_ZOOM, MEDIA_VIEWER_MAX_ZOOM));
  }, []);

  React.useEffect(() => {
    resetView();
  }, [item?.attachment.url, resetView]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "+" || event.key === "=") zoomBy(0.2);
      if (event.key === "-") zoomBy(-0.2);
      if (event.key === "ArrowLeft" && hasPrev && onPrev) onPrev();
      if (event.key === "ArrowRight" && hasNext && onNext) onNext();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasNext, hasPrev, onClose, onNext, onPrev, zoomBy]);

  const onDownload = (event: React.MouseEvent) => {
    event.stopPropagation();
    const anchor = document.createElement("a");
    anchor.href = item!.attachment.url;
    anchor.download = item!.attachment.fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        data-escape-layer="open"
        className="media-preview-backdrop fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-xl md:p-8"
        onPointerDown={onClose}
      >
        <div aria-hidden className="media-preview-depth-layer absolute inset-0" />
        <div
          className="absolute top-5 right-5 z-[120] flex items-center gap-2 rounded-2xl border border-zinc-300/70 bg-white/85 p-2 shadow-xl backdrop-blur-xl dark:border-white/15 dark:bg-black/45"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {kind === "image" ? (
            <>
              <button
                type="button"
                className="media-viewer-control"
                onClick={() => zoomBy(-0.2)}
                disabled={!viewerState.canZoomOut}
                aria-label={t("common.zoomOut", "Zoom out")}
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="media-viewer-control"
                onClick={resetView}
                aria-label={t("common.reset", "Reset")}
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="media-viewer-control"
                onClick={() => zoomBy(0.2)}
                disabled={!viewerState.canZoomIn}
                aria-label={t("common.zoomIn", "Zoom in")}
              >
                <Plus className="h-4 w-4" />
              </button>
            </>
          ) : null}
          <button type="button" className="media-viewer-control" onClick={onDownload} aria-label={t("common.download", "Download")}>
            <Download className="h-4 w-4" />
          </button>
          <button type="button" className="media-viewer-control" onClick={onClose} aria-label={t("common.close", "Close")}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {kind === "image" ? (
          <div
            className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-3xl border border-zinc-300/60 bg-white/55 shadow-[0_30px_100px_rgba(15,23,42,0.2)] dark:border-white/10 dark:bg-black/60 dark:shadow-[0_36px_110px_rgba(0,0,0,0.62)]"
            onPointerDown={(event) => event.stopPropagation()}
            onWheel={(event) => {
              event.preventDefault();
              zoomBy(event.deltaY < 0 ? 0.15 : -0.15);
            }}
            onTouchStart={(event) => {
              const distance = getTouchDistance(touchListToPoints(event.touches));
              if (distance === null) return;
              pinchStartDistanceRef.current = distance;
              pinchStartZoomRef.current = zoom;
              setIsPinching(true);
            }}
            onTouchMove={(event) => {
              const current = getTouchDistance(touchListToPoints(event.touches));
              const start = pinchStartDistanceRef.current;
              if (!start || current === null) return;
              event.preventDefault();
              setZoom(computePinchZoom({ startDistance: start, currentDistance: current, startZoom: pinchStartZoomRef.current }));
            }}
            onTouchEnd={() => {
              pinchStartDistanceRef.current = null;
              setIsPinching(false);
            }}
          >
            <motion.div
              drag={zoom > 1}
              dragElastic={0.08}
              dragMomentum
              style={{ x, y, scale: zoom }}
              className={cn("flex items-center justify-center", zoom > 1 ? "cursor-grab active:cursor-grabbing" : "")}
            >
              <Image
                src={item!.attachment.url}
                alt={item!.attachment.fileName}
                width={2048}
                height={2048}
                unoptimized
                className="max-h-[86vh] w-auto max-w-[92vw] object-contain select-none"
                priority
                draggable={false}
              />
            </motion.div>
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-zinc-300/65 bg-white/85 px-2 py-1 text-[10px] font-bold tracking-wider text-zinc-800 dark:border-white/15 dark:bg-black/60 dark:text-white">
              {Math.round(viewerState.zoom * 100)}%
            </div>
          </div>
        ) : kind === "audio" ? (
          <div className="w-full max-w-2xl rounded-3xl border border-zinc-300/60 bg-white/70 p-8 shadow-[0_28px_90px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-black/70 dark:shadow-[0_30px_95px_rgba(0,0,0,0.58)]" onPointerDown={(event) => event.stopPropagation()}>
            <AudioPlayer
              src={item!.attachment.url}
              isOutgoing={false}
              voiceNoteMetadata={getVoiceNoteAttachmentMetadata(item!.attachment)}
            />
          </div>
        ) : (
          <div className="w-full max-w-6xl overflow-hidden rounded-3xl border border-zinc-300/60 bg-white/70 shadow-[0_28px_90px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-black/70 dark:shadow-[0_30px_95px_rgba(0,0,0,0.58)]" onPointerDown={(event) => event.stopPropagation()}>
            <VideoPlayer src={item!.attachment.url} isOutgoing={false} className="max-h-[90vh]" />
          </div>
        )}

        {hasPrev && onPrev ? (
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onPrev}
            className="media-viewer-nav media-viewer-nav-left"
            aria-label={t("common.previous", "Previous")}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : null}

        {hasNext && onNext ? (
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onNext}
            className="media-viewer-nav media-viewer-nav-right"
            aria-label={t("common.next", "Next")}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
}
