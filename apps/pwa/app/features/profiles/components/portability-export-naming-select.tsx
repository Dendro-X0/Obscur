"use client";

import type React from "react";
import { SelectField } from "@/app/components/ui/select";
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
    <div className="space-y-1.5">
      <label
        className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
        htmlFor="portability-export-naming"
      >
        Export filename
      </label>
      <SelectField
        id="portability-export-naming"
        value={value}
        onValueChange={(next) => {
          const preset = next as PortabilityExportNamingPreset;
          savePortabilityExportNamingPreset(preset);
          props.onChange?.(preset);
        }}
        aria-label="Export filename format"
        options={PORTABILITY_EXPORT_NAMING_PRESETS.map((preset) => ({
          value: preset.id,
          label: preset.label,
        }))}
      />
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
        {PORTABILITY_EXPORT_NAMING_PRESETS.find((preset) => preset.id === value)?.description}
      </p>
    </div>
  );
}
