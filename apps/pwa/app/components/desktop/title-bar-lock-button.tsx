"use client";

import type React from "react";
import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppLockConfirmDialog } from "@/app/features/auth/components/app-lock-confirm-dialog";
import { useAppLockConfirm } from "@/app/features/auth/hooks/use-app-lock-confirm";
import { cn } from "@/app/lib/utils";

type TitleBarLockButtonProps = Readonly<{
  className?: string;
}>;

export function TitleBarLockButton({ className }: TitleBarLockButtonProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const {
    canLock,
    isLockConfirmOpen,
    openLockConfirm,
    closeLockConfirm,
    confirmLock,
  } = useAppLockConfirm();

  if (!canLock) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={openLockConfirm}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white/80 text-zinc-700 transition hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10",
          className,
        )}
        aria-label={t("desktop.titleBar.lock")}
        title={t("desktop.titleBar.lockHint")}
      >
        <Lock className="h-4 w-4" aria-hidden />
      </button>
      <AppLockConfirmDialog
        isOpen={isLockConfirmOpen}
        onClose={closeLockConfirm}
        onConfirm={() => {
          void confirmLock();
        }}
      />
    </>
  );
}
