"use client";

import type React from "react";
import Image from "next/image";
import { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "../lib/cn";
import { extractFirstUrl } from "../lib/extract-first-url";
import { useLinkPreview } from "../lib/use-link-preview";

type MessageLinkPreviewProps = Readonly<{
  content: string;
  isOutgoing: boolean;
}>;

const MessageLinkPreview = (props: MessageLinkPreviewProps): React.JSX.Element | null => {
  const url: string | null = useMemo((): string | null => {
    return extractFirstUrl(props.content);
  }, [props.content]);
  const previewState = useLinkPreview(url).state;
  if (!url) {
    return null;
  }
  if (previewState.status !== "ok") {
    return null;
  }
  const preview = previewState.preview;
  const host: string = (() => {
    try {
      return new URL(preview.url).hostname;
    } catch {
      return preview.siteName ?? "";
    }
  })();
  const title: string = preview.title ?? preview.siteName ?? host;

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "mt-2 block overflow-hidden rounded-lg border",
        props.isOutgoing
          ? "border-white/20 bg-white/10 text-white/90 hover:bg-white/15 dark:border-black/10 dark:bg-black/5 dark:text-zinc-900"
          : "border-black/10 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-950/60 dark:text-zinc-100"
      )}
      aria-label={`Open link preview for ${host}`}
    >
      <div className="flex">
        {preview.imageUrl ? (
          <div className="relative h-20 w-28 flex-none">
            <Image src={preview.imageUrl} alt={title} fill unoptimized className="object-cover" />
          </div>
        ) : null}
        <div className="min-w-0 flex-1 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{title}</div>
              <div className={cn("mt-0.5 truncate text-xs", props.isOutgoing ? "text-white/70 dark:text-zinc-900/70" : "text-zinc-600 dark:text-zinc-400")}> {host} </div>
            </div>
            <ExternalLink className={cn("mt-0.5 h-4 w-4 flex-none", props.isOutgoing ? "text-white/70 dark:text-zinc-900/70" : "text-zinc-500 dark:text-zinc-400")} />
          </div>
        </div>
      </div>
    </a>
  );
};

export { MessageLinkPreview };
