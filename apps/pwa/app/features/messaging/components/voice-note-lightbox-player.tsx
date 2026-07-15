"use client";

import React from "react";
import { ExternalLink, Volume2 } from "lucide-react";
import { cn } from "@dweb/ui-kit";
import { LinkOpenConfirmDialog, useGuardedExternalLinkOpen } from "@/app/features/security";
import {
  formatVoiceNoteRecordedAtLabel,
  type VoiceNoteAttachmentMetadata,
} from "@/app/features/messaging/services/voice-note-metadata";
import { useVoiceNotePlayback } from "@/app/features/messaging/hooks/use-voice-note-playback";
import { VoiceNotePlayerBody } from "./voice-note-player-body";

export type VoiceNoteLightboxPlayerProps = Readonly<{
  src: string;
  voiceNoteMetadata?: VoiceNoteAttachmentMetadata | null;
  className?: string;
  onRequestOpenExternalLink?: (url: string) => void | Promise<void>;
}>;

export function VoiceNoteLightboxPlayer({
  src,
  voiceNoteMetadata = null,
  className,
  onRequestOpenExternalLink,
}: VoiceNoteLightboxPlayerProps) {
  const playback = useVoiceNotePlayback({ src, voiceNoteMetadata });
  const {
    pendingLinkUrl,
    cancelPendingLink,
    confirmPendingLink,
    requestOpenExternalLinkPreferNative,
  } = useGuardedExternalLinkOpen();

  const recordedAtLabel = (
    voiceNoteMetadata?.isVoiceNote && typeof voiceNoteMetadata.recordedAtUnixMs === "number"
      ? formatVoiceNoteRecordedAtLabel(voiceNoteMetadata.recordedAtUnixMs)
      : null
  );
  const volumePercent = Math.round((playback.isMuted ? 0 : playback.volume) * 100);

  const openExternally = React.useCallback(async (): Promise<void> => {
    const requestOpen = onRequestOpenExternalLink ?? requestOpenExternalLinkPreferNative;
    await requestOpen(src);
  }, [onRequestOpenExternalLink, requestOpenExternalLinkPreferNative, src]);

  return (
    <>
      <div
        className={cn(
          "relative w-full max-w-2xl overflow-hidden rounded-3xl border border-zinc-200/80 bg-zinc-50 p-6 text-zinc-900 shadow-[0_28px_90px_rgba(15,23,42,0.22)]",
          "dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 dark:shadow-[0_30px_95px_rgba(0,0,0,0.58)]",
          className,
        )}
      >
        <div className="pointer-events-none absolute -top-12 -right-12 h-28 w-28 rounded-full bg-purple-500/15 blur-[48px] dark:bg-purple-600/20" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-24 w-24 rounded-full bg-indigo-500/10 blur-[40px] dark:bg-indigo-600/15" />

        <audio ref={playback.audioRef} {...playback.audioProps} />

        <div className="relative mb-5 flex items-center justify-between gap-3">
          <span className="inline-flex items-center rounded-full border border-purple-400/30 bg-purple-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-purple-700 dark:text-purple-300">
            Voice note
          </span>
          <span className="truncate text-right text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
            {recordedAtLabel ?? "Recorded recently"}
          </span>
        </div>

        <div className="relative mb-5 flex items-center gap-4">
          <VoiceNotePlayerBody
            playback={playback}
            isOutgoing={false}
            playButtonClassName="h-12 w-12"
            waveformClassName="min-w-[180px] max-w-none h-10"
            timeClassName="text-sm"
          />
        </div>

        <div className="relative flex items-center justify-between gap-4 border-t border-zinc-200/80 pt-4 dark:border-white/10">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              onClick={playback.toggleMute}
              className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-200/70 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100"
              aria-label={playback.isMuted ? "Unmute voice note" : "Mute voice note"}
            >
              <Volume2 className="h-4 w-4" />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={playback.isMuted ? 0 : playback.volume}
              onChange={(event) => playback.setVolume(Number(event.target.value))}
              className="h-1.5 w-full max-w-[160px] cursor-pointer accent-purple-500"
              aria-label="Voice note volume"
            />
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
              {volumePercent}%
            </span>
          </div>

          <button
            type="button"
            onClick={() => { void openExternally(); }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300/70 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10"
            aria-label="Open voice note externally"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open
          </button>
        </div>
      </div>

      {!onRequestOpenExternalLink ? (
        <LinkOpenConfirmDialog
          url={pendingLinkUrl}
          onClose={cancelPendingLink}
          onConfirm={() => confirmPendingLink()}
        />
      ) : null}
    </>
  );
}
