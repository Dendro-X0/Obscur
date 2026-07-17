"use client";

import React from "react";
import { HardDrive, Loader2 } from "lucide-react";
import { Progress } from "@dweb/ui-kit";
import { useTranslation } from "react-i18next";
import { cn } from "@/app/lib/utils";

type SaveToVaultControlProps = Readonly<{
  isSaving: boolean;
  isSaved: boolean;
  onSave: (event: React.MouseEvent) => void;
  className?: string;
}>;

/**
 * Save-to-Vault control with a visible progress bar while commit is in flight.
 * LES does not stream byte progress yet — bar advances deterministically while busy.
 */
export function SaveToVaultControl({
  isSaving,
  isSaved,
  onSave,
  className,
}: SaveToVaultControlProps): React.JSX.Element {
  const { t } = useTranslation();
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    if (!isSaving) {
      setProgress(isSaved ? 100 : 0);
      return;
    }
    setProgress(12);
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      // Ease toward 90% while awaiting LES commit proof; snap to 100 on success.
      const next = Math.min(90, 12 + Math.floor(elapsed / 80));
      setProgress(next);
    }, 80);
    return () => window.clearInterval(timer);
  }, [isSaving, isSaved]);

  const label = isSaved
    ? t("vault.alreadyInVault")
    : isSaving
      ? t("vault.saveFromChatSaving")
      : t("vault.saveFromChat");

  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <button
        type="button"
        className="media-viewer-control media-viewer-control-labeled"
        onClick={onSave}
        disabled={isSaving || isSaved}
        aria-busy={isSaving}
        aria-label={label}
        title={label}
      >
        {isSaving ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        ) : (
          <HardDrive className="h-4 w-4 shrink-0" />
        )}
        <span className="hidden text-xs font-semibold sm:inline">{label}</span>
      </button>
      {isSaving ? (
        <div
          className="w-[min(12rem,40vw)] px-1"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-label={t("vault.saveFromChatSaving")}
          data-testid="save-to-vault-progress"
        >
          <Progress value={progress} size="small" variant="default" className="opacity-95" />
        </div>
      ) : null}
    </div>
  );
}
