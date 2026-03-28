"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PhoneCall, PhoneIncoming, PhoneOff, PhoneOutgoing, X } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { useTranslation } from "react-i18next";
import { UserAvatar } from "@/app/components/user-avatar";

export type VoiceCallDockStatus = Readonly<{
  roomId: string;
  peerPubkey: string;
  phase: "ringing_outgoing" | "ringing_incoming" | "connecting" | "connected" | "interrupted" | "ended";
  role: "host" | "joiner";
  sinceUnixMs: number;
  reasonCode?: "left_by_user" | "remote_left" | "network_interrupted" | "session_closed";
}>;

type VoiceCallDockProps = Readonly<{
  status: VoiceCallDockStatus | null;
  peerDisplayName: string;
  peerAvatarUrl?: string;
  readAudioLevel?: () => number;
  onOpenChat: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
  onEnd: () => void;
  onDismiss: () => void;
}>;

const phaseToLabel = (
  phase: VoiceCallDockStatus["phase"],
  t: (key: string, fallback: string) => string,
): string => {
  switch (phase) {
    case "ringing_outgoing":
      return t("messaging.voiceCallRingingOutgoing", "Calling...");
    case "ringing_incoming":
      return t("messaging.voiceCallRingingIncoming", "Incoming call");
    case "connecting":
      return t("messaging.voiceCallConnecting", "Connecting...");
    case "connected":
      return t("messaging.voiceCallConnected", "In call");
    case "interrupted":
      return t("messaging.voiceCallInterrupted", "Call interrupted");
    case "ended":
      return t("messaging.voiceCallEnded", "Call ended");
    default:
      return t("messaging.voiceCallActive", "Voice call active");
  }
};

export function VoiceCallDock({
  status,
  peerDisplayName,
  peerAvatarUrl = "",
  readAudioLevel,
  onOpenChat,
  onAccept,
  onDecline,
  onEnd,
  onDismiss,
}: VoiceCallDockProps): React.JSX.Element {
  const { t } = useTranslation();
  const waveBarHeights = React.useMemo(() => [10, 14, 18, 24, 18, 14, 10], []);
  const [clockNowMs, setClockNowMs] = React.useState<number | null>(null);
  const [waveAudioLevel, setWaveAudioLevel] = React.useState(0);
  React.useEffect(() => {
    if (status?.phase !== "connected") {
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
  }, [status?.phase]);
  const icon = status?.role === "host" ? PhoneOutgoing : PhoneIncoming;
  const Icon = icon;
  const isConnected = status?.phase === "connected";
  React.useEffect(() => {
    if (!isConnected) {
      setWaveAudioLevel(0);
      return;
    }
    const sample = (): void => {
      const sampledLevel = readAudioLevel ? readAudioLevel() : 0;
      const nextLevel = Number.isFinite(sampledLevel)
        ? Math.max(0, Math.min(1, sampledLevel))
        : 0;
      setWaveAudioLevel((current) => (
        Math.abs(current - nextLevel) < 0.02 ? current : nextLevel
      ));
    };
    sample();
    const intervalId = window.setInterval(sample, 120);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [isConnected, readAudioLevel]);
  const clampedAudioLevel = Math.max(0, Math.min(1, waveAudioLevel));
  const durationLabel = (() => {
    if (!status || status.phase !== "connected") {
      return null;
    }
    const effectiveNowMs = clockNowMs ?? status.sinceUnixMs;
    const elapsedMs = Math.max(0, effectiveNowMs - status.sinceUnixMs);
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  })();

  return (
    <AnimatePresence>
      {status ? (
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 14, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="pointer-events-auto fixed bottom-5 left-1/2 z-[88] w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-black/10 bg-white/90 p-3 shadow-[0_22px_80px_rgba(2,6,23,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/88"
        >
          {isConnected ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-end gap-1 md:flex"
            >
              {waveBarHeights.map((barHeight, barIndex) => (
                <motion.span
                  key={barIndex}
                  initial={false}
                  animate={{
                    opacity: (() => {
                      const center = (waveBarHeights.length - 1) / 2;
                      const distance = Math.abs(barIndex - center) / Math.max(1, center);
                      const weight = 1 - (distance * 0.55);
                      return Math.min(1, 0.24 + (clampedAudioLevel * 0.8 * weight));
                    })(),
                    scaleY: (() => {
                      const center = (waveBarHeights.length - 1) / 2;
                      const distance = Math.abs(barIndex - center) / Math.max(1, center);
                      const weight = 1 - (distance * 0.55);
                      return Math.max(0.35, 0.35 + (clampedAudioLevel * 1.2 * weight));
                    })(),
                  }}
                  transition={{
                    duration: 0.12,
                    ease: "easeOut",
                  }}
                  className="block w-1.5 rounded-full bg-emerald-500/75 dark:bg-emerald-300/75"
                  style={{ height: `${barHeight}px`, transformOrigin: "center bottom" }}
                />
              ))}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex items-center gap-2.5">
              <div className="relative">
                <UserAvatar
                  username={peerDisplayName}
                  avatarUrl={peerAvatarUrl}
                  sizePx={36}
                  className="rounded-xl border border-emerald-500/35 bg-emerald-500/15"
                />
                <span className="absolute -bottom-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/85 text-white shadow-sm dark:text-emerald-50">
                  <Icon className="h-2.5 w-2.5" />
                </span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                  {phaseToLabel(status.phase, t)}
                </p>
                <p className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {peerDisplayName}
                  {durationLabel ? ` | ${durationLabel}` : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                className="h-8 rounded-lg px-2.5 text-[11px] font-bold"
                onClick={onOpenChat}
              >
                <PhoneCall className="mr-1 h-3.5 w-3.5" />
                {t("messaging.openCallChat", "Open Chat")}
              </Button>

              {status.phase === "ringing_incoming" ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-8 rounded-lg border-emerald-500/35 bg-emerald-500/15 px-2.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-200"
                    onClick={onAccept}
                  >
                    {t("common.accept", "Accept")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-8 rounded-lg border-rose-500/35 bg-rose-500/15 px-2.5 text-[11px] font-bold text-rose-700 dark:text-rose-300"
                    onClick={onDecline}
                  >
                    {t("common.decline", "Decline")}
                  </Button>
                </>
              ) : null}

              {status.phase !== "ended" ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="h-8 rounded-lg border-rose-500/35 bg-rose-500/15 px-2.5 text-[11px] font-bold text-rose-700 dark:text-rose-300"
                  onClick={onEnd}
                >
                  <PhoneOff className="mr-1 h-3.5 w-3.5" />
                  {t("messaging.voiceCallEnd", "End")}
                </Button>
              ) : null}

              <Button
                type="button"
                variant="ghost"
                className="h-8 rounded-lg px-2"
                onClick={onDismiss}
                aria-label={t("common.close", "Close")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}



