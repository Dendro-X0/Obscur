"use client";

import type React from "react";
import { useTranslation } from "react-i18next";
import type { PortabilityImportPreflight } from "@/app/features/profiles/services/portability-import-preflight";
import { PortabilityImportPreflightContent } from "./portability-import-preflight-content";

type Props = Readonly<{
  preflight: PortabilityImportPreflight | null;
  isOpen: boolean;
  isApplying?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}>;

/** Inline restore confirmation — avoids modal overlay on the auth screen. */
export function PortabilityImportPreflightInline(props: Props): React.JSX.Element | null {
  const { t } = useTranslation();
  if (!props.isOpen) {
    return null;
  }

  return (
    <div
      className="w-full rounded-[24px] border border-violet-500/30 bg-violet-500/5 px-4 py-4 text-left shadow-lg"
      role="region"
      aria-label={t("profiles.portability.preflight.importConfirmationAria")}
    >
      <PortabilityImportPreflightContent
        preflight={props.preflight}
        isApplying={props.isApplying}
        onClose={props.onClose}
        onConfirm={props.onConfirm}
      />
    </div>
  );
}
