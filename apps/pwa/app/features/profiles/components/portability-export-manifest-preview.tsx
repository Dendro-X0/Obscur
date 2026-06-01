"use client";

import type React from "react";
import { Loader2 } from "lucide-react";
import type { PortabilityExportManifest } from "@/app/features/profiles/services/portability-export-manifest";

type Props = Readonly<{
  manifest: PortabilityExportManifest | null;
  isLoading?: boolean;
  title?: string;
}>;

export function PortabilityExportManifestPreview(props: Props): React.JSX.Element {
  const title = props.title ?? "Export preview";

  return (
    <div className="rounded-xl border border-black/5 bg-white/70 px-3 py-3 dark:border-white/10 dark:bg-zinc-950/40">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">{title}</div>
        {props.isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" /> : null}
      </div>
      {props.isLoading ? (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Calculating export contents…</p>
      ) : null}
      {!props.isLoading && props.manifest ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {props.manifest.items.map((item) => (
            <div key={item.label} className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-900/60">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{item.label}</div>
              <div className="mt-0.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">{item.value}</div>
              {item.detail ? (
                <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">{item.detail}</div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {!props.isLoading && !props.manifest ? (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Unlock this account to preview export contents.</p>
      ) : null}
    </div>
  );
}
