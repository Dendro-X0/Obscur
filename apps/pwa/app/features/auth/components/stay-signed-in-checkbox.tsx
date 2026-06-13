"use client";

import type React from "react";
import { Checkbox } from "@dweb/ui-kit";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import {
  isDeviceSessionTrustPersistenceEnabled,
  SESSION_CREDENTIAL_PERSISTENCE_ENABLED,
} from "@/app/features/auth/services/session-credential-policy";
import { useTranslation } from "react-i18next";

type Props = Readonly<{
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
}>;

export const shouldShowStaySignedInControl = (): boolean => (
  isDeviceSessionTrustPersistenceEnabled() && (hasNativeRuntime() || SESSION_CREDENTIAL_PERSISTENCE_ENABLED)
);

export function StaySignedInCheckbox(props: Props): React.JSX.Element | null {
  const { t } = useTranslation();

  if (!shouldShowStaySignedInControl()) {
    return null;
  }

  const label = hasNativeRuntime()
    ? t("auth.staySignedIn.nativeLabel", "Stay signed in on this device")
    : t("auth.staySignedIn.mobileShellLabel", "Trust this device on refresh");

  const description = hasNativeRuntime()
    ? t(
      "auth.staySignedIn.nativeHelp",
      "Uses OS secure storage after unlock. Your password is not saved in the browser.",
    )
    : t(
      "auth.staySignedIn.mobileShellHelp",
      "Restores your session when you refresh this browser tab.",
    );

  const checkboxId = props.id ?? "stay-signed-in";

  return (
    <div className="rounded-2xl border border-black/5 bg-white/40 px-4 py-3 dark:border-white/10 dark:bg-zinc-900/30">
      <div className="flex items-start gap-3">
        <Checkbox
          id={checkboxId}
          checked={props.checked}
          onCheckedChange={(checked) => props.onCheckedChange(Boolean(checked))}
          className="mt-0.5 h-4 w-4"
        />
        <label htmlFor={checkboxId} className="cursor-pointer space-y-1">
          <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{label}</div>
          <div className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</div>
        </label>
      </div>
    </div>
  );
}
