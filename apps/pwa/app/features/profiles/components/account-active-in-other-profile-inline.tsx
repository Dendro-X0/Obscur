"use client";

import type React from "react";
import { useTranslation } from "react-i18next";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

type Props = Readonly<{
  incomingPublicKeyHex: PublicKeyHex;
  activeProfileLabel: string;
  onClose: () => void;
}>;

const accountPrefix = (publicKeyHex: PublicKeyHex): string => `${publicKeyHex.slice(0, 8)}…`;

/** Blocks duplicate unlock of the same account across profile windows at auth time. */
export function AccountActiveInOtherProfileInline(props: Props): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div
      className="mt-4 w-full rounded-[24px] border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-left shadow-lg"
      role="alert"
      aria-label={t("profiles.activeSession.title")}
    >
      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {t("profiles.activeSession.title")}
      </p>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        {t("profiles.activeSession.body", {
          accountPrefix: accountPrefix(props.incomingPublicKeyHex),
          profileLabel: props.activeProfileLabel,
        })}
      </p>
      <button
        type="button"
        className="mt-3 text-sm text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
        onClick={props.onClose}
      >
        {t("profiles.activeSession.dismiss")}
      </button>
    </div>
  );
}
