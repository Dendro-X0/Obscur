"use client";

import React from "react";
import { FileIcon, Film, Headphones, Image as ImageIcon, LoaderIcon } from "lucide-react";
import type { LesObjectMeta } from "../sdk/les-native-sdk";
import { cn } from "@/app/lib/utils";

type LesCatalogGridProps = Readonly<{
  items: ReadonlyArray<LesObjectMeta>;
  isLoading: boolean;
  error: string | null;
}>;

const kindIcon = (kind: string): React.ReactNode => {
  switch (kind) {
    case "image":
      return <ImageIcon className="h-6 w-6 text-primary" />;
    case "video":
      return <Film className="h-6 w-6 text-indigo-500" />;
    case "audio":
      return <Headphones className="h-6 w-6 text-emerald-500" />;
    default:
      return <FileIcon className="h-6 w-6 text-zinc-500" />;
  }
};

/** Catalog-only grid — no message scan / CDN dual truth. */
export function LesCatalogGrid({ items, isLoading, error }: LesCatalogGridProps): React.JSX.Element {
  if (isLoading && items.length === 0) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center text-zinc-500">
        <LoaderIcon className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
        {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-border">
        No LES objects yet. Use Secure Upload to add encrypted local media.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.lesObjectId}
          className={cn(
            "flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-border dark:bg-muted/40",
          )}
          data-testid="les-catalog-tile"
          data-les-object-id={item.lesObjectId}
        >
          <div className="flex h-20 items-center justify-center rounded-xl bg-white dark:bg-card">
            {kindIcon(item.kind)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-zinc-900 dark:text-white" title={item.displayName}>
              {item.displayName}
            </p>
            <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              {item.kind} · local
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
