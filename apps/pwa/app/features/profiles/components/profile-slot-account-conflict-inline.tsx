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

/** Inline account-slot conflict UI for auth — avoids modal overlay trapping the login surface. */
export function ProfileSlotAccountConflictInline(props: Props): React.JSX.Element {
  const { t } = useTranslation();
  const occupantLabel = props.occupantUsername?.trim()
    || accountPrefix(props.occupantPublicKeyHex);

  return (
    <div
      className="mt-4 w-full rounded-[24px] border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-left shadow-lg"
      role="region"
      aria-label={t("auth.slotConflict.regionAria")}
    >
      <div className="space-y-3">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {t("auth.slotConflict.title")}
        </p>
        <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
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
            {t("auth.slotConflict.hint")}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {props.canOpenAnotherWindow ? (
            <Button
              type="button"
              disabled={props.isBusy}
              onClick={props.onOpenAnotherWindow}
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
          >
            <Trash2 className="h-4 w-4" />
            {t("auth.slotConflict.clearWindow")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={props.isBusy}
            onClick={props.onExportAndClear}
          >
            <FolderOutput className="h-4 w-4" />
            {t("auth.slotConflict.exportThenSwitch")}
          </Button>
          <Button type="button" variant="ghost" disabled={props.isBusy} onClick={props.onClose}>
            {t("auth.slotConflict.cancel")}
          </Button>
        </div>
      </div>
    </div>
  );
}
