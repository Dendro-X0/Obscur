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
import { ChevronLeft, ChevronRight, Download, FileText, Minus, Plus, RotateCcw, X } from "lucide-react";
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
  readonly activeIndex?: number;
  readonly totalItems?: number;
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

const isPdfAttachment = (attachment: MediaItem["attachment"]): boolean => {
  const contentType = (attachment.contentType ?? "").toLowerCase();
  const fileName = (attachment.fileName ?? "").toLowerCase();
  return contentType.includes("pdf") || fileName.endsWith(".pdf");
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
          ) : (kind === "audio" || kind === "voice_note") ? (
            <div className="p-6">
              <AudioPlayer
                src={item.attachment.url}
                isOutgoing={false}
                voiceNoteMetadata={getVoiceNoteAttachmentMetadata(item.attachment)}
              />
            </div>
          ) : (kind === "file" && isPdfAttachment(item.attachment)) ? (
            <div className="h-[90vh] w-full bg-white p-3 dark:bg-zinc-950">
              <iframe
                src={item.attachment.url}
                title={`PDF preview: ${item.attachment.fileName}`}
                className="h-full w-full rounded-xl border border-zinc-300/60 dark:border-white/10"
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

function V083Lightbox({ item, onClose, onPrev, onNext, hasPrev, hasNext, activeIndex, totalItems }: LightboxProps) {
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
  const hasSequence = typeof totalItems === "number" && totalItems > 1;
  const currentItemNumber = typeof activeIndex === "number" ? activeIndex + 1 : null;
  const previewPositionLabel = currentItemNumber !== null && hasSequence
    ? `${currentItemNumber} / ${totalItems}`
    : null;
  const previewTypeLabel = kind === "voice_note"
    ? t("messaging.voiceNotes", "Voice Notes")
    : kind === "file"
      ? "PDF"
      : t(`common.${kind}`, kind.charAt(0).toUpperCase() + kind.slice(1));

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
          className="absolute left-5 top-5 z-[120] max-w-[min(70vw,24rem)] rounded-[28px] border border-zinc-300/70 bg-white/88 px-4 py-3 shadow-xl backdrop-blur-xl dark:border-white/15 dark:bg-black/45"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-zinc-300/70 bg-zinc-100/90 px-2 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-zinc-700 dark:border-white/10 dark:bg-white/10 dark:text-white/75">
              {previewTypeLabel}
            </span>
            {previewPositionLabel ? (
              <span
                aria-live="polite"
                className="rounded-full border border-zinc-300/70 bg-zinc-100/90 px-2 py-1 text-[10px] font-black tracking-[0.2em] text-zinc-700 dark:border-white/10 dark:bg-white/10 dark:text-white/70"
              >
                {previewPositionLabel}
              </span>
            ) : null}
          </div>
          <p className="mt-2 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {item!.attachment.fileName}
          </p>
        </div>
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
        ) : (kind === "audio" || kind === "voice_note") ? (
          <div className="w-full max-w-2xl rounded-3xl border border-zinc-300/60 bg-white/70 p-8 shadow-[0_28px_90px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-black/70 dark:shadow-[0_30px_95px_rgba(0,0,0,0.58)]" onPointerDown={(event) => event.stopPropagation()}>
            <AudioPlayer
              src={item!.attachment.url}
              isOutgoing={false}
              voiceNoteMetadata={getVoiceNoteAttachmentMetadata(item!.attachment)}
            />
          </div>
        ) : (kind === "file" && isPdfAttachment(item!.attachment)) ? (
          <div className="w-full max-w-6xl overflow-hidden rounded-3xl border border-zinc-300/60 bg-white/70 p-4 shadow-[0_28px_90px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-black/70 dark:shadow-[0_30px_95px_rgba(0,0,0,0.58)]" onPointerDown={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
              <FileText className="h-4 w-4" />
              <span>{item!.attachment.fileName}</span>
            </div>
            <iframe
              src={item!.attachment.url}
              title={`PDF preview: ${item!.attachment.fileName}`}
              className="h-[78vh] w-full rounded-2xl border border-zinc-300/60 bg-white dark:border-white/10 dark:bg-zinc-950"
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
            className="media-viewer-nav media-viewer-nav-left hidden md:inline-flex"
            aria-label={t("messaging.preview.previousItem", "Previous item")}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : null}

        {hasNext && onNext ? (
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onNext}
            className="media-viewer-nav media-viewer-nav-right hidden md:inline-flex"
            aria-label={t("messaging.preview.nextItem", "Next item")}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        ) : null}

        {hasSequence ? (
          <div
            className="absolute bottom-5 left-1/2 z-[120] flex w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2 items-center gap-2 rounded-[28px] border border-zinc-300/70 bg-white/90 p-2 shadow-2xl backdrop-blur-2xl dark:border-white/15 dark:bg-black/50"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-[20px] border border-zinc-300/70 bg-zinc-100/90 px-4 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-200/90 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
              onClick={onPrev}
              disabled={!hasPrev || !onPrev}
            >
              <ChevronLeft className="h-4 w-4 shrink-0" />
              <span className="truncate">{t("common.previous", "Previous")}</span>
            </button>
            <div className="min-w-[4.75rem] rounded-[20px] border border-zinc-300/70 bg-white/95 px-3 py-3 text-center text-[11px] font-black tracking-[0.24em] text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
              {previewPositionLabel}
            </div>
            <button
              type="button"
              className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-[20px] border border-zinc-300/70 bg-zinc-100/90 px-4 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-200/90 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
              onClick={onNext}
              disabled={!hasNext || !onNext}
            >
              <span className="truncate">{t("common.next", "Next")}</span>
              <ChevronRight className="h-4 w-4 shrink-0" />
            </button>
          </div>
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
}
