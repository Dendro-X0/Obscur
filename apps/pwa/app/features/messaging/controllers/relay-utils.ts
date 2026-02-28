import type { NostrEvent } from "@dweb/nostr/nostr-event";

export const countRelayFailures = (results: ReadonlyArray<{ success: boolean }>): number => {
  return results.reduce((acc: number, r: { success: boolean }): number => acc + (r.success ? 0 : 1), 0);
};

export const generateSubscriptionId = (): string => {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
};

export const parseRelayEventMessage = (payload: string): NostrEvent | null => {
  try {
    const parsed: unknown = JSON.parse(payload);
    if (!Array.isArray(parsed) || parsed.length < 3 || parsed[0] !== "EVENT") {
      return null;
    }

    const event: unknown = parsed[2];
    if (!event || typeof event !== "object") {
      return null;
    }
    const e = event as Record<string, unknown>;
    if (!e.id || !e.pubkey || !e.sig) {
      return null;
    }

    return event as NostrEvent;
  } catch {
    return null;
  }
};

export type RelayOkMessage = Readonly<{
  eventId: string;
  ok: boolean;
  message?: string;
}>;

export const parseRelayOkMessage = (payload: string): RelayOkMessage | null => {
  try {
    const parsed = JSON.parse(payload);
    if (!Array.isArray(parsed) || parsed.length < 3 || parsed[0] !== "OK") {
      return null;
    }

    return {
      eventId: parsed[1],
      ok: parsed[2],
      message: parsed[3]
    };
  } catch {
    return null;
  }
};
