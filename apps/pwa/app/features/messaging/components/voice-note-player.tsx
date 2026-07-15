"use client";

import React from "react";
import { cn } from "@dweb/ui-kit";
import type { VoiceNoteAttachmentMetadata } from "@/app/features/messaging/services/voice-note-metadata";
import { useVoiceNotePlayback } from "@/app/features/messaging/hooks/use-voice-note-playback";
import { VoiceNotePlayerBody } from "./voice-note-player-body";

export type VoiceNotePlayerProps = Readonly<{
  src: string;
  isOutgoing: boolean;
  voiceNoteMetadata?: VoiceNoteAttachmentMetadata | null;
  className?: string;
  onRequestOpenExternalLink?: (url: string) => void | Promise<void>;
}>;

export function VoiceNotePlayer({
  src,
  isOutgoing,
  voiceNoteMetadata = null,
  className,
}: VoiceNotePlayerProps) {
  const playback = useVoiceNotePlayback({ src, voiceNoteMetadata });

  return (
    <div
      className={cn(
        "flex min-w-[220px] max-w-[min(100%,340px)] items-center gap-2.5 rounded-2xl px-1 py-1",
        isOutgoing
          ? "text-white"
          : "text-zinc-900 dark:text-zinc-100",
        className,
      )}
    >
      <audio ref={playback.audioRef} {...playback.audioProps} />
      <VoiceNotePlayerBody playback={playback} isOutgoing={isOutgoing} />
    </div>
  );
}

/** @deprecated Use VoiceNotePlayer */
export const VoiceNoteCard = VoiceNotePlayer;
