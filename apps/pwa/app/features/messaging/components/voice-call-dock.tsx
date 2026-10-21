"use client";
import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Maximize2, MessageSquare, Minimize2, PhoneCall, PhoneIncoming, PhoneOff, PhoneOutgoing, Video, X } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { useTranslation } from "react-i18next";
import { UserAvatar } from "@/app/components/user-avatar";
import {
    resolveVoiceCallReasonHonestyKey,
    shouldShowVideoCallPanes,
    type SupportedCallType,
} from "../services/voice-call-reason-honesty";
import {
    CAMERA_UNAVAILABLE_BANNER_DEFAULT,
    CAMERA_UNAVAILABLE_BANNER_I18N_KEY,
    LAB_CANVAS_VIDEO_BANNER_DEFAULT,
    LAB_CANVAS_VIDEO_BANNER_I18N_KEY,
    shouldShowCameraUnavailableBanner,
    shouldShowLabCanvasVideoBanner,
    type CallLocalMediaMode,
} from "../services/realtime-call-local-media";
import { isVoiceCallAvStagePhase } from "../services/realtime-call-presentation";
import {
    clampStageWindowPosition,
    DEFAULT_STAGE_WINDOW_SIZE,
    resolveDefaultStageWindowPosition,
    type StageWindowPoint,
} from "../services/voice-call-stage-window-position";

export type VoiceCallDockStatus = Readonly<{
    roomId: string;
    peerPubkey: string;
    phase: "ringing_outgoing" | "ringing_incoming" | "connecting" | "connected" | "interrupted" | "ended";
    role: "host" | "joiner";
    sinceUnixMs: number;
    reasonCode?: "left_by_user" | "remote_left" | "network_interrupted" | "session_closed";
    /** M1-A negotiated type; omit = voice. */
    callType?: SupportedCallType;
    /** M1-B: local media outcome. */
    mediaMode?: CallLocalMediaMode;
}>;

type VoiceCallDockProps = Readonly<{
    status: VoiceCallDockStatus | null;
    peerDisplayName: string;
    peerAvatarUrl?: string;
    anchorMode?: "chat" | "page";
    audioLevel?: number;
    /** Optional MediaStream for local preview (M1-B); unused panes show placeholder. */
    localVideoStream?: MediaStream | null;
    remoteVideoStream?: MediaStream | null;
    onOpenChat: () => void;
    onAccept?: () => void;
    onDecline?: () => void;
    onEnd: () => void;
    onDismiss: () => void;
    /**
     * Mobile video → fullscreen. Desktop video → floating stage (R5).
     * Voice stays on the compact dock.
     */
    presentation?: "dock" | "fullscreen" | "stage";
}>;

const CALL_DOCK_BOTTOM_OFFSET_PAGE = "max(1.5rem, calc(env(safe-area-inset-bottom) + 1rem))";
const CALL_DOCK_BOTTOM_OFFSET_CONNECTED_CHAT = "max(8rem, calc(env(safe-area-inset-bottom) + 7.5rem))";

const phaseToLabelKey = (phase: VoiceCallDockStatus["phase"]): string => {
    switch (phase) {
        case "ringing_outgoing":
            return "messaging.voiceCallRingingOutgoing";
        case "ringing_incoming":
            return "messaging.voiceCallRingingIncoming";
        case "connecting":
            return "messaging.voiceCallConnecting";
        case "connected":
            return "messaging.voiceCallConnected";
        case "interrupted":
            return "messaging.voiceCallInterrupted";
        case "ended":
            return "messaging.voiceCallEnded";
        default:
            return "messaging.voiceCallActive";
    }
};

type VideoPaneProps = Readonly<{
    label: string;
    placeholderLabel: string;
    stream: MediaStream | null | undefined;
    mirrored?: boolean;
    testId: string;
    frame?: "dock" | "stage" | "pip";
}>;

function VideoCallPane({
    label,
    placeholderLabel,
    stream,
    mirrored = false,
    testId,
    frame = "dock",
}: VideoPaneProps): React.JSX.Element {
    const videoRef = React.useRef<HTMLVideoElement | null>(null);
    const hasLiveTrack = Boolean(
        stream?.getVideoTracks().some((track) => track.readyState === "live"),
    );

    React.useEffect(() => {
        const el = videoRef.current;
        if (!el) {
            return;
        }
        if (hasLiveTrack && stream) {
            el.srcObject = stream;
            return () => {
                el.srcObject = null;
            };
        }
        el.srcObject = null;
        return undefined;
    }, [hasLiveTrack, stream]);

    const frameClass = frame === "stage"
        ? "absolute inset-0 overflow-hidden bg-black"
        : frame === "pip"
            ? "absolute right-4 top-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))] z-10 aspect-[3/4] w-28 overflow-hidden rounded-2xl border border-white/20 bg-zinc-900 shadow-lg"
            : "relative aspect-video overflow-hidden rounded-xl border border-zinc-200 bg-zinc-900 dark:border-zinc-700";
    return (
        <div
            className={frameClass}
            data-testid={testId}
        >
            {hasLiveTrack ? (
                <video
                    ref={videoRef}
                    className={`h-full w-full object-cover ${mirrored ? "scale-x-[-1]" : ""}`}
                    autoPlay
                    playsInline
                    muted={mirrored}
                    aria-label={label}
                />
            ) : (
                <div className={`flex h-full flex-col items-center justify-center gap-2 px-3 text-center text-zinc-400 ${frame === "dock" ? "min-h-[7.5rem]" : "min-h-0"}`}>
                    <Video className="h-6 w-6 opacity-70" aria-hidden="true" />
                    <p className="text-[10px] font-black uppercase tracking-widest">{label}</p>
                    <p className="text-xs font-semibold text-zinc-300">{placeholderLabel}</p>
                </div>
            )}
        </div>
    );
}

export function VoiceCallDock({
    status,
    peerDisplayName,
    peerAvatarUrl = "",
    anchorMode = "page",
    audioLevel,
    localVideoStream = null,
    remoteVideoStream = null,
    onOpenChat,
    onAccept,
    onDecline,
    onEnd,
    onDismiss,
    presentation = "dock",
}: VoiceCallDockProps): React.JSX.Element {
    const { t } = useTranslation();
    const waveBarHeights = React.useMemo(() => [10, 14, 18, 24, 18, 14, 10], []);
    const [clockNowMs, setClockNowMs] = React.useState<number | null>(null);
    const [desktopStageFullscreen, setDesktopStageFullscreen] = React.useState(false);
    const [stagePosition, setStagePosition] = React.useState<StageWindowPoint | null>(null);
    const stageDragRef = React.useRef<Readonly<{
        pointerId: number;
        originX: number;
        originY: number;
        startLeft: number;
        startTop: number;
    }> | null>(null);
    const isActiveCallPhase = status?.phase === "connected"
        || status?.phase === "ringing_outgoing"
        || status?.phase === "ringing_incoming"
        || status?.phase === "connecting";
    React.useEffect(() => {
        if (!isActiveCallPhase || !status) {
            setClockNowMs(null);
            return;
        }
        setClockNowMs(Date.now());
        const intervalId = window.setInterval(() => {
            setClockNowMs(Date.now());
        }, 1000);
        return () => {
            window.clearInterval(intervalId);
        };
    }, [isActiveCallPhase, status?.phase, status?.sinceUnixMs]);
    React.useEffect(() => {
        setDesktopStageFullscreen(false);
        setStagePosition(null);
        stageDragRef.current = null;
    }, [status?.roomId]);
    React.useEffect(() => {
        if (status?.phase === "ended" || status?.phase === "interrupted") {
            setDesktopStageFullscreen(false);
            stageDragRef.current = null;
        }
    }, [status?.phase]);
    React.useEffect(() => {
        if (typeof window === "undefined" || stagePosition !== null || presentation !== "stage") {
            return;
        }
        setStagePosition(resolveDefaultStageWindowPosition({
            viewport: { width: window.innerWidth, height: window.innerHeight },
            size: DEFAULT_STAGE_WINDOW_SIZE,
            anchor: "bottom-right",
        }));
    }, [stagePosition, presentation]);
    const icon = status?.role === "host" ? PhoneOutgoing : PhoneIncoming;
    const Icon = icon;
    const isConnected = status?.phase === "connected";
    const peerEngagedForAv = Boolean(status && isVoiceCallAvStagePhase(status.phase));
    // Outgoing ring must not show AV panes — peer has not accepted yet.
    const showVideoPanes = Boolean(
        status
        && shouldShowVideoCallPanes(status.callType)
        && peerEngagedForAv,
    );
    const showCameraUnavailableBanner = Boolean(
        status
        && peerEngagedForAv
        && shouldShowCameraUnavailableBanner({
            callType: status.callType,
            mediaMode: status.mediaMode,
        }),
    );
    const showLabCanvasBanner = Boolean(
        status
        && peerEngagedForAv
        && shouldShowLabCanvasVideoBanner({ mediaMode: status.mediaMode }),
    );
    const clampedAudioLevel = isConnected && Number.isFinite(audioLevel)
        ? Math.max(0, Math.min(1, audioLevel ?? 0))
        : 0;
    const boostedAudioLevel = clampedAudioLevel >= 0.06
        ? Math.max(clampedAudioLevel, 0.4)
        : clampedAudioLevel;
    const durationLabel = (() => {
        if (!status || !isActiveCallPhase) {
            return null;
        }
        const effectiveNowMs = clockNowMs ?? status.sinceUnixMs;
        const elapsedMs = Math.max(0, effectiveNowMs - status.sinceUnixMs);
        const totalSeconds = Math.floor(elapsedMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    })();
    const showRingPulse = status?.phase === "ringing_outgoing"
        || status?.phase === "ringing_incoming"
        || status?.phase === "connecting";
    const reasonHonestyKey = status
        && (status.phase === "interrupted" || status.phase === "ended")
        ? resolveVoiceCallReasonHonestyKey(status.reasonCode)
        : null;
    const reasonHonestyLabel = reasonHonestyKey ? t(reasonHonestyKey) : null;
    const centerDockBottomOffset = anchorMode === "chat"
        ? CALL_DOCK_BOTTOM_OFFSET_CONNECTED_CHAT
        : CALL_DOCK_BOTTOM_OFFSET_PAGE;
    const dockWidth = showVideoPanes
        ? "min(48rem, calc(100vw - 2rem))"
        : "min(43rem, calc(100vw - 2rem))";
    const dockContainerStyle: React.CSSProperties = {
        position: "fixed",
        bottom: centerDockBottomOffset,
        left: "50%",
        right: "auto",
        transform: "translateX(-50%)",
        width: dockWidth,
        zIndex: 2147483000,
    };
    const placeholderLabel = t("messaging.videoCallPanePlaceholder", "Camera unavailable");
    const useMobileVideoStage = presentation === "fullscreen" && showVideoPanes && Boolean(status);
    const useDesktopVideoStage = presentation === "stage" && showVideoPanes && Boolean(status);
    const onStageDragPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
        if (desktopStageFullscreen || event.button !== 0) {
            return;
        }
        const current = stagePosition ?? resolveDefaultStageWindowPosition({
            viewport: { width: window.innerWidth, height: window.innerHeight },
            size: DEFAULT_STAGE_WINDOW_SIZE,
            anchor: "bottom-right",
        });
        stageDragRef.current = {
            pointerId: event.pointerId,
            originX: event.clientX,
            originY: event.clientY,
            startLeft: current.left,
            startTop: current.top,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
    };
    const onStageDragPointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
        const drag = stageDragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) {
            return;
        }
        const next = clampStageWindowPosition({
            point: {
                left: drag.startLeft + (event.clientX - drag.originX),
                top: drag.startTop + (event.clientY - drag.originY),
            },
            viewport: { width: window.innerWidth, height: window.innerHeight },
            size: DEFAULT_STAGE_WINDOW_SIZE,
        });
        setStagePosition(next);
    };
    const onStageDragPointerUp = (event: React.PointerEvent<HTMLDivElement>): void => {
        const drag = stageDragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) {
            return;
        }
        stageDragRef.current = null;
        try {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        catch {
            // capture may already be released
        }
    };
    const renderVideoStageChrome = (params: Readonly<{
        testId: string;
        shellClassName: string;
        stageStyle: React.CSSProperties;
        bodyClassName: string;
        topPadClassName: string;
        bottomPadClassName: string;
        draggableHeader?: boolean;
        showFullscreenToggle?: boolean;
    }>): React.JSX.Element | null => {
        if (!status) {
            return null;
        }
        return (
            <div className={params.shellClassName} style={params.stageStyle} data-testid={params.testId}>
                <div className={`relative flex min-h-0 flex-col overflow-hidden bg-black text-white ${params.bodyClassName}`}>
                    <div className="relative min-h-0 flex-1">
                        <VideoCallPane
                            label={t("messaging.videoCallPaneRemote", "Peer")}
                            placeholderLabel={placeholderLabel}
                            stream={remoteVideoStream}
                            testId="voice-call-dock-remote-video"
                            frame="stage"
                        />
                        <VideoCallPane
                            label={t("messaging.videoCallPaneLocal", "You")}
                            placeholderLabel={placeholderLabel}
                            stream={localVideoStream}
                            mirrored
                            testId="voice-call-dock-local-video"
                            frame="pip"
                        />
                        <div
                            className={`absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/70 to-transparent px-4 pb-10 ${params.topPadClassName} ${params.draggableHeader ? "cursor-grab active:cursor-grabbing touch-none" : "pointer-events-none"}`}
                            data-testid={params.draggableHeader ? "voice-call-desktop-stage-drag-handle" : undefined}
                            onPointerDown={params.draggableHeader ? onStageDragPointerDown : undefined}
                            onPointerMove={params.draggableHeader ? onStageDragPointerMove : undefined}
                            onPointerUp={params.draggableHeader ? onStageDragPointerUp : undefined}
                            onPointerCancel={params.draggableHeader ? onStageDragPointerUp : undefined}
                        >
                            <div className="pointer-events-none flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[11px] font-black uppercase tracking-widest text-white/70">
                                        {t(phaseToLabelKey(status.phase))}
                                    </p>
                                    <p className="truncate text-lg font-semibold">
                                        {peerDisplayName}
                                        {durationLabel ? ` · ${durationLabel}` : ""}
                                    </p>
                                    {reasonHonestyLabel ? (
                                        <p className="truncate text-xs font-semibold text-rose-200">{reasonHonestyLabel}</p>
                                    ) : null}
                                </div>
                                {params.showFullscreenToggle ? (
                                    <button
                                        type="button"
                                        className="pointer-events-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setDesktopStageFullscreen((current) => !current);
                                        }}
                                        onPointerDown={(event) => event.stopPropagation()}
                                        aria-label={desktopStageFullscreen
                                            ? t("messaging.videoCallExitFullscreen", "Exit full screen")
                                            : t("messaging.videoCallEnterFullscreen", "Full screen")}
                                        data-testid="voice-call-desktop-stage-fullscreen-toggle"
                                    >
                                        {desktopStageFullscreen
                                            ? <Minimize2 className="h-4 w-4" aria-hidden="true" />
                                            : <Maximize2 className="h-4 w-4" aria-hidden="true" />}
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    </div>
                    {showCameraUnavailableBanner ? (
                        <p
                            className="mx-4 mb-2 rounded-full bg-white/10 px-3 py-1.5 text-center text-[11px] font-semibold text-amber-100"
                            data-testid="voice-call-dock-camera-unavailable-banner"
                            role="status"
                        >
                            {t(CAMERA_UNAVAILABLE_BANNER_I18N_KEY, CAMERA_UNAVAILABLE_BANNER_DEFAULT)}
                        </p>
                    ) : null}
                    {showLabCanvasBanner ? (
                        <p
                            className="mx-4 mb-2 rounded-full bg-white/10 px-3 py-1.5 text-center text-[11px] font-semibold text-amber-100"
                            data-testid="voice-call-dock-lab-canvas-banner"
                            role="status"
                        >
                            {t(LAB_CANVAS_VIDEO_BANNER_I18N_KEY, LAB_CANVAS_VIDEO_BANNER_DEFAULT)}
                        </p>
                    ) : null}
                    <div className={`flex items-center justify-center gap-4 px-4 pt-3 ${params.bottomPadClassName}`}>
                        <button
                            type="button"
                            className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white"
                            onClick={onOpenChat}
                            aria-label={t("messaging.openCallChat", "Open Chat")}
                        >
                            <MessageSquare className="h-5 w-5" aria-hidden="true" />
                        </button>
                        {status.phase === "ringing_incoming" ? (
                            <button
                                type="button"
                                className="inline-flex h-14 min-w-14 items-center justify-center rounded-full bg-emerald-500 px-4 text-sm font-semibold text-white"
                                onClick={onAccept}
                            >
                                {t("common.accept")}
                            </button>
                        ) : null}
                        {status.phase !== "ended" ? (
                            <button
                                type="button"
                                className="inline-flex h-14 min-w-14 items-center justify-center rounded-full bg-rose-600 px-4 text-sm font-semibold text-white"
                                onClick={onEnd}
                                aria-label={t("messaging.voiceCallEnd")}
                            >
                                <PhoneOff className="h-5 w-5" aria-hidden="true" />
                            </button>
                        ) : null}
                        {status.phase === "ringing_incoming" ? (
                            <button
                                type="button"
                                className="inline-flex h-14 min-w-14 items-center justify-center rounded-full bg-rose-600/80 px-4 text-sm font-semibold text-white"
                                onClick={onDecline}
                            >
                                {t("common.decline")}
                            </button>
                        ) : null}
                        <button
                            type="button"
                            className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white"
                            onClick={onDismiss}
                            aria-label={t("common.close")}
                        >
                            <X className="h-5 w-5" aria-hidden="true" />
                        </button>
                    </div>
                </div>
            </div>
        );
    };
    if (useMobileVideoStage && status) {
        return renderVideoStageChrome({
            testId: "voice-call-mobile-stage",
            shellClassName: "pointer-events-auto h-full w-full",
            stageStyle: {
                position: "absolute",
                inset: 0,
                zIndex: 2147483000,
            },
            bodyClassName: "h-full",
            topPadClassName: "pt-[max(0.75rem,env(safe-area-inset-top))]",
            bottomPadClassName: "pb-[max(1rem,env(safe-area-inset-bottom))]",
        })!;
    }
    if (useDesktopVideoStage && status) {
        const floatingPoint = stagePosition ?? resolveDefaultStageWindowPosition({
            viewport: typeof window !== "undefined"
                ? { width: window.innerWidth, height: window.innerHeight }
                : { width: 1280, height: 800 },
            size: DEFAULT_STAGE_WINDOW_SIZE,
            anchor: "bottom-right",
        });
        const desktopStageStyle: React.CSSProperties = desktopStageFullscreen
            ? {
                position: "fixed",
                inset: 0,
                width: "100vw",
                height: "100vh",
                zIndex: 2147483000,
            }
            : {
                position: "fixed",
                left: floatingPoint.left,
                top: floatingPoint.top,
                width: "min(36rem, calc(100vw - 2rem))",
                height: "min(28rem, 55vh)",
                zIndex: 2147483000,
            };
        return renderVideoStageChrome({
            testId: desktopStageFullscreen
                ? "voice-call-desktop-stage-fullscreen"
                : "voice-call-desktop-stage",
            shellClassName: desktopStageFullscreen
                ? "pointer-events-auto overflow-hidden border-0 shadow-none"
                : "pointer-events-auto overflow-hidden rounded-2xl border border-white/10 shadow-[0_22px_80px_rgba(2,6,23,0.45)]",
            stageStyle: desktopStageStyle,
            bodyClassName: "h-full",
            topPadClassName: desktopStageFullscreen
                ? "pt-[max(0.75rem,env(safe-area-inset-top))]"
                : "pt-3",
            bottomPadClassName: desktopStageFullscreen
                ? "pb-[max(1rem,env(safe-area-inset-bottom))]"
                : "pb-3",
            draggableHeader: !desktopStageFullscreen,
            showFullscreenToggle: true,
        })!;
    }
    return (<AnimatePresence>
      {status ? (<div className="pointer-events-auto" style={dockContainerStyle}>
          <motion.div initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 14, scale: 0.98 }} transition={{ type: "spring", stiffness: 300, damping: 25 }} className="rounded-2xl border border-black/10 bg-white/90 p-3 shadow-[0_22px_80px_rgba(2,6,23,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/88">
            {showVideoPanes ? (
              <div
                className="mb-3 grid gap-2 sm:grid-cols-2"
                data-testid="voice-call-dock-video-panes"
              >
                <VideoCallPane
                  label={t("messaging.videoCallPaneLocal", "You")}
                  placeholderLabel={placeholderLabel}
                  stream={localVideoStream}
                  mirrored
                  testId="voice-call-dock-local-video"
                />
                <VideoCallPane
                  label={t("messaging.videoCallPaneRemote", "Peer")}
                  placeholderLabel={placeholderLabel}
                  stream={remoteVideoStream}
                  testId="voice-call-dock-remote-video"
                />
              </div>
            ) : null}
            {showCameraUnavailableBanner ? (
              <p
                className="mb-3 rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 dark:text-amber-200"
                data-testid="voice-call-dock-camera-unavailable-banner"
                role="status"
              >
                {t(CAMERA_UNAVAILABLE_BANNER_I18N_KEY, CAMERA_UNAVAILABLE_BANNER_DEFAULT)}
              </p>
            ) : null}
            {showLabCanvasBanner ? (
              <p
                className="mb-3 rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 dark:text-amber-200"
                data-testid="voice-call-dock-lab-canvas-banner"
                role="status"
              >
                {t(LAB_CANVAS_VIDEO_BANNER_I18N_KEY, LAB_CANVAS_VIDEO_BANNER_DEFAULT)}
              </p>
            ) : null}
            {isConnected ? (<div className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_140px_auto]">
                <div className="min-w-0 flex items-center gap-2.5">
                  <div className="relative">
                    <UserAvatar username={peerDisplayName} avatarUrl={peerAvatarUrl} sizePx={36} className="rounded-xl border border-emerald-500/35 bg-emerald-500/15"/>
                    {showRingPulse ? (<span className="pointer-events-none absolute inset-0 rounded-xl border border-emerald-400/40 motion-safe:animate-ping"/>) : null}
                    <span className="absolute -bottom-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/85 text-white shadow-sm dark:text-emerald-50">
                      <Icon className="h-2.5 w-2.5"/>
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                      {t(phaseToLabelKey(status.phase))}
                    </p>
                    <p className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {peerDisplayName}
                      {durationLabel ? ` · ${durationLabel}` : ""}
                    </p>
                    {reasonHonestyLabel ? (
                      <p className="truncate text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                        {reasonHonestyLabel}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div aria-hidden="true" className="hidden items-end justify-center gap-1 sm:flex">
                  {waveBarHeights.map((barHeight, barIndex) => (<motion.span key={barIndex} initial={false} animate={{
                        opacity: (() => {
                            const center = (waveBarHeights.length - 1) / 2;
                            const distance = Math.abs(barIndex - center) / Math.max(1, center);
                            const weight = 1 - (distance * 0.55);
                            return Math.min(1, 0.24 + (boostedAudioLevel * 0.86 * weight));
                        })(),
                        scaleY: (() => {
                            const center = (waveBarHeights.length - 1) / 2;
                            const distance = Math.abs(barIndex - center) / Math.max(1, center);
                            const weight = 1 - (distance * 0.55);
                            return Math.max(0.35, 0.35 + (boostedAudioLevel * 1.25 * weight));
                        })(),
                    }} transition={{
                        duration: 0.12,
                        ease: "easeOut",
                    }} className="block w-1.5 rounded-full bg-emerald-500/75 dark:bg-emerald-300/75" style={{ height: `${barHeight}px`, transformOrigin: "center bottom" }}/>))}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button type="button" variant="secondary" className="h-8 rounded-lg px-2.5 text-[11px] font-bold" onClick={onOpenChat}>
                    <PhoneCall className="mr-1 h-3.5 w-3.5"/>
                    {t("messaging.openCallChat")}
                  </Button>
                  <Button type="button" variant="secondary" className="h-8 rounded-lg border-rose-500/35 bg-rose-500/15 px-2.5 text-[11px] font-bold text-rose-700 dark:text-rose-300" onClick={onEnd}>
                    <PhoneOff className="mr-1 h-3.5 w-3.5"/>
                    {t("messaging.voiceCallEnd")}
                  </Button>
                  <Button type="button" variant="ghost" className="h-8 rounded-lg px-2" onClick={onDismiss} aria-label={t("common.close")}>
                    <X className="h-4 w-4"/>
                  </Button>
                </div>
              </div>) : (<div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-center gap-2.5">
                  <div className="relative">
                    <UserAvatar username={peerDisplayName} avatarUrl={peerAvatarUrl} sizePx={36} className="rounded-xl border border-emerald-500/35 bg-emerald-500/15"/>
                    {showRingPulse ? (<span className="pointer-events-none absolute inset-0 rounded-xl border border-emerald-400/40 motion-safe:animate-ping"/>) : null}
                    <span className="absolute -bottom-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/85 text-white shadow-sm dark:text-emerald-50">
                      <Icon className="h-2.5 w-2.5"/>
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                      {t(phaseToLabelKey(status.phase))}
                    </p>
                    <p className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {peerDisplayName}
                      {durationLabel ? ` · ${durationLabel}` : ""}
                    </p>
                    {reasonHonestyLabel ? (
                      <p className="truncate text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                        {reasonHonestyLabel}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="secondary" className="h-8 rounded-lg px-2.5 text-[11px] font-bold" onClick={onOpenChat}>
                    <PhoneCall className="mr-1 h-3.5 w-3.5"/>
                    {t("messaging.openCallChat")}
                  </Button>
                  {status.phase === "ringing_incoming" ? (<>
                      <Button type="button" variant="secondary" className="h-8 rounded-lg border-emerald-500/35 bg-emerald-500/15 px-2.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-200" onClick={onAccept}>
                        {t("common.accept")}
                      </Button>
                      <Button type="button" variant="secondary" className="h-8 rounded-lg border-rose-500/35 bg-rose-500/15 px-2.5 text-[11px] font-bold text-rose-700 dark:text-rose-300" onClick={onDecline}>
                        {t("common.decline")}
                      </Button>
                    </>) : null}
                  {status.phase !== "ended" ? (<Button type="button" variant="secondary" className="h-8 rounded-lg border-rose-500/35 bg-rose-500/15 px-2.5 text-[11px] font-bold text-rose-700 dark:text-rose-300" onClick={onEnd}>
                      <PhoneOff className="mr-1 h-3.5 w-3.5"/>
                      {t("messaging.voiceCallEnd")}
                    </Button>) : null}
                  <Button type="button" variant="ghost" className="h-8 rounded-lg px-2" onClick={onDismiss} aria-label={t("common.close")}>
                    <X className="h-4 w-4"/>
                  </Button>
                </div>
              </div>)}
          </motion.div>
        </div>) : null}
    </AnimatePresence>);
}
