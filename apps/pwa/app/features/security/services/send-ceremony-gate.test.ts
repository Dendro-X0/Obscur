/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  acknowledgeSendCeremony,
  buildSendCeremonyViewModel,
  isSendCeremonyAcknowledged,
  requiresFirstDmSendCeremony,
} from "./send-ceremony-gate";

const PK_A = "87cb2c2063308d194111eaa99643697dfa526af07516f09d4722258a94830125" as PublicKeyHex;
const PK_B = "b".repeat(64) as PublicKeyHex;

describe("send-ceremony-gate (ASE-1c)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("requires ceremony for first outgoing DM to a peer", () => {
    expect(requiresFirstDmSendCeremony({
      profileId: "default",
      peerPublicKeyHex: PK_B,
      priorOutgoingUserMessageCount: 0,
    })).toBe(true);
  });

  it("skips ceremony after prior outgoing messages", () => {
    expect(requiresFirstDmSendCeremony({
      profileId: "default",
      peerPublicKeyHex: PK_B,
      priorOutgoingUserMessageCount: 2,
    })).toBe(false);
  });

  it("persists acknowledgement per profile and peer", () => {
    acknowledgeSendCeremony("default", PK_B);
    expect(isSendCeremonyAcknowledged("default", PK_B)).toBe(true);
    expect(requiresFirstDmSendCeremony({
      profileId: "default",
      peerPublicKeyHex: PK_B,
      priorOutgoingUserMessageCount: 0,
    })).toBe(false);
  });

  it("builds send ceremony view model with sender and recipient fingerprints", () => {
    const model = buildSendCeremonyViewModel({
      senderPublicKeyHex: PK_A,
      recipientPublicKeyHex: PK_B,
      recipientDisplayName: "Alice",
      plaintextPreview: "Hello there",
    });
    expect(model?.senderNpub.startsWith("npub1")).toBe(true);
    expect(model?.recipientBinding.displayName).toBe("Alice");
    expect(model?.plaintextPreview).toBe("Hello there");
  });
});
