import type { DmConversation } from "@/app/features/messaging/types";
import {
  formatPeerPubkeyPreview,
  isPeerPubkeyPlaceholderName,
  resolvePeerDisplayName,
} from "@/app/features/profile/utils/resolve-peer-display-name";

/** @deprecated Prefer pubkey preview via resolveInviteConnectionDisplayName — kept for legacy call sites. */
export const INVITE_CONNECTION_FALLBACK_NAME = "Unknown contact";

export const isPubkeyPlaceholderName = isPeerPubkeyPlaceholderName;

export const formatInviteConnectionPubkeyPreview = formatPeerPubkeyPreview;

/** Case-insensitive DM row lookup — peerTrust stores lowercase; conversation pubkeys may not. */
export const findDmConnectionByPubkey = <T extends Pick<DmConversation, "kind" | "pubkey">>(
  connections: ReadonlyArray<T>,
  pubkey: string,
): T | undefined => {
  const target = pubkey.trim().toLowerCase();
  if (!target) {
    return undefined;
  }
  return connections.find(
    (connection) => connection.kind === "dm" && connection.pubkey.trim().toLowerCase() === target,
  );
};

/**
 * Invite picker label — human name when known, otherwise compact pubkey preview.
 * Never returns the hostile "Unknown contact" / identity-hidden placeholders.
 */
export const resolveInviteConnectionDisplayName = (input: {
  pubkey: string;
  metadataDisplayName?: string | null;
  connectionDisplayName?: string | null;
}): string => (
  resolvePeerDisplayName({
    pubkey: input.pubkey,
    metadataDisplayName: input.metadataDisplayName,
    fallbackDisplayName: input.connectionDisplayName,
  })
);

/** True when the primary label is a real nickname/name (not a pubkey preview). */
export const isInviteConnectionHumanDisplayName = (
  displayName: string,
  pubkey: string,
): boolean => (
  Boolean(displayName.trim())
  && !isPeerPubkeyPlaceholderName(displayName, pubkey)
  && displayName.trim() !== formatPeerPubkeyPreview(pubkey)
);

export const toInviteConnectionSearchText = (input: {
  pubkey: string;
  resolvedDisplayName: string;
  metadataDisplayName?: string | null;
  connectionDisplayName?: string | null;
}): string => {
  const terms: Array<string> = [];
  const addUnique = (value: string | null | undefined): void => {
    if (!value) {
      return;
    }
    const trimmed = value.trim();
    if (!trimmed || terms.includes(trimmed)) {
      return;
    }
    terms.push(trimmed);
  };
  addUnique(input.resolvedDisplayName);
  addUnique(input.metadataDisplayName);
  addUnique(input.connectionDisplayName);
  addUnique(input.pubkey);
  addUnique(formatPeerPubkeyPreview(input.pubkey));
  return terms.join(" ").toLowerCase();
};
