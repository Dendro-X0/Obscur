"use client";

import type React from "react";
import { AlertTriangle, Info, Loader2 } from "lucide-react";
import { Button } from "@dweb/ui-kit";
import type { PortabilityImportPreflight } from "@/app/features/profiles/services/portability-import-preflight";

type Props = Readonly<{
  preflight: PortabilityImportPreflight | null;
  isApplying?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}>;

const accountMatchLabel = (match: PortabilityImportPreflight["accountMatch"]): string => {
  if (match === "match") {
    return "Matches active account";
  }
  if (match === "mismatch") {
    return "Different account";
  }
  return "Unknown";
};

export function PortabilityImportPreflightContent(props: Props): React.JSX.Element {
  const { preflight } = props;
  const isDanger = preflight?.accountMatch === "mismatch";

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        {isDanger ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" /> : <Info className="mt-0.5 h-5 w-5 shrink-0 text-violet-400" />}
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {preflight?.kind === "workspace_bundle" ? "Import encrypted workspace?" : "Import portable account bundle?"}
          </div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Review import details before continuing.
          </p>
        </div>
      </div>

      {preflight ? (
        <>
          <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-900/60">
            <div className="font-semibold text-zinc-900 dark:text-zinc-100">{preflight.fileName}</div>
            <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Exported {preflight.bundleAgeLabel} · {accountMatchLabel(preflight.accountMatch)}
            </div>
          </div>
          {preflight.scopeItems.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {preflight.scopeItems.map((item) => (
                <div key={item.label} className="rounded-lg border border-black/5 px-3 py-2 dark:border-white/10">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{item.label}</div>
                  <div className="mt-0.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">{item.value}</div>
                </div>
              ))}
            </div>
          ) : null}
          {preflight.warnings.length > 0 ? (
            <ul className="space-y-1 text-xs text-amber-700 dark:text-amber-300">
              {preflight.warnings.map((warning) => (
                <li key={warning}>• {warning}</li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">Review import details before continuing.</p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={props.onClose} disabled={props.isApplying}>
          Cancel
        </Button>
        <Button
          type="button"
          variant={isDanger ? "danger" : "primary"}
          disabled={(!preflight?.canProceed && !preflight?.canStageForSignIn) || props.isApplying}
          onClick={props.onConfirm}
        >
          {props.isApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {props.isApplying
            ? "Importing..."
            : preflight?.canProceed
              ? "Import"
              : preflight?.canStageForSignIn
                ? "Save and sign in"
                : "Import"}
        </Button>
      </div>
    </div>
  );
}
