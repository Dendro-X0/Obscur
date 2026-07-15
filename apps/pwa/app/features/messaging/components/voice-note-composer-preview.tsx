"use client";

import React from "react";
import { cn } from "@dweb/ui-kit";
import { getVoiceNoteAttachmentMetadata } from "@/app/features/messaging/services/voice-note-metadata";
import { useVoiceNotePlayback } from "@/app/features/messaging/hooks/use-voice-note-playback";
import { VoiceNotePlayerBody } from "./voice-note-player-body";

export function VoiceNoteComposerPreview(props: Readonly<{
  file: File;
  previewUrl: string;
  className?: string;
}>): React.JSX.Element {
  const voiceNoteMetadata = React.useMemo(() => getVoiceNoteAttachmentMetadata({
    kind: "audio",
    fileName: props.file.name,
    contentType: props.file.type,
  }), [props.file.name, props.file.type]);

  const playback = useVoiceNotePlayback({
    src: props.previewUrl,
    voiceNoteMetadata,
  });

  return (
    <div className={cn("flex h-full w-full min-w-0 flex-col justify-end overflow-hidden p-2", props.className)}>
      <audio ref={playback.audioRef} {...playback.audioProps} />
      <div className="flex min-w-0 w-full items-center gap-1 overflow-hidden rounded-xl bg-black/20 p-1.5 backdrop-blur-sm">
        <VoiceNotePlayerBody
          playback={playback}
          isOutgoing
          playButtonClassName="h-8 w-8"
          waveformClassName="min-w-0 flex-1 h-6"
          timeClassName="text-[10px] min-w-[1.75rem] shrink-0 text-white/90"
        />
      </div>
    </div>
  );
}
