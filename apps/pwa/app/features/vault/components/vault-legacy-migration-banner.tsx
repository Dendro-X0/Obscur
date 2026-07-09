"use client";

import React, { useEffect, useState } from "react";
import { LoaderIcon, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/app/lib/utils";
import {
  countLegacyPlaintextVaultIndexEntries,
  getVaultLegacyMigrationProgress,
  subscribeVaultLegacyMigrationProgress,
  type VaultLegacyMigrationProgress,
} from "../services/vault-legacy-migration";

type VaultLegacyMigrationBannerProps = Readonly<{
  className?: string;
}>;

export function VaultLegacyMigrationBanner({ className }: VaultLegacyMigrationBannerProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const [progress, setProgress] = useState<VaultLegacyMigrationProgress>(() => {
    const snapshot = getVaultLegacyMigrationProgress();
    if (snapshot.status !== "idle") {
      return snapshot;
    }
    const pending = countLegacyPlaintextVaultIndexEntries();
    return pending > 0
      ? { ...snapshot, status: "running", pending }
      : snapshot;
  });

  useEffect(() => subscribeVaultLegacyMigrationProgress(setProgress), []);

  const showBanner = progress.status === "running"
    || (progress.status === "idle" && countLegacyPlaintextVaultIndexEntries() > 0)
    || (progress.status === "failed" && progress.failed > 0);

  if (!showBanner) {
    return null;
  }

  const isRunning = progress.status === "running" || progress.status === "idle";
  const message = isRunning
    ? t("vault.legacyMigrationRunning", {
        count: Math.max(progress.pending, countLegacyPlaintextVaultIndexEntries()),
      })
    : t("vault.legacyMigrationFailed", { count: progress.failed });

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border px-4 py-3 text-left",
        isRunning
          ? "border-primary/20 bg-primary/5 text-primary"
          : "border-amber-500/20 bg-amber-500/5 text-amber-800 dark:text-amber-200",
        className,
      )}
      role="status"
    >
      {isRunning ? (
        <LoaderIcon className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
      ) : (
        <Shield className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <p className="text-xs font-medium leading-relaxed">{message}</p>
    </div>
  );
}
