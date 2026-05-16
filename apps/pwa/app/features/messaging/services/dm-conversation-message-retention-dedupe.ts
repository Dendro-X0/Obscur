/**
 * Local retention window + message identity dedupe used across hydrate, projection, and realtime paths (R1).
 */

import type { Message } from "../types";

const MESSAGE_RETENTION_DAY_MS = 24 * 60 * 60 * 1000;

export const normalizeLocalRetentionDays = (value: number | undefined): 0 | 30 | 90 => {
  if (value === 30 || value === 90) {
    return value;
  }
  return 0;
};

export const filterMessagesByLocalRetention = (
  messages: ReadonlyArray<Message>,
  retentionDays: number | undefined,
  nowMs: number = Date.now(),
): ReadonlyArray<Message> => {
  const normalizedRetentionDays = normalizeLocalRetentionDays(retentionDays);
  if (normalizedRetentionDays <= 0) {
    return messages;
  }
  const cutoffUnixMs = nowMs - (normalizedRetentionDays * MESSAGE_RETENTION_DAY_MS);
  return messages.filter((message) => {
    const timestampUnixMs = message.timestamp instanceof Date
      ? message.timestamp.getTime()
      : Number.NaN;
    return Number.isFinite(timestampUnixMs) && timestampUnixMs >= cutoffUnixMs;
  });
};

export const dedupeMessagesByIdentity = (messages: ReadonlyArray<Message>): ReadonlyArray<Message> => {
  const byMessageKey = new Map<string, Message>();
  messages.forEach((message) => {
    const dedupeKey = message.eventId?.trim() || message.id;
    const existing = byMessageKey.get(dedupeKey);
    if (!existing || message.timestamp.getTime() >= existing.timestamp.getTime()) {
      byMessageKey.set(dedupeKey, message);
    }
  });
  return Array.from(byMessageKey.values()).sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
};
