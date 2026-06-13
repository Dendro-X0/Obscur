import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@dweb/db", () => ({
  isTauri: vi.fn(() => true),
  dbGetMessages: vi.fn(),
}));

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => true),
}));

vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
  getResolvedProfileId: vi.fn(() => "profile-tester1"),
}));

import { dbGetMessages } from "@dweb/db";
import {
  evaluateNativeDmSqliteHydrateIntegrity,
  loadNativeDmSqlitePeerThreadSnapshots,
} from "./native-dm-sqlite-integrity";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { Message } from "../types";

const myPk = "aa".repeat(32) as PublicKeyHex;
const peerPk = "bb".repeat(32) as PublicKeyHex;

describe("native-dm-sqlite-integrity", () => {
  beforeEach(() => {
    vi.mocked(dbGetMessages).mockReset();
  });

  it("flags hydrate_one_sided when UI paints only outgoing rows", async () => {
    vi.mocked(dbGetMessages).mockResolvedValue([
      {
        event_id: "out-1",
        profile_id: "profile-tester1",
        conversation_id: `${myPk}:${peerPk}`,
        sender_pubkey: myPk,
        recipient_pubkey: peerPk,
        plaintext: "mine",
        kind: 4,
        created_at: 1,
        received_at: 1,
        is_outgoing: true,
        reply_to_event_id: null,
        has_attachment: false,
      },
    ]);
    const hydrated: Message[] = [{
      id: "out-1",
      kind: "user",
      content: "mine",
      timestamp: new Date(1),
      isOutgoing: true,
      status: "delivered",
      conversationId: `${myPk}:${peerPk}`,
      senderPubkey: myPk,
      recipientPubkey: peerPk,
    }];
    const result = await evaluateNativeDmSqliteHydrateIntegrity({
      conversationId: `${myPk}:${peerPk}`,
      myPublicKeyHex: myPk,
      hydratedMessages: hydrated,
      profileId: "profile-tester1",
    });
    expect(result?.violation).toBe(true);
    expect(result?.reason).toBe("hydrate_one_sided");
  });

  it("loads peer thread snapshots from sqlite rows", async () => {
    vi.mocked(dbGetMessages).mockResolvedValue([
      {
        event_id: "in-1",
        profile_id: "profile-tester1",
        conversation_id: [myPk, peerPk].sort().join(":"),
        sender_pubkey: peerPk,
        recipient_pubkey: myPk,
        plaintext: "theirs",
        kind: 4,
        created_at: 2,
        received_at: 2,
        is_outgoing: false,
        reply_to_event_id: null,
        has_attachment: false,
      },
    ]);
    const rows = await loadNativeDmSqlitePeerThreadSnapshots({
      peerPublicKeyHex: peerPk,
      myPublicKeyHex: myPk,
      profileId: "profile-tester1",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.content).toBe("theirs");
    expect(rows[0]?.isOutgoing).toBe(false);
    expect(rows[0]?.timestampUnixMs).toBe(2000);
  });
});
