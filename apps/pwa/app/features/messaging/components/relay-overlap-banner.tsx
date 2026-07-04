"use client";
/**
 * relay-overlap-banner.tsx
 *
 * Phase 1 + 2 UX improvement: passive conversation-level warning when the
 * local user and a contact have no known relay in common.
 *
 * - "no_overlap" → amber warning with a suggested relay to add and a Settings
 *   deep-link.
 * - "unknown" → subtle grey hint telling the user that relay compatibility
 *   has not yet been assessed (shown only once per session via dismissal).
 * - "overlap" → renders nothing.
 *
 * This banner is purely informational — it never mutates relay configuration.
 */
import React, { useState } from "react";
import { AlertTriangle, HelpCircle, PlusCircle, X, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/app/lib/utils";
import type { ContactRelayOverlapResult } from "../hooks/use-contact-relay-overlap";
interface RelayOverlapBannerProps {
    overlap: ContactRelayOverlapResult;
    contactDisplayName: string;
    onAddRelay?: (url: string) => void;
    onNavigateToRelaySettings?: () => void;
}
export function RelayOverlapBanner({ overlap, contactDisplayName, onAddRelay, onNavigateToRelaySettings, }: RelayOverlapBannerProps) {
    const { t } = useTranslation();
    const [dismissed, setDismissed] = useState(false);
    if (dismissed || overlap.status === "overlap")
        return null;
    if (overlap.status === "unknown") {
        return (<div className="mx-4 mt-2 mb-0 flex items-center gap-2 rounded-xl border border-zinc-500/15 bg-zinc-500/5 px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
        <HelpCircle className="h-3.5 w-3.5 shrink-0 opacity-60"/>
        <span>
          {t("messaging.relayOverlap.unknownHint", { name: contactDisplayName })}
        </span>
        <button type="button" onClick={() => setDismissed(true)} className="ml-auto shrink-0 rounded p-0.5 opacity-50 hover:opacity-100 transition-opacity" aria-label={t("common.dismiss")}>
          <X className="h-3 w-3"/>
        </button>
      </div>);
    }
    const hostname = (url: string): string => {
        try {
            return new URL(url).hostname;
        }
        catch {
            return url;
        }
    };
    return (<div className={cn("mx-4 mt-2 mb-0 rounded-xl border px-3 py-2.5", "border-amber-500/25 bg-amber-500/8 dark:bg-amber-900/15")}>
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"/>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 leading-snug">
            {t("messaging.relayOverlap.noOverlapTitle")}
          </p>
          <p className="mt-0.5 text-xs text-amber-700/80 dark:text-amber-300/70 leading-snug">
            {t("messaging.relayOverlap.noOverlapDesc", { name: contactDisplayName })}
          </p>
          {overlap.suggestedRelay && (<p className="mt-1.5 text-xs text-amber-700/70 dark:text-amber-300/60">
              {t("messaging.relayOverlap.suggested")}{" "}
              <span className="font-mono font-semibold">{hostname(overlap.suggestedRelay)}</span>
            </p>)}
        </div>
        <div className="flex shrink-0 items-center gap-1 ml-1">
          {overlap.suggestedRelay && onAddRelay && (<button type="button" onClick={() => onAddRelay(overlap.suggestedRelay!)} className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/15 px-2 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 transition-colors">
              <PlusCircle className="h-3 w-3"/>
              {t("messaging.relayOverlap.addRelay", { hostname: hostname(overlap.suggestedRelay) })}
            </button>)}
          {!overlap.suggestedRelay && onNavigateToRelaySettings && (<button type="button" onClick={onNavigateToRelaySettings} className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-colors">
              {t("messaging.relayOverlap.settingsLink")}
              <ExternalLink className="h-2.5 w-2.5"/>
            </button>)}
          <button type="button" onClick={() => setDismissed(true)} className="rounded p-0.5 text-amber-600/50 hover:text-amber-600 dark:text-amber-400/50 dark:hover:text-amber-400 transition-colors" aria-label={t("common.dismiss")}>
            <X className="h-3.5 w-3.5"/>
          </button>
        </div>
      </div>
    </div>);
}
