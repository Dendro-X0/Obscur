"use client";

import type React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/app/lib/utils";
import type { ProtocolCapabilities, ProtocolId } from "../types";
import { useActiveProtocolCapabilities } from "../use-active-protocol-capabilities";

const CAPABILITY_KEYS = ["dms", "groups", "reactions", "media"] as const;

export type ProtocolCapabilityChipsProps = Readonly<{
  className?: string;
  /** Override snapshot (tests); defaults to live hook. */
  snapshot?: Readonly<{
    protocolId: ProtocolId;
    capabilities: ProtocolCapabilities;
  }>;
}>;

export function ProtocolCapabilityChips(
  props: ProtocolCapabilityChipsProps,
): React.JSX.Element {
  const { t } = useTranslation();
  const live = useActiveProtocolCapabilities();
  const protocolId = props.snapshot?.protocolId ?? live.protocolId;
  const capabilities = props.snapshot?.capabilities ?? live.capabilities;

  return (
    <div
      data-testid="protocol-capability-chips"
      className={cn("flex flex-wrap items-center gap-1.5", props.className)}
    >
      <span
        data-testid="protocol-capability-protocol"
        className="rounded-md border border-black/10 bg-black/5 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200"
      >
        {protocolId === "matrix"
          ? t("protocol.chips.matrix", { defaultValue: "Matrix" })
          : t("protocol.chips.nostr", { defaultValue: "Nostr" })}
      </span>
      {CAPABILITY_KEYS.map((key) => {
        const on = capabilities[key];
        return (
          <span
            key={key}
            data-testid={`protocol-capability-${key}`}
            data-capability-on={on ? "1" : "0"}
            className={cn(
              "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              on
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : "bg-zinc-500/10 text-zinc-400 line-through",
            )}
          >
            {t(`protocol.chips.${key}`, {
              defaultValue: key,
            })}
          </span>
        );
      })}
    </div>
  );
}
