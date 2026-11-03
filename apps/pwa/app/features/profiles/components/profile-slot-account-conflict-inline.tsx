"use client";

import type React from "react";
import { ExternalLink, FolderOutput, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@dweb/ui-kit/button";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

type Props = Readonly<{
  profileLabel: string;
  occupantPublicKeyHex: PublicKeyHex;
  incomingPublicKeyHex: PublicKeyHex;
  occupantUsername?: string | null;
  intent?: "import_account" | "create_account";
  isBusy?: boolean;
  canOpenAnotherWindow?: boolean;
  onOpenAnotherWindow: () => void;
  onClearWindow: () => void;
  onExportAndClear: () => void;
  onClose: () => void;
}>;

const accountPrefix = (publicKeyHex: PublicKeyHex): string => `${publicKeyHex.slice(0, 8)}…`;

/** Intentional account-switch panel — full card width, short copy, wipe actions demoted. */
export function ProfileSlotAccountConflictInline(props: Props): React.JSX.Element {
  const { t } = useTranslation();
  const occupantLabel = props.occupantUsername?.trim()
    || accountPrefix(props.occupantPublicKeyHex);

  return (
    <div
      className="mt-4 w-full min-w-0 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-left sm:px-5"
      role="region"
      aria-label={t("auth.slotConflict.regionAria")}
      data-testid="auth-account-switch-panel"
    >
      <div className="space-y-3">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {t("auth.slotConflict.title")}
        </p>
        <div className="space-y-1.5 text-sm leading-snug text-zinc-600 dark:text-zinc-300">
          <p>
            {t("auth.slotConflict.bodyOccupant", {
              profileLabel: props.profileLabel,
              occupantLabel,
            })}
          </p>
          <p>
            {props.intent === "create_account"
              ? t("auth.slotConflict.bodyCreate")
              : t("auth.slotConflict.bodyImport", {
                incomingPrefix: accountPrefix(props.incomingPublicKeyHex),
              })}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {t("auth.slotConflict.hint", { occupantLabel })}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {props.canOpenAnotherWindow ? (
            <Button
              type="button"
              disabled={props.isBusy}
              onClick={props.onOpenAnotherWindow}
              className="sm:flex-1"
            >
              <ExternalLink className="h-4 w-4" />
              {t("auth.slotConflict.openWindow")}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            disabled={props.isBusy}
            onClick={props.onClearWindow}
            className="sm:flex-1"
          >
            <Trash2 className="h-4 w-4" />
            {t("auth.slotConflict.clearWindow")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={props.isBusy}
            onClick={props.onExportAndClear}
            className="w-full"
          >
            <FolderOutput className="h-4 w-4" />
            {t("auth.slotConflict.exportThenSwitch")}
          </Button>
          <Button type="button" variant="ghost" disabled={props.isBusy} onClick={props.onClose} className="w-full">
            {t("auth.slotConflict.cancel")}
          </Button>
        </div>
      </div>
    </div>
  );
}
