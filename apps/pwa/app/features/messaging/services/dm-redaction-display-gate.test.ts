import { describe, expect, it, beforeEach } from "vitest";
import type { Message } from "../types";
import {
  applyDmRedactionDisplayGateAsync,
  filterMessagesThroughDmRedactionDisplayGate,
  messageMatchesDmRedactionDisplayGate,
  resetDmRedactionDisplayGateForTests,
} from "./dm-redaction-display-gate";

const profileId = "profile-gate-test";
const conversationId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const myPk = "a".repeat(64);

describe("dmRedactionDisplayGate", () => {
  beforeEach(() => {
    resetDmRedactionDisplayGateForTests();
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
  });

  it("hides messages whose aliases intersect the gate", async () => {
    const rumorId = "f".repeat(64);
    const wrapId = "e".repeat(64);
    await applyDmRedactionDisplayGateAsync({
      profileId,
      conversationId,
      identityIds: [rumorId],
      myPublicKeyHex: myPk as never,
    });

    const row: Message = {
      id: wrapId,
      eventId: rumorId,
      relayPublishedEventId: wrapId,
      conversationId,
      content: "hello",
      kind: "user",
      timestamp: new Date(),
      isOutgoing: false,
      status: "delivered",
      senderPubkey: "b".repeat(64),
    };

    expect(messageMatchesDmRedactionDisplayGate(row, profileId)).toBe(true);
    const visible = filterMessagesThroughDmRedactionDisplayGate([row], profileId);
    expect(visible).toHaveLength(0);
  });
});
