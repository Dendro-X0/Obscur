import { describe, expect, it } from "vitest";
import { getMessageDirectionCounts } from "../services/dm-thread-read-model";
import type { Message } from "../types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

const ME = "aa".repeat(32) as PublicKeyHex;
const PEER = "bb".repeat(32) as PublicKeyHex;

const row = (params: Readonly<{ id: string; outgoing: boolean }>): Message => ({
  id: params.id,
  kind: "user",
  content: "test",
  timestamp: new Date(),
  isOutgoing: params.outgoing,
  senderPubkey: params.outgoing ? ME : PEER,
  status: "delivered",
  conversationId: `${ME}:${PEER}`,
});

describe("DM thread re-entry coverage helpers", () => {
  it("detects partial threads that only show one direction", () => {
    const incomingOnly = [row({ id: "1", outgoing: false })];
    const outgoingOnly = [row({ id: "2", outgoing: true })];
    const full = [
      row({ id: "1", outgoing: false }),
      row({ id: "2", outgoing: true }),
    ];
    const incomingCounts = getMessageDirectionCounts(incomingOnly, ME);
    const fullCounts = getMessageDirectionCounts(full, ME);
    expect(incomingCounts.incoming > 0).toBe(true);
    expect(incomingCounts.outgoing).toBe(0);
    expect(fullCounts.incoming > 0 && fullCounts.outgoing > 0).toBe(true);
    expect(
      (incomingCounts.incoming > 0) !== (incomingCounts.outgoing > 0),
    ).toBe(true);
    expect(
      (getMessageDirectionCounts(outgoingOnly, ME).outgoing > 0)
        !== (getMessageDirectionCounts(outgoingOnly, ME).incoming > 0),
    ).toBe(true);
    expect(
      (fullCounts.incoming > 0) !== (fullCounts.outgoing > 0),
    ).toBe(false);
  });
});
