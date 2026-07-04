"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  readShowProfilePickerOnStartup,
  writeShowProfilePickerOnStartup,
} from "@/app/features/profiles/services/profile-picker-startup-policy";

export function ProfilePickerShowOnStartupFooter(): React.JSX.Element {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(readShowProfilePickerOnStartup());
  }, []);

  return (
    <footer className="flex items-center justify-end px-4 py-6">
      <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-zinc-400 accent-violet-600"
          checked={enabled}
          onChange={(event) => {
            const next = event.target.checked;
            setEnabled(next);
            writeShowProfilePickerOnStartup(next);
          }}
        />
        {t("profiles.picker.showOnStartup")}
      </label>
    </footer>
  );
}
