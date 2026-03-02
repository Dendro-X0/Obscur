"use client";

import React from "react";
import { InviteConnectionsDialog } from "./invite-connections-dialog";
import type { GroupMetadata } from "../types";

interface InviteContactsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  roomKeyHex: string;
  metadata: GroupMetadata;
  currentMemberPubkeys?: ReadonlyArray<string>;
}

// Backward-compatible alias: "contacts" terminology now maps to "connections".
export function InviteContactsDialog(props: InviteContactsDialogProps) {
  return <InviteConnectionsDialog {...props} />;
}

