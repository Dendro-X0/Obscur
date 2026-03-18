import { describe, expect, it } from "vitest";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  buildPresenceUnsignedEvent,
  isPresenceRecordOnline,
  parsePresenceEvent,
  PRESENCE_D_TAG,
  PRESENCE_EVENT_KIND,
  PRESENCE_STALE_AFTER_MS,
  shouldRejectSessionAsDuplicate,
} from "./realtime-presence";

const ME = "a".repeat(64) as PublicKeyHex;

const toSignedEvent = (params: Readonly<{
  pubkey?: PublicKeyHex;
  content: string;
  createdAtSeconds?: number;
  tags?: ReadonlyArray<ReadonlyArray<string>>;
  kind?: number;
}>): NostrEvent => ({
  id: "f".repeat(64),
  pubkey: params.pubkey ?? ME,
  created_at: params.createdAtSeconds ?? Math.floor(Date.now() / 1000),
  kind: params.kind ?? PRESENCE_EVENT_KIND,
  tags: params.tags ?? [["d", PRESENCE_D_TAG]],
  content: params.content,
  sig: "e".repeat(128),
});

describe("realtime presence helpers", () => {
  it("builds and parses a valid presence event", () => {
    const issuedAtMs = 1_735_000_000_000;
    const unsigned = buildPresenceUnsignedEvent({
      pubkey: ME,
      state: "online",
      sessionId: "session-a",
      startedAtMs: issuedAtMs - 10_000,
      issuedAtMs,
    });
    const parsed = parsePresenceEvent(toSignedEvent({
      pubkey: unsigned.pubkey as PublicKeyHex,
      createdAtSeconds: unsigned.created_at,
      tags: unsigned.tags,
      content: unsigned.content,
      kind: unsigned.kind,
    }));
    expect(parsed).not.toBeNull();
    expect(parsed?.pubkey).toBe(ME);
    expect(parsed?.state).toBe("online");
    expect(parsed?.sessionId).toBe("session-a");
    expect(parsed?.startedAtMs).toBe(issuedAtMs - 10_000);
  });

  it("ignores events without the required presence d tag", () => {
    const parsed = parsePresenceEvent(toSignedEvent({
      content: JSON.stringify({
        type: "obscur_presence",
        version: 1,
        state: "online",
        sessionId: "session-a",
        startedAtMs: 1000,
        issuedAtMs: 1000,
      }),
      tags: [["t", "presence"]],
    }));
    expect(parsed).toBeNull();
  });

  it("marks stale online records as offline", () => {
    const parsed = parsePresenceEvent(toSignedEvent({
      createdAtSeconds: 100,
      content: JSON.stringify({
        type: "obscur_presence",
        version: 1,
        state: "online",
        sessionId: "session-a",
        startedAtMs: 100_000,
        issuedAtMs: 100_000,
      }),
    }));
    expect(parsed).not.toBeNull();
    expect(isPresenceRecordOnline(parsed, 100_000 + PRESENCE_STALE_AFTER_MS + 5_000)).toBe(false);
  });

  it("rejects current session when an older active self session is present", () => {
    const incoming = parsePresenceEvent(toSignedEvent({
      pubkey: ME,
      createdAtSeconds: Math.floor(Date.now() / 1000),
      content: JSON.stringify({
        type: "obscur_presence",
        version: 1,
        state: "online",
        sessionId: "session-old",
        startedAtMs: 1_000,
        issuedAtMs: 2_000,
      }),
    }));
    expect(incoming).not.toBeNull();
    expect(shouldRejectSessionAsDuplicate({
      incoming: incoming!,
      selfPublicKeyHex: ME,
      selfSessionId: "session-new",
      selfStartedAtMs: 5_000,
      nowMs: Date.now(),
    })).toBe(true);
  });

  it("does not reject when incoming session is newer than the current session", () => {
    const incoming = parsePresenceEvent(toSignedEvent({
      pubkey: ME,
      createdAtSeconds: Math.floor(Date.now() / 1000),
      content: JSON.stringify({
        type: "obscur_presence",
        version: 1,
        state: "online",
        sessionId: "session-new",
        startedAtMs: 6_000,
        issuedAtMs: 7_000,
      }),
    }));
    expect(incoming).not.toBeNull();
    expect(shouldRejectSessionAsDuplicate({
      incoming: incoming!,
      selfPublicKeyHex: ME,
      selfSessionId: "session-old",
      selfStartedAtMs: 1_000,
      nowMs: Date.now(),
    })).toBe(false);
  });

  it("does not reject on startup from historical self-session replay", () => {
    const incoming = parsePresenceEvent(toSignedEvent({
      pubkey: ME,
      createdAtSeconds: 1,
      content: JSON.stringify({
        type: "obscur_presence",
        version: 1,
        state: "online",
        sessionId: "older-session",
        startedAtMs: 500,
        issuedAtMs: 1_000,
      }),
    }));
    expect(incoming).not.toBeNull();
    expect(shouldRejectSessionAsDuplicate({
      incoming: incoming!,
      selfPublicKeyHex: ME,
      selfSessionId: "new-session",
      selfStartedAtMs: 10_000,
      nowMs: 10_050,
    })).toBe(false);
  });

  it("rejects when older self-session emits live heartbeat after startup", () => {
    const incoming = parsePresenceEvent(toSignedEvent({
      pubkey: ME,
      createdAtSeconds: 20,
      content: JSON.stringify({
        type: "obscur_presence",
        version: 1,
        state: "online",
        sessionId: "older-session",
        startedAtMs: 1_000,
        issuedAtMs: 20_000,
      }),
    }));
    expect(incoming).not.toBeNull();
    expect(shouldRejectSessionAsDuplicate({
      incoming: incoming!,
      selfPublicKeyHex: ME,
      selfSessionId: "new-session",
      selfStartedAtMs: 10_000,
      nowMs: 20_050,
    })).toBe(true);
  });

  it("applies deterministic tie-break when both sessions start at the same time", () => {
    const incoming = parsePresenceEvent(toSignedEvent({
      pubkey: ME,
      createdAtSeconds: Math.floor(Date.now() / 1000),
      content: JSON.stringify({
        type: "obscur_presence",
        version: 1,
        state: "online",
        sessionId: "aaa-session",
        startedAtMs: 3_000,
        issuedAtMs: 3_200,
      }),
    }));
    expect(incoming).not.toBeNull();
    expect(shouldRejectSessionAsDuplicate({
      incoming: incoming!,
      selfPublicKeyHex: ME,
      selfSessionId: "zzz-session",
      selfStartedAtMs: 3_000,
      nowMs: Date.now(),
    })).toBe(true);
  });
});
