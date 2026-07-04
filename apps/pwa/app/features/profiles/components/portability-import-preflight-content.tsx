"use client";

import type React from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Info, Loader2 } from "lucide-react";
import { Button } from "@dweb/ui-kit";
import type { PortabilityImportPreflight } from "@/app/features/profiles/services/portability-import-preflight";

type Props = Readonly<{
  preflight: PortabilityImportPreflight | null;
  isApplying?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}>;

export function PortabilityImportPreflightContent(props: Props): React.JSX.Element {
  const { t } = useTranslation();
  const { preflight } = props;
  const isDanger = preflight?.accountMatch === "mismatch";

  const accountMatchLabel = (match: PortabilityImportPreflight["accountMatch"]): string => {
    if (match === "match") {
      return t("profiles.portability.preflight.matchActive");
    }
    if (match === "mismatch") {
      return t("profiles.portability.preflight.differentAccount");
    }
    return t("profiles.portability.preflight.unknown");
  };

  const renderScopeLabel = (label: string): string => (
    label.startsWith("profiles.") ? t(label) : label
  );

  const renderScopeValue = (
    label: string,
    value: string,
    valueParams?: Readonly<Record<string, string>>,
  ): string => {
    if (label === "profiles.portability.preflight.localDeviceStatus" && value.startsWith("profiles.")) {
      return t(value, valueParams);
    }
    return value;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        {isDanger ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" /> : <Info className="mt-0.5 h-5 w-5 shrink-0 text-violet-400" />}
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {preflight?.kind === "workspace_bundle"
              ? t("profiles.portability.preflight.importWorkspace")
              : t("profiles.portability.preflight.importPortable")}
          </div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            {t("profiles.portability.preflight.reviewDetails")}
          </p>
        </div>
      </div>

      {preflight ? (
        <>
          <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-900/60">
            <div className="font-semibold text-zinc-900 dark:text-zinc-100">{preflight.fileName}</div>
            <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              {t("profiles.portability.preflight.exported", {
                age: preflight.bundleAgeLabel,
                match: accountMatchLabel(preflight.accountMatch),
              })}
            </div>
          </div>
          {preflight.scopeItems.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {preflight.scopeItems.map((item) => (
                <div key={item.label} className="rounded-lg border border-black/5 px-3 py-2 dark:border-white/10">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    {renderScopeLabel(item.label)}
                  </div>
                  <div className="mt-0.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    {renderScopeValue(item.label, item.value, item.valueParams)}
                  </div>
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
        <p className="text-sm text-zinc-600 dark:text-zinc-300">{t("profiles.portability.preflight.reviewDetails")}</p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={props.onClose} disabled={props.isApplying}>
          {t("common.cancel")}
        </Button>
        <Button
          type="button"
          variant={isDanger ? "danger" : "primary"}
          disabled={(!preflight?.canProceed && !preflight?.canStageForSignIn) || props.isApplying}
          onClick={props.onConfirm}
        >
          {props.isApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {props.isApplying
            ? t("profiles.portability.preflight.importing")
            : preflight?.canProceed
              ? t("profiles.portability.preflight.import")
              : preflight?.canStageForSignIn
                ? t("profiles.portability.preflight.saveAndSignIn")
                : t("profiles.portability.preflight.import")}
        </Button>
      </div>
    </div>
  );
}
