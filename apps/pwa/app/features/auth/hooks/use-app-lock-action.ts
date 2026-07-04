"use client";

import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@dweb/ui-kit";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useAuthKernelSurfaceActions } from "@/app/features/auth-kernel/hooks/use-auth-kernel-surface-actions";

export function useAppLockAction(): Readonly<{
  lockApp: () => Promise<void>;
  canLock: boolean;
}> {
  const { t } = useTranslation();
  const identity = useIdentity();
  const authKernel = useAuthKernelSurfaceActions();
  const canLock = identity.state.status === "unlocked";

  const lockApp = useCallback(async (): Promise<void> => {
    if (!canLock) {
      return;
    }
    await authKernel.lockBoundProfileWindow();
    toast.success(t("settings.security.lockedToast"));
  }, [authKernel, canLock, t]);

  return useMemo(() => ({
    lockApp,
    canLock,
  }), [canLock, lockApp]);
}
