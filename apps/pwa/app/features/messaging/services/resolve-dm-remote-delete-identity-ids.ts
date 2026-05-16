/**
 * Expands delete-command target ids so receiver UI/storage aliases still match
 * (projection rumor id vs gift-wrap id vs optimistic local id).
 */

import type { Message } from "../types";
import { decodeDmDeleteCommandV1 } from "../deletion/delete-command-codec";
import { collectMessageIdentityAliases } from "./message-identity-alias-contract";

const normalizeId = (value: string | undefined | null): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const messageMatchesAnyTarget = (
  message: Message,
  targetIds: ReadonlySet<string>,
): boolean => {
  for (const alias of collectMessageIdentityAliases(message)) {
    if (targetIds.has(alias)) {
      return true;
    }
  }
  return false;
};

export const resolveDmRemoteDeleteIdentityIds = (params: Readonly<{
  targetMessageIds: ReadonlyArray<string>;
  plaintext?: string;
  localMessages?: ReadonlyArray<Message>;
  persistedMessages?: ReadonlyArray<Message>;
}>): ReadonlyArray<string> => {
  const resolved = new Set<string>();

  const addId = (value: string | undefined | null): void => {
    const normalized = normalizeId(value);
    if (normalized) {
      resolved.add(normalized);
    }
  };

  for (const id of params.targetMessageIds) {
    addId(id);
  }

  if (params.plaintext) {
    const decoded = decodeDmDeleteCommandV1(params.plaintext.trimStart());
    if (decoded) {
      for (const id of decoded.targetMessageIdentityIds) {
        addId(id);
      }
    }
  }

  const targetSet = new Set(resolved);
  const sources = [
    ...(params.localMessages ?? []),
    ...(params.persistedMessages ?? []),
  ];

  for (const message of sources) {
    if (!messageMatchesAnyTarget(message, targetSet)) {
      continue;
    }
    for (const alias of collectMessageIdentityAliases(message)) {
      resolved.add(alias);
    }
  }

  return Array.from(resolved);
};
