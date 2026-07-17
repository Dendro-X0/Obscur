"use client";

import React from "react";
import { Play } from "lucide-react";
import {
  buildVideoPosterSeekUrl,
  isLesPreviewPendingUrl,
} from "@/app/features/les/sdk/les-vault-media-adapter";
import { cn } from "@/app/lib/utils";

type VideoPosterTileProps = Readonly<{
  src: string;
  fileName?: string;
  className?: string;
}>;

/**
 * Gallery / grid video tile: show the first decoded frame when possible.
 * Uses media fragment seek (no canvas) so CDN CORS does not blank the poster.
 */
export function VideoPosterTile({ src, fileName, className }: VideoPosterTileProps): React.JSX.Element {
  const [failed, setFailed] = React.useState(false);
  const seekUrl = buildVideoPosterSeekUrl(src);

  React.useEffect(() => {
    setFailed(false);
  }, [src]);

  if (isLesPreviewPendingUrl(src)) {
    return (
      <div
        className={cn(
          "relative flex h-full w-full flex-col items-center justify-center bg-zinc-900 text-white animate-pulse",
          className,
        )}
      >
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-md">
          <Play className="ml-0.5 h-5 w-5 fill-current" />
        </div>
        <div className="text-[10px] font-black uppercase tracking-widest opacity-40">Loading</div>
      </div>
    );
  }

  if (failed || !seekUrl) {
    return (
      <div
        className={cn(
          "relative flex h-full w-full flex-col items-center justify-center bg-zinc-900 text-white",
          className,
        )}
      >
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-md">
          <Play className="ml-0.5 h-5 w-5 fill-current" />
        </div>
        <div className="text-[10px] font-black uppercase tracking-widest opacity-40">Video</div>
      </div>
    );
  }

  return (
    <div className={cn("relative h-full w-full bg-zinc-950", className)}>
      <video
        key={seekUrl}
        src={seekUrl}
        className="h-full w-full object-cover"
        preload="metadata"
        muted
        playsInline
        aria-label={fileName ? `Video preview: ${fileName}` : "Video preview"}
        onError={() => setFailed(true)}
      />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/45 backdrop-blur-md">
          <Play className="ml-0.5 h-5 w-5 fill-current text-white" />
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-white/90">
        Video
      </div>
    </div>
  );
}
