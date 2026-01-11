"use client";

import type React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/cn";
import { useTheme } from "../lib/use-theme";

type ThemePreference = "system" | "light" | "dark";

type ThemeToggleProps = Readonly<{ className?: string }>;

type ThemeOption = Readonly<{
  value: ThemePreference;
  label: string;
  icon: (props: Readonly<{ className?: string }>) => React.JSX.Element;
}>;

const OPTIONS: ReadonlyArray<ThemeOption> = [
  { value: "system", label: "System", icon: (props) => <Monitor className={props.className} /> },
  { value: "light", label: "Light", icon: (props) => <Sun className={props.className} /> },
  { value: "dark", label: "Dark", icon: (props) => <Moon className={props.className} /> },
];

const ThemeToggle = (props: ThemeToggleProps): React.JSX.Element => {
  const theme = useTheme();
  return (
    <div className={cn("inline-flex flex-wrap gap-2", props.className)}>
      {OPTIONS.map((option: ThemeOption) => {
        const Icon = option.icon;
        const isActive: boolean = theme.preference === option.value;
        return (
          <Button
            key={option.value}
            type="button"
            variant="secondary"
            className={cn("toggle-transition px-3", isActive && "border-black/20 bg-zinc-50 dark:border-white/20 dark:bg-zinc-900/40")}
            aria-pressed={isActive}
            onClick={(): void => theme.setPreference(option.value)}
          >
            <Icon className="h-4 w-4" />
            {option.label}
          </Button>
        );
      })}
    </div>
  );
};

export { ThemeToggle };
