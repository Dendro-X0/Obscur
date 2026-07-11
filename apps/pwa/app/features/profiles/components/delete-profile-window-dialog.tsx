"use client";

import type React from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog, Input, Label } from "@dweb/ui-kit";
import { DELETE_PROFILE_WINDOW_CONFIRM_TEXT } from "@/app/features/profiles/services/delete-current-profile-window";

type Props = Readonly<{
  isOpen: boolean;
  isDefaultProfileWindow: boolean;
  isWorking: boolean;
  confirmInput: string;
  onConfirmInputChange: (value: string) => void;
  onClose: () => void;
  onConfirmDelete: () => void;
}>;

export function DeleteProfileWindowDialog(props: Props): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <ConfirmDialog
      isOpen={props.isOpen}
      onClose={props.onClose}
      onConfirm={props.onConfirmDelete}
      title={props.isDefaultProfileWindow
        ? t("settings.dialogs.resetProfileWindowTitle")
        : t("settings.dialogs.deleteProfileWindowTitle")}
      description={props.isDefaultProfileWindow
        ? t("settings.dialogs.resetProfileWindowDesc")
        : t("settings.dialogs.deleteProfileWindowDesc")}
      confirmLabel={props.isDefaultProfileWindow
        ? t("settings.dialogs.resetProfileWindowConfirm")
        : t("settings.dialogs.deleteProfileWindowConfirm")}
      cancelLabel={t("common.cancel")}
      variant="danger"
      isLoading={props.isWorking}
    >
      <div className="space-y-4 pb-2">
        <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
          {t("settings.dialogs.deleteProfileWindowExportHint")}
        </p>
        <div className="space-y-2">
          <Label htmlFor="delete-profile-window-confirm" className="text-xs">
            {t("settings.dialogs.deleteProfileWindowTypeConfirm", {
              phrase: DELETE_PROFILE_WINDOW_CONFIRM_TEXT,
            })}
          </Label>
          <Input
            id="delete-profile-window-confirm"
            value={props.confirmInput}
            onChange={(event) => props.onConfirmInputChange(event.target.value)}
            placeholder={DELETE_PROFILE_WINDOW_CONFIRM_TEXT}
            className="font-mono text-xs"
            disabled={props.isWorking}
          />
        </div>
      </div>
    </ConfirmDialog>
  );
}
