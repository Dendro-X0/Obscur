"use client";

import type React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/app/lib/utils";
import { useTheme } from "@/app/features/settings/hooks/use-theme";
import { useTranslation } from "react-i18next";

type ThemePreference = "system" | "light" | "dark";

type ThemeToggleProps = Readonly<{
  className?: string;
  layout?: "inline" | "segmented";
}>;

type ThemeOption = Readonly<{
  value: ThemePreference;
  label: string;
  i18nKey: string;
  icon: (props: Readonly<{ className?: string }>) => React.JSX.Element;
}>;

const OPTIONS: ReadonlyArray<ThemeOption> = [
  { value: "system", label: "System", i18nKey: "settings.appearance.system", icon: (props) => <Monitor className={props.className} /> },
  { value: "light", label: "Light", i18nKey: "settings.appearance.light", icon: (props) => <Sun className={props.className} /> },
  { value: "dark", label: "Dark", i18nKey: "settings.appearance.dark", icon: (props) => <Moon className={props.className} /> },
];

const ThemeToggle = (props: ThemeToggleProps): React.JSX.Element => {
  const { t } = useTranslation();
  const theme = useTheme();
  const segmented = props.layout === "segmented";
  return (
    <div className={cn(
      segmented ? "grid w-full grid-cols-3 gap-1.5" : "inline-flex flex-wrap gap-2",
      props.className,
    )}>
      {OPTIONS.map((option: ThemeOption) => {
        const Icon = option.icon;
        const isActive: boolean = theme.preference === option.value;
        return (
          <Button
            key={option.value}
            type="button"
            variant={isActive ? "primary" : "outline"}
            className={cn(
              "toggle-transition flex items-center justify-center font-bold transition-all",
              segmented
                ? "h-9 gap-1 rounded-lg px-1 text-[11px]"
                : "h-10 rounded-xl px-4 py-2",
              isActive
                ? "shadow-lg shadow-primary/25 !border-none"
                : "bg-zinc-50/50 text-zinc-500 hover:bg-zinc-100 dark:bg-zinc-900/50 dark:text-zinc-400 dark:hover:bg-zinc-800",
              !segmented && isActive && "scale-105",
            )}
            aria-pressed={isActive}
            onClick={(): void => theme.setPreference(option.value)}
          >
            <Icon className={segmented ? "h-3.5 w-3.5" : "h-4 w-4"} />
            {t(option.i18nKey)}
          </Button>
        );
      })}
    </div>
  );
};

export { ThemeToggle };
