"use client";

import type React from "react";
import Link from "next/link";
import { cn } from "@/app/lib/utils";
import type { SettingsTabId } from "@/app/features/settings/services/settings-search-index";

type Props = Readonly<{
  tab: SettingsTabId;
  hash?: string;
  className?: string;
  children: React.ReactNode;
}>;

export function SettingsPortabilityTabLink(props: Props): React.JSX.Element {
  const href = props.hash?.trim()
    ? `/settings?tab=${props.tab}#${props.hash.trim()}`
    : `/settings?tab=${props.tab}`;

  return (
    <Link
      href={href}
      className={cn(
        "font-semibold text-purple-600 underline-offset-2 hover:underline dark:text-purple-300",
        props.className,
      )}
    >
      {props.children}
    </Link>
  );
}
