"use client";

import type React from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

type Props = Readonly<{
  incomingPublicKeyHex: PublicKeyHex;
  activeProfileLabel: string;
  onClose: () => void;
}>;

const accountPrefix = (publicKeyHex: PublicKeyHex): string => `${publicKeyHex.slice(0, 8)}…`;

/** Blocks duplicate unlock of the same account across profile windows at auth time. */
export function AccountActiveInOtherProfileInline(props: Props): React.JSX.Element {
  return (
    <div
      className="mt-4 w-full rounded-[24px] border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-left shadow-lg"
      role="alert"
      aria-label="Account already active"
    >
      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Account already active
      </p>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        Account
        <span className="font-semibold"> {accountPrefix(props.incomingPublicKeyHex)} </span>
        is already unlocked in
        <span className="font-semibold"> {props.activeProfileLabel}</span>.
        Sign out there before signing in here.
      </p>
      <button
        type="button"
        className="mt-3 text-sm text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
        onClick={props.onClose}
      >
        Dismiss
      </button>
    </div>
  );
}
