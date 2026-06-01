"use client";

import type React from "react";
import { ExternalLink, FolderOutput, Trash2 } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dweb/ui-kit";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

type Props = Readonly<{
  isOpen: boolean;
  profileLabel: string;
  occupantPublicKeyHex: PublicKeyHex;
  incomingPublicKeyHex: PublicKeyHex;
  intent?: "import_account" | "create_account";
  isBusy?: boolean;
  canOpenAnotherWindow?: boolean;
  onOpenAnotherWindow: () => void;
  onClearWindow: () => void;
  onExportAndClear: () => void;
  onClose: () => void;
}>;

const accountPrefix = (publicKeyHex: PublicKeyHex): string => `${publicKeyHex.slice(0, 8)}…`;

export function ProfileSlotAccountConflictDialog(props: Props): React.JSX.Element | null {
  if (!props.isOpen) {
    return null;
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) props.onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Different account in this window</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-left text-sm text-zinc-600 dark:text-zinc-300">
              <p>
                <span className="font-semibold">{props.profileLabel}</span>
                {" "}already has local data for account
                <span className="font-semibold"> {accountPrefix(props.occupantPublicKeyHex)}</span>.
              </p>
              <p>
                {props.intent === "create_account"
                  ? "You cannot create a new identity in this window while another account's data is still here."
                  : (
                    <>
                      You cannot sign in as
                      <span className="font-semibold"> {accountPrefix(props.incomingPublicKeyHex)} </span>
                      here without clearing or exporting that data first — like switching Chrome profiles.
                    </>
                  )}
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {props.canOpenAnotherWindow ? (
            <Button
              type="button"
              disabled={props.isBusy}
              onClick={props.onOpenAnotherWindow}
            >
              <ExternalLink className="h-4 w-4" />
              Open another profile window (recommended)
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            disabled={props.isBusy}
            onClick={props.onClearWindow}
          >
            <Trash2 className="h-4 w-4" />
            Clear this window and continue
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={props.isBusy}
            onClick={props.onExportAndClear}
          >
            <FolderOutput className="h-4 w-4" />
            Export archive to disk, then switch account
          </Button>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" disabled={props.isBusy} onClick={props.onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
