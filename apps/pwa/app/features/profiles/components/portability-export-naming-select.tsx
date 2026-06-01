"use client";

import type React from "react";
import {
  PORTABILITY_EXPORT_NAMING_PRESETS,
  loadPortabilityExportNamingPreset,
  savePortabilityExportNamingPreset,
  type PortabilityExportNamingPreset,
} from "@/app/features/profiles/services/portability-export-naming";

type Props = Readonly<{
  value?: PortabilityExportNamingPreset;
  onChange?: (preset: PortabilityExportNamingPreset) => void;
}>;

export function PortabilityExportNamingSelect(props: Props): React.JSX.Element {
  const value = props.value ?? loadPortabilityExportNamingPreset();

  return (
    <div className="space-y-1">
      <label className="text-xs font-bold uppercase tracking-wider text-zinc-500" htmlFor="portability-export-naming">
        Export filename
      </label>
      <select
        id="portability-export-naming"
        value={value}
        onChange={(event) => {
          const next = event.target.value as PortabilityExportNamingPreset;
          savePortabilityExportNamingPreset(next);
          props.onChange?.(next);
        }}
        className="h-9 w-full rounded-xl border border-black/10 bg-white px-3 text-xs font-medium text-zinc-900 outline-none dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-100"
      >
        {PORTABILITY_EXPORT_NAMING_PRESETS.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.label}
          </option>
        ))}
      </select>
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
        {PORTABILITY_EXPORT_NAMING_PRESETS.find((preset) => preset.id === value)?.description}
      </p>
    </div>
  );
}
