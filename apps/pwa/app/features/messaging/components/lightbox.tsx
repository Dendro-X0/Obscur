import React from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, useMotionValue } from "framer-motion";
import { toast } from "@dweb/ui-kit";
import { AudioPlayer } from "./audio-player";
import { VoiceNoteLightboxPlayer } from "./voice-note-lightbox-player";
import { VideoPlayer } from "./video-player";
import { inferAttachmentKind } from "../utils/logic";
import type { MediaItem } from "../types";
import { cn } from "@/app/lib/utils";
import { getVoiceNoteAttachmentMetadata } from "@/app/features/messaging/services/voice-note-metadata";
import { PrivacySettingsService } from "../../settings/services/privacy-settings-service";
import { canSaveChatAttachmentsToLocalVault, saveChatAttachmentWithOutcome } from "@/app/features/vault/services/save-chat-attachment-to-vault";
import { downloadAttachmentToUserPath } from "@/app/features/vault/services/local-media-store";
import { AttachmentExportConfirmDialog } from "@/app/features/security/components/attachment-export-confirm-dialog";
import { VaultWriteUnlockDialog } from "@/app/features/security/components/vault-write-unlock-dialog";
import { LinkOpenConfirmDialog, useGuardedExternalLinkOpen } from "@/app/features/security";
import { useAttachmentExportGate, type UseAttachmentExportGateResult } from "../hooks/use-attachment-export-gate";
import { MEDIA_VIEWER_MIN_ZOOM, MEDIA_VIEWER_MAX_ZOOM, buildMediaViewerState, clampZoom, computePinchZoom, getTouchDistance, } from "./media-viewer-interactions";
import { MESSAGING_OVERLAY_BACKDROP_CLASS, MessagingOverlayPortal } from "./messaging-overlay-portal";
import { AttachmentContextMenu, type AttachmentContextMenuState } from "./attachment-context-menu";
import { getAttachmentContextMenuTriggerProps } from "./attachment-context-menu-handlers";
import { ChevronLeft, ChevronRight, Download, FileText, Minus, Plus, RotateCcw, X } from "lucide-react";
import { SaveToVaultControl } from "./save-to-vault-control";
interface LightboxProps {
    readonly item: MediaItem | undefined;
    readonly onClose: () => void;
    readonly onPrev?: () => void;
    readonly onNext?: () => void;
    readonly hasPrev?: boolean;
    readonly hasNext?: boolean;
    readonly activeIndex?: number;
    readonly totalItems?: number;
    readonly exportGate: UseAttachmentExportGateResult;
    readonly onRequestOpenExternalLink?: (url: string) => void | Promise<void>;
    readonly openAttachmentContextMenu: (params: NonNullable<AttachmentContextMenuState>) => void;
}
type TouchListLike = Readonly<{
    length: number;
    item: (index: number) => Readonly<{
        clientX: number;
        clientY: number;
    }> | null;
}>;
const touchListToPoints = (touches: TouchListLike): ReadonlyArray<Readonly<{
    x: number;
    y: number;
}>> => {
    const points: Array<Readonly<{
        x: number;
        y: number;
    }>> = [];
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
const IMAGE_PAN_BOUNDARY_SLACK_PX = 48;
const resolveImagePanConstraints = ({
    container,
    content,
    scale,
    slackPx = IMAGE_PAN_BOUNDARY_SLACK_PX,
}: Readonly<{
    container: HTMLDivElement | null;
    content: HTMLDivElement | null;
    scale: number;
    slackPx?: number;
}>): Readonly<{ left: number; right: number; top: number; bottom: number }> => {
    if (!container || !content || scale <= 1) {
        return { left: 0, right: 0, top: 0, bottom: 0 };
    }
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;
    const contentWidth = content.offsetWidth;
    const contentHeight = content.offsetHeight;
    const xBound = Math.max(0, (contentWidth * scale - containerWidth) / 2) + slackPx;
    const yBound = Math.max(0, (contentHeight * scale - containerHeight) / 2) + slackPx;
    return {
        left: -xBound,
        right: xBound,
        top: -yBound,
        bottom: yBound,
    };
};

export function Lightbox(props: Omit<LightboxProps, "exportGate" | "onRequestOpenExternalLink" | "openAttachmentContextMenu">) {
    const [chatUxV083Enabled, setChatUxV083Enabled] = React.useState<boolean>(() => PrivacySettingsService.getSettings().chatUxV083);
    const [attachmentContextMenu, setAttachmentContextMenu] = React.useState<AttachmentContextMenuState>(null);
    const openAttachmentContextMenu = React.useCallback((params: NonNullable<AttachmentContextMenuState>): void => {
        setAttachmentContextMenu(params);
    }, []);
    const exportGate = useAttachmentExportGate();
    const {
        pendingLinkUrl,
        cancelPendingLink,
        confirmPendingLink,
        requestOpenExternalLinkPreferNative,
    } = useGuardedExternalLinkOpen();
    React.useEffect(() => {
        if (!props.item) {
            return;
        }
        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.key === "Escape") {
                event.preventDefault();
                props.onClose();
            }
        };
        window.addEventListener("keydown", onKeyDown, true);
        return () => {
            window.removeEventListener("keydown", onKeyDown, true);
        };
    }, [props.item, props.onClose]);
    React.useEffect(() => {
        const onSettingsChanged = () => setChatUxV083Enabled(PrivacySettingsService.getSettings().chatUxV083);
        window.addEventListener("privacy-settings-changed", onSettingsChanged);
        return () => window.removeEventListener("privacy-settings-changed", onSettingsChanged);
    }, []);
    if (!props.item) {
        return null;
    }
    const content = !chatUxV083Enabled
        ? <LegacyLightbox {...props} exportGate={exportGate} onRequestOpenExternalLink={requestOpenExternalLinkPreferNative} openAttachmentContextMenu={openAttachmentContextMenu}/>
        : <V083Lightbox {...props} exportGate={exportGate} onRequestOpenExternalLink={requestOpenExternalLinkPreferNative} openAttachmentContextMenu={openAttachmentContextMenu}/>;
    return (
      <MessagingOverlayPortal>
        {content}
        <AttachmentContextMenu
            state={attachmentContextMenu}
            onClose={() => setAttachmentContextMenu(null)}
        />
        <AttachmentExportConfirmDialog
          fileName={exportGate.pendingExportFileName}
          onClose={exportGate.cancelExportConfirm}
          onConfirm={() => void exportGate.confirmExport()}
        />
        <LinkOpenConfirmDialog
          url={pendingLinkUrl}
          onClose={cancelPendingLink}
          onConfirm={() => confirmPendingLink()}
        />
      </MessagingOverlayPortal>
    );
}

function LegacyLightbox({ item, onClose, exportGate, onRequestOpenExternalLink, openAttachmentContextMenu }: LightboxProps) {
    const { t } = useTranslation();
    const [isSavingToVault, setIsSavingToVault] = React.useState(false);
    const [isSavedToVault, setIsSavedToVault] = React.useState(false);
    const [showVaultUnlock, setShowVaultUnlock] = React.useState(false);
  const [zoom, setZoom] = React.useState(1);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const imageStageRef = React.useRef<HTMLDivElement | null>(null);
  const imageDragRef = React.useRef<HTMLDivElement | null>(null);
  const [dragConstraints, setDragConstraints] = React.useState({ left: 0, right: 0, top: 0, bottom: 0 });
    if (!item)
        return null;
    const kind = inferAttachmentKind(item.attachment);
  const canZoomImage = kind === "image";
  const zoomBy = React.useCallback((delta: number) => {
    setZoom((prev) => clampZoom(prev + delta, MEDIA_VIEWER_MIN_ZOOM, MEDIA_VIEWER_MAX_ZOOM));
  }, []);
  const resetView = React.useCallback(() => {
    setZoom(1);
    x.set(0);
    y.set(0);
  }, [x, y]);
  React.useEffect(() => {
    resetView();
  }, [item?.attachment.url, resetView]);
  React.useEffect(() => {
    const updateConstraints = () => {
      const next = resolveImagePanConstraints({
        container: imageStageRef.current,
        content: imageDragRef.current,
        scale: zoom,
      });
      setDragConstraints(next);
      x.set(Math.min(Math.max(x.get(), next.left), next.right));
      y.set(Math.min(Math.max(y.get(), next.top), next.bottom));
    };
    updateConstraints();
    const timeout = window.setTimeout(updateConstraints, 100);
    window.addEventListener("resize", updateConstraints);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("resize", updateConstraints);
    };
  }, [zoom, x, y, item?.attachment.url]);
  React.useEffect(() => {
    const attachmentUrl = item?.attachment.url;
    return () => {
      if (attachmentUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(attachmentUrl);
      }
    };
  }, [item?.attachment.url]);
    const onDownload = async (event: React.MouseEvent) => {
        event.stopPropagation();
        await exportGate.runExportWithGate(item, async () => {
            const downloaded = await downloadAttachmentToUserPath({
                attachment: item.attachment,
                sourceUrl: item.attachment.url,
            });
            if (!downloaded) {
                toast.error(t("vault.saveFromChatFailed"));
                return;
            }
            if (item.attachment.url?.startsWith("blob:")) {
                toast.success(t("vault.exportDecryptedCopySuccess"));
            }
        });
    };
    const onSaveToVault = async (event: React.MouseEvent) => {
        event.stopPropagation();
        if (!canSaveChatAttachmentsToLocalVault() || isSavingToVault || isSavedToVault) {
            return;
        }
        setIsSavingToVault(true);
        try {
            const outcome = await saveChatAttachmentWithOutcome(item.attachment, t, {
                suppressUnlockToast: true,
            });
            if (outcome.status === "saved") {
                setIsSavedToVault(true);
            } else if (outcome.status === "unlock_required") {
                setShowVaultUnlock(true);
            }
        } finally {
            setIsSavingToVault(false);
        }
    };
    const retrySaveAfterUnlock = async (): Promise<void> => {
        setShowVaultUnlock(false);
        setIsSavingToVault(true);
        try {
            const outcome = await saveChatAttachmentWithOutcome(item.attachment, t);
            if (outcome.status === "saved") {
                setIsSavedToVault(true);
            }
        } finally {
            setIsSavingToVault(false);
        }
    };
    return (<div data-escape-layer="open" className={cn(MESSAGING_OVERLAY_BACKDROP_CLASS, "flex items-center justify-center p-4")} onPointerDown={onClose}>
      <VaultWriteUnlockDialog
        isOpen={showVaultUnlock}
        onClose={() => setShowVaultUnlock(false)}
        onUnlocked={() => { void retrySaveAfterUnlock(); }}
      />
      <div className="relative w-full max-w-5xl" onPointerDown={(event) => event.stopPropagation()}>
        <div className="absolute right-2 top-2 z-10 flex items-center gap-2">
          {canZoomImage ? (<>
            <button type="button" className="media-viewer-control" onClick={() => zoomBy(-0.2)} aria-label={t("common.zoomOut")}>
              <Minus className="h-4 w-4"/>
            </button>
            <button type="button" className="media-viewer-control" onClick={resetView} aria-label={t("common.reset")}>
              <RotateCcw className="h-4 w-4"/>
            </button>
            <button type="button" className="media-viewer-control" onClick={() => zoomBy(0.2)} aria-label={t("common.zoomIn")}>
              <Plus className="h-4 w-4"/>
            </button>
          </>) : null}
          {canSaveChatAttachmentsToLocalVault() ? (
            <SaveToVaultControl
              isSaving={isSavingToVault}
              isSaved={isSavedToVault}
              onSave={(event) => { void onSaveToVault(event); }}
            />
          ) : null}
          <button type="button" className="media-viewer-control" onClick={(event) => { void onDownload(event); }} aria-label={t("vault.actions.exportDecryptedCopy", "Export decrypted copy…")}>
            <Download className="h-4 w-4"/>
          </button>
          <button type="button" aria-label={t("common.close")} title={t("common.close")} onClick={onClose} className="media-viewer-control">
            <X className="h-4 w-4"/>
          </button>
        </div>
        <div className="overflow-hidden rounded-2xl border border-zinc-300/65 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.24)] dark:border-white/10 dark:bg-black/90 dark:shadow-[0_28px_90px_rgba(0,0,0,0.6)]" {...getAttachmentContextMenuTriggerProps(item.attachment, openAttachmentContextMenu)}>
          {kind === "image" ? (
            <div
              ref={imageStageRef}
              tabIndex={0}
              className="relative flex max-h-[90vh] w-full items-center justify-center overflow-hidden"
              onPointerDown={(event) => {
                event.stopPropagation();
                imageStageRef.current?.focus({ preventScroll: true });
              }}
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onWheel={(event) => {
                event.preventDefault();
                zoomBy(event.deltaY < 0 ? 0.15 : -0.15);
              }}
            >
              <motion.div
                ref={imageDragRef}
                tabIndex={0}
                drag={zoom > 1}
                dragConstraints={dragConstraints}
                dragElastic={0}
                dragMomentum={false}
                style={{ x, y, scale: zoom }}
                className={cn("flex items-center justify-center", zoom > 1 ? "cursor-grab active:cursor-grabbing" : "")}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  imageDragRef.current?.focus({ preventScroll: true });
                }}
              >
                <Image src={item.attachment.url} alt={item.attachment.fileName} width={1280} height={720} unoptimized className="h-auto w-full max-h-[90vh] object-contain select-none" draggable={false}/>
              </motion.div>
            </div>
          ) : kind === "voice_note" ? (<div className="p-6" onPointerDown={(event) => event.stopPropagation()}>
              <VoiceNoteLightboxPlayer src={item.attachment.url} voiceNoteMetadata={getVoiceNoteAttachmentMetadata(item.attachment)} onRequestOpenExternalLink={onRequestOpenExternalLink}/>
            </div>) : kind === "audio" ? (<div className="p-6" onPointerDown={(event) => event.stopPropagation()}>
              <AudioPlayer src={item.attachment.url} isOutgoing={false} voiceNoteMetadata={null} onRequestOpenExternalLink={onRequestOpenExternalLink}/>
            </div>) : (kind === "file" && isPdfAttachment(item.attachment)) ? (<div className="h-[90vh] w-full bg-white p-3 dark:bg-zinc-950">
              <iframe src={item.attachment.url} title={`PDF preview: ${item.attachment.fileName}`} className="h-full w-full rounded-xl border border-zinc-300/60 dark:border-white/10"/>
            </div>) : (<VideoPlayer src={item.attachment.url} isOutgoing={false} className="max-h-[90vh]" onRequestOpenExternalLink={onRequestOpenExternalLink}/>)}
        </div>
      </div>
    </div>);
}
function V083Lightbox({ item, onClose, onPrev, onNext, hasPrev, hasNext, activeIndex, totalItems, exportGate, onRequestOpenExternalLink, openAttachmentContextMenu }: LightboxProps) {
    const { t } = useTranslation();
    const kind = inferAttachmentKind(item!.attachment);
    const [zoom, setZoom] = React.useState(1);
    const [isPinching, setIsPinching] = React.useState(false);
    const [isSavingToVault, setIsSavingToVault] = React.useState(false);
    const [isSavedToVault, setIsSavedToVault] = React.useState(false);
    const [showVaultUnlock, setShowVaultUnlock] = React.useState(false);
    const pinchStartDistanceRef = React.useRef<number | null>(null);
    const pinchStartZoomRef = React.useRef(1);
    const imageStageRef = React.useRef<HTMLDivElement | null>(null);
    const imageDragRef = React.useRef<HTMLDivElement | null>(null);
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const [dragConstraints, setDragConstraints] = React.useState({ left: 0, right: 0, top: 0, bottom: 0 });
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
        ? t("messaging.voiceNotes")
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
        setIsSavedToVault(false);
    }, [item?.attachment.url, resetView]);
    React.useEffect(() => {
        const updateConstraints = () => {
            const next = resolveImagePanConstraints({
                container: imageStageRef.current,
                content: imageDragRef.current,
                scale: zoom,
            });
            setDragConstraints(next);
            x.set(Math.min(Math.max(x.get(), next.left), next.right));
            y.set(Math.min(Math.max(y.get(), next.top), next.bottom));
        };
        updateConstraints();
        const timeout = window.setTimeout(updateConstraints, 100);
        window.addEventListener("resize", updateConstraints);
        return () => {
            window.clearTimeout(timeout);
            window.removeEventListener("resize", updateConstraints);
        };
    }, [zoom, x, y, item?.attachment.url]);
    React.useEffect(() => {
        const attachmentUrl = item?.attachment.url;
        return () => {
            if (attachmentUrl?.startsWith("blob:")) {
                URL.revokeObjectURL(attachmentUrl);
            }
        };
    }, [item?.attachment.url]);
    React.useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape")
                onClose();
            if (event.key === "+" || event.key === "=")
                zoomBy(0.2);
            if (event.key === "-")
                zoomBy(-0.2);
            if (event.key === "ArrowLeft" && hasPrev && onPrev)
                onPrev();
            if (event.key === "ArrowRight" && hasNext && onNext)
                onNext();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [hasNext, hasPrev, onClose, onNext, onPrev, zoomBy]);
    const onDownload = async (event: React.MouseEvent) => {
        event.stopPropagation();
        await exportGate.runExportWithGate(item!, async () => {
            const downloaded = await downloadAttachmentToUserPath({
                attachment: item!.attachment,
                sourceUrl: item!.attachment.url,
            });
            if (!downloaded) {
                toast.error(t("vault.saveFromChatFailed"));
                return;
            }
            if (item!.attachment.url?.startsWith("blob:")) {
                toast.success(t("vault.exportDecryptedCopySuccess"));
            }
        });
    };
    const onSaveToVault = async (event: React.MouseEvent) => {
        event.stopPropagation();
        if (!canSaveChatAttachmentsToLocalVault() || isSavingToVault || isSavedToVault) {
            return;
        }
        setIsSavingToVault(true);
        try {
            const outcome = await saveChatAttachmentWithOutcome(item!.attachment, t, {
                suppressUnlockToast: true,
            });
            if (outcome.status === "saved") {
                setIsSavedToVault(true);
            } else if (outcome.status === "unlock_required") {
                setShowVaultUnlock(true);
            }
        } catch (error) {
            console.error("[Lightbox] Save to vault failed:", error);
        } finally {
            setIsSavingToVault(false);
        }
    };
    const retrySaveAfterUnlock = async (): Promise<void> => {
        setShowVaultUnlock(false);
        setIsSavingToVault(true);
        try {
            const outcome = await saveChatAttachmentWithOutcome(item!.attachment, t);
            if (outcome.status === "saved") {
                setIsSavedToVault(true);
            }
        } finally {
            setIsSavingToVault(false);
        }
    };
    return (<AnimatePresence>
      <VaultWriteUnlockDialog
        isOpen={showVaultUnlock}
        onClose={() => setShowVaultUnlock(false)}
        onUnlocked={() => { void retrySaveAfterUnlock(); }}
      />
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-escape-layer="open" className={cn(MESSAGING_OVERLAY_BACKDROP_CLASS, "flex items-center justify-center p-4 md:p-8")} onPointerDown={onClose}>
        <div className="absolute left-5 top-5 z-[120] max-w-[min(70vw,24rem)] rounded-[28px] border border-zinc-300/70 bg-white/95 px-4 py-3 shadow-xl dark:border-white/15 dark:bg-black/70" onPointerDown={(event) => event.stopPropagation()}>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-zinc-300/70 bg-zinc-100/90 px-2 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-zinc-700 dark:border-white/10 dark:bg-white/10 dark:text-white/75">
              {previewTypeLabel}
            </span>
            {previewPositionLabel ? (<span aria-live="polite" className="rounded-full border border-zinc-300/70 bg-zinc-100/90 px-2 py-1 text-[10px] font-black tracking-[0.2em] text-zinc-700 dark:border-white/10 dark:bg-white/10 dark:text-white/70">
                {previewPositionLabel}
              </span>) : null}
          </div>
          <p className="mt-2 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {item!.attachment.fileName}
          </p>
        </div>
        <div className="absolute top-5 right-5 z-[120] flex items-center gap-2 rounded-2xl border border-zinc-300/70 bg-white/92 p-2 shadow-xl dark:border-white/15 dark:bg-black/70" onPointerDown={(e) => e.stopPropagation()}>
          {kind === "image" ? (<>
              <button type="button" className="media-viewer-control" onClick={() => zoomBy(-0.2)} disabled={!viewerState.canZoomOut} aria-label={t("common.zoomOut")}>
                <Minus className="h-4 w-4"/>
              </button>
              <button type="button" className="media-viewer-control" onClick={resetView} aria-label={t("common.reset")}>
                <RotateCcw className="h-4 w-4"/>
              </button>
              <button type="button" className="media-viewer-control" onClick={() => zoomBy(0.2)} disabled={!viewerState.canZoomIn} aria-label={t("common.zoomIn")}>
                <Plus className="h-4 w-4"/>
              </button>
            </>) : null}
          {canSaveChatAttachmentsToLocalVault() ? (
            <SaveToVaultControl
              isSaving={isSavingToVault}
              isSaved={isSavedToVault}
              onSave={(event) => { void onSaveToVault(event); }}
            />
          ) : null}
          <button type="button" className="media-viewer-control" onClick={(event) => { void onDownload(event); }} aria-label={t("vault.actions.exportDecryptedCopy", "Export decrypted copy…")}>
            <Download className="h-4 w-4"/>
          </button>
          <button type="button" className="media-viewer-control" onClick={onClose} aria-label={t("common.close")}>
            <X className="h-4 w-4"/>
          </button>
        </div>

        <div {...getAttachmentContextMenuTriggerProps(item!.attachment, openAttachmentContextMenu)}>
        {kind === "image" ? (<div ref={imageStageRef} tabIndex={0} className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-3xl border border-zinc-300/60 bg-white/55 shadow-[0_30px_100px_rgba(15,23,42,0.2)] outline-none dark:border-white/10 dark:bg-black/60 dark:shadow-[0_36px_110px_rgba(0,0,0,0.62)]" onPointerDown={(event) => {
                event.stopPropagation();
                imageStageRef.current?.focus({ preventScroll: true });
            }} onWheel={(event) => {
                event.preventDefault();
                zoomBy(event.deltaY < 0 ? 0.15 : -0.15);
            }} onTouchStart={(event) => {
                const distance = getTouchDistance(touchListToPoints(event.touches));
                if (distance === null)
                    return;
                pinchStartDistanceRef.current = distance;
                pinchStartZoomRef.current = zoom;
                setIsPinching(true);
            }} onTouchMove={(event) => {
                const current = getTouchDistance(touchListToPoints(event.touches));
                const start = pinchStartDistanceRef.current;
                if (!start || current === null)
                    return;
                event.preventDefault();
                setZoom(computePinchZoom({ startDistance: start, currentDistance: current, startZoom: pinchStartZoomRef.current }));
            }} onTouchEnd={() => {
                pinchStartDistanceRef.current = null;
                setIsPinching(false);
            }}>
            <motion.div ref={imageDragRef} tabIndex={0} drag={zoom > 1} dragConstraints={dragConstraints} dragElastic={0} dragMomentum={false} style={{ x, y, scale: zoom }} className={cn("flex items-center justify-center outline-none", zoom > 1 ? "cursor-grab active:cursor-grabbing" : "")} onPointerDown={(event) => {
                event.stopPropagation();
                imageDragRef.current?.focus({ preventScroll: true });
            }}>
              <Image src={item!.attachment.url} alt={item!.attachment.fileName} width={2048} height={2048} unoptimized className="max-h-[86vh] w-auto max-w-[92vw] object-contain select-none" priority draggable={false}/>
            </motion.div>
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-zinc-300/65 bg-white/85 px-2 py-1 text-[10px] font-bold tracking-wider text-zinc-800 dark:border-white/15 dark:bg-black/60 dark:text-white">
              {Math.round(viewerState.zoom * 100)}%
            </div>
          </div>) : kind === "voice_note" ? (<div onPointerDown={(event) => event.stopPropagation()}>
            <VoiceNoteLightboxPlayer src={item!.attachment.url} voiceNoteMetadata={getVoiceNoteAttachmentMetadata(item!.attachment)} onRequestOpenExternalLink={onRequestOpenExternalLink}/>
          </div>) : kind === "audio" ? (<div className="w-full max-w-2xl rounded-3xl border border-zinc-300/60 bg-white/90 p-8 shadow-[0_28px_90px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-black/90 dark:shadow-[0_30px_95px_rgba(0,0,0,0.58)]" onPointerDown={(event) => event.stopPropagation()}>
            <AudioPlayer src={item!.attachment.url} isOutgoing={false} voiceNoteMetadata={null} onRequestOpenExternalLink={onRequestOpenExternalLink}/>
          </div>) : (kind === "file" && isPdfAttachment(item!.attachment)) ? (<div className="w-full max-w-6xl overflow-hidden rounded-3xl border border-zinc-300/60 bg-white/90 p-4 shadow-[0_28px_90px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-black/90 dark:shadow-[0_30px_95px_rgba(0,0,0,0.58)]" onPointerDown={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
              <FileText className="h-4 w-4"/>
              <span>{item!.attachment.fileName}</span>
            </div>
            <iframe src={item!.attachment.url} title={`PDF preview: ${item!.attachment.fileName}`} className="h-[78vh] w-full rounded-2xl border border-zinc-300/60 bg-white dark:border-white/10 dark:bg-zinc-950"/>
          </div>) : (<div className="w-full max-w-6xl overflow-hidden rounded-3xl border border-zinc-300/60 bg-white/90 shadow-[0_28px_90px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-black/90 dark:shadow-[0_30px_95px_rgba(0,0,0,0.58)]" onPointerDown={(event) => event.stopPropagation()}>
            <VideoPlayer src={item!.attachment.url} isOutgoing={false} className="max-h-[90vh]" onRequestOpenExternalLink={onRequestOpenExternalLink}/>
          </div>)}
        </div>

        {hasPrev && onPrev ? (<button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={onPrev} className="media-viewer-nav media-viewer-nav-left hidden md:inline-flex" aria-label={t("messaging.preview.previousItem")}>
            <ChevronLeft className="h-5 w-5"/>
          </button>) : null}

        {hasNext && onNext ? (<button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={onNext} className="media-viewer-nav media-viewer-nav-right hidden md:inline-flex" aria-label={t("messaging.preview.nextItem")}>
            <ChevronRight className="h-5 w-5"/>
          </button>) : null}

        {hasSequence ? (<div className="absolute bottom-5 left-1/2 z-[120] flex w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2 items-center gap-2 rounded-[28px] border border-zinc-300/70 bg-white/92 p-2 shadow-2xl dark:border-white/15 dark:bg-black/75" onPointerDown={(event) => event.stopPropagation()}>
            <button type="button" className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-[20px] border border-zinc-300/70 bg-zinc-100/90 px-4 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-200/90 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15" onClick={onPrev} disabled={!hasPrev || !onPrev}>
              <ChevronLeft className="h-4 w-4 shrink-0"/>
              <span className="truncate">{t("common.previous")}</span>
            </button>
            <div className="min-w-[4.75rem] rounded-[20px] border border-zinc-300/70 bg-white/95 px-3 py-3 text-center text-[11px] font-black tracking-[0.24em] text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
              {previewPositionLabel}
            </div>
            <button type="button" className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-[20px] border border-zinc-300/70 bg-zinc-100/90 px-4 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-200/90 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15" onClick={onNext} disabled={!hasNext || !onNext}>
              <span className="truncate">{t("common.next")}</span>
              <ChevronRight className="h-4 w-4 shrink-0"/>
            </button>
          </div>) : null}
      </motion.div>
    </AnimatePresence>);
}
