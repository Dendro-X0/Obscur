"use client";

import type React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/app/lib/utils";
import { getProtocolMigrationHints } from "../migration-hints";
import type { ProtocolId } from "../types";
import { useActiveProtocolCapabilities } from "../use-active-protocol-capabilities";

export type ProtocolMigrationHintsProps = Readonly<{
  className?: string;
  protocolId?: ProtocolId;
  compact?: boolean;
}>;

export function ProtocolMigrationHints(
  props: ProtocolMigrationHintsProps,
): React.JSX.Element {
  const { t } = useTranslation();
  const live = useActiveProtocolCapabilities();
  const protocolId = props.protocolId ?? live.protocolId;
  const hints = getProtocolMigrationHints(protocolId);

  return (
    <div
      data-testid="protocol-migration-hints"
      className={cn("space-y-2", props.className)}
    >
      {hints.map((hint) => (
        <div
          key={hint.id}
          data-testid={`protocol-migration-hint-${hint.id}`}
          className={cn(
            "rounded-lg border border-black/5 bg-black/[0.03] px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]",
            props.compact && "px-2 py-1.5",
          )}
        >
          <div className="text-xs font-bold text-zinc-800 dark:text-zinc-100">
            {t(`protocol.hints.${hint.id}.title`, { defaultValue: hint.title })}
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
            {t(`protocol.hints.${hint.id}.body`, { defaultValue: hint.body })}
          </p>
        </div>
      ))}
    </div>
  );
}
