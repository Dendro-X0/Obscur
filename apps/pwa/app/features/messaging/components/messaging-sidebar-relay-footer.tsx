"use client";

import type React from "react";
import { RelayStatusIndicator } from "@/app/features/relays/components/relay-status-indicator";
import {
  MESSAGING_SHELL_BOTTOM_CHROME_CLASS,
  MESSAGING_SHELL_BOTTOM_CHROME_PRIMARY_ROW_CLASS,
  MESSAGING_SHELL_BOTTOM_CHROME_STATUS_ROW_CLASS,
} from "./messaging-shell-bottom-chrome";

type MessagingSidebarRelayFooterProps = Readonly<{
  footerLabel: string;
}>;

export function MessagingSidebarRelayFooter({
  footerLabel,
}: MessagingSidebarRelayFooterProps): React.JSX.Element {
  return (
    <div className={MESSAGING_SHELL_BOTTOM_CHROME_CLASS}>
      <div className={MESSAGING_SHELL_BOTTOM_CHROME_PRIMARY_ROW_CLASS}>
        <RelayStatusIndicator embedded />
      </div>
      <div className={MESSAGING_SHELL_BOTTOM_CHROME_STATUS_ROW_CLASS}>
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 opacity-50">
          {footerLabel}
        </span>
      </div>
    </div>
  );
}
