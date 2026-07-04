"use client";

import type React from "react";
import { ConfirmDialog } from "@dweb/ui-kit";
import { useTranslation } from "react-i18next";

type AppLockConfirmDialogProps = Readonly<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}>;

export function AppLockConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
}: AppLockConfirmDialogProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={t("settings.security.lockConfirmTitle")}
      description={t("settings.security.lockConfirmDesc")}
      confirmLabel={t("settings.security.lockConfirmAction")}
      cancelLabel={t("common.cancel")}
    />
  );
}
