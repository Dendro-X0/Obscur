"use client";

import { useCallback, useMemo, useState } from "react";
import { useAppLockAction } from "@/app/features/auth/hooks/use-app-lock-action";

export function useAppLockConfirm(): Readonly<{
  canLock: boolean;
  isLockConfirmOpen: boolean;
  openLockConfirm: () => void;
  closeLockConfirm: () => void;
  confirmLock: () => Promise<void>;
}> {
  const { lockApp, canLock } = useAppLockAction();
  const [isLockConfirmOpen, setIsLockConfirmOpen] = useState(false);

  const openLockConfirm = useCallback((): void => {
    if (!canLock) {
      return;
    }
    setIsLockConfirmOpen(true);
  }, [canLock]);

  const closeLockConfirm = useCallback((): void => {
    setIsLockConfirmOpen(false);
  }, []);

  const confirmLock = useCallback(async (): Promise<void> => {
    await lockApp();
    setIsLockConfirmOpen(false);
  }, [lockApp]);

  return useMemo(() => ({
    canLock,
    isLockConfirmOpen,
    openLockConfirm,
    closeLockConfirm,
    confirmLock,
  }), [canLock, closeLockConfirm, confirmLock, isLockConfirmOpen, openLockConfirm]);
}
