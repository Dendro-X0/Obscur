"use client";

import React from "react";
import { InviteMemberDialog } from "./invite-member-dialog";
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
  return <InviteMemberDialog {...props} />;
}
