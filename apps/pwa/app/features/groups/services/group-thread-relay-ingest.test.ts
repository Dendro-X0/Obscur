import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  buildGroupTimelineSubscriptionFilters,
  ingestSealedCommunityRelayEvent,
} from "./group-thread-relay-ingest";
import { SEALED_COMMUNITY_KIND_MEMBERS } from "./sealed-community-relay-kinds";

vi.mock("./community-dev-flags", () => ({
  isWorkspaceR1MembershipEnforced: vi.fn(() => true),
}));

vi.mock("./community-membership-sync-mode", () => ({
  isCoordinationConfigured: vi.fn(() => true),
  readMembershipSyncMode: vi.fn(() => "coordination_preferred" as const),
}));

const appendMock = vi.fn(async (params: { eventId?: string }) => ({
  status: "persisted" as const,
  eventId: params.eventId ?? "evt-1",
}));

vi.mock("@/app/features/messaging/services/thread-history/group-thread-append", () => ({
  appendGroupThreadMessage: (...args: unknown[]) => appendMock(...args),
}));

vi.mock("@/app/features/crypto/crypto-service", () => ({
  cryptoService: {
    decryptGroupMessage: vi.fn(),
  },
}));

vi.mock("@/app/features/crypto/room-key-store", () => ({
  roomKeyStore: {
    getRoomKeyRecord: vi.fn(),
  },
}));

vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
  getResolvedProfileId: vi.fn(() => "profile-1"),
}));

import { cryptoService } from "@/app/features/crypto/crypto-service";
import { roomKeyStore } from "@/app/features/crypto/room-key-store";

const scopedRelay = "wss://relay.team.internal";
const groupId = "group-alpha";
const actor = "aa".repeat(32) as PublicKeyHex;
const conversationId = "community:group-alpha";

const createSealedChatEvent = (params: Readonly<{
  id: string;
  content: string;
  createdAt?: number;
}>): NostrEvent => ({
  id: params.id,
  pubkey: actor,
  kind: 10105,
  created_at: params.createdAt ?? 1_700_000_000,
  sig: "sig",
  content: JSON.stringify({ ciphertext: "sealed" }),
  tags: [["h", groupId]],
});

describe("group-thread-relay-ingest", () => {
  beforeEach(() => {
    appendMock.mockClear();
    vi.mocked(roomKeyStore.getRoomKeyRecord).mockResolvedValue({
      groupId,
      roomKeyHex: "room-key",
      previousKeys: [],
      createdAt: 0,
    });
    vi.mocked(cryptoService.decryptGroupMessage).mockResolvedValue(JSON.stringify({
      kind: 9,
      content: "hello group",
      created_at: 1_700_000_000,
      pubkey: actor,
    }));
  });

  it("builds scoped timeline filters for the group id", () => {
    const filters = buildGroupTimelineSubscriptionFilters(groupId);
    expect(filters[0]?.kinds).toContain(10105);
    expect(filters[0]?.["#h"]).toEqual([groupId]);
  });

  it("builds chat-only filters for managed_workspace (Path B B1-2)", () => {
    const filters = buildGroupTimelineSubscriptionFilters(groupId, "managed_workspace");
    expect(filters[0]?.kinds).toContain(10105);
    expect(filters[0]?.kinds).not.toContain(SEALED_COMMUNITY_KIND_MEMBERS);
  });

  it("ignores relay roster snapshots without persisting chat rows", async () => {
    const result = await ingestSealedCommunityRelayEvent(
      {
        id: "e".repeat(64),
        pubkey: actor,
        kind: SEALED_COMMUNITY_KIND_MEMBERS,
        created_at: 1_700_000_000,
        sig: "sig",
        content: "",
        tags: [["h", groupId], ["p", actor]],
      },
      scopedRelay,
      {
        groupId,
        relayUrl: scopedRelay,
        conversationId,
        myPublicKeyHex: actor,
      },
    );

    expect(result).toEqual({ status: "ignored", reason: "unsupported_kind" });
    expect(appendMock).not.toHaveBeenCalled();
  });

  it("persists decrypted chat payloads through appendGroupThreadMessage", async () => {
    const eventId = "b".repeat(64);
    const result = await ingestSealedCommunityRelayEvent(
      createSealedChatEvent({ id: eventId, content: "ignored-outer" }),
      scopedRelay,
      {
        groupId,
        relayUrl: scopedRelay,
        conversationId,
        myPublicKeyHex: actor,
      },
    );

    expect(result).toEqual({ status: "persisted", eventId });
    expect(appendMock).toHaveBeenCalledWith(expect.objectContaining({
      conversationId,
      groupId,
      senderPublicKeyHex: actor,
      plaintext: "hello group",
      eventId,
      profileId: "profile-1",
    }));
  });

  it("ignores sealed control payloads without persisting chat rows", async () => {
    vi.mocked(cryptoService.decryptGroupMessage).mockResolvedValue(JSON.stringify({
      type: "vote-kick",
      target: "cc".repeat(32),
      pubkey: actor,
      created_at: 1_700_000_000,
    }));

    const result = await ingestSealedCommunityRelayEvent(
      createSealedChatEvent({ id: "c".repeat(64), content: "ignored-outer" }),
      scopedRelay,
      {
        groupId,
        relayUrl: scopedRelay,
        conversationId,
        myPublicKeyHex: actor,
      },
    );

    expect(result).toEqual({ status: "ignored", reason: "control_payload" });
    expect(appendMock).not.toHaveBeenCalled();
  });

  it("ignores events from unexpected relays", async () => {
    const result = await ingestSealedCommunityRelayEvent(
      createSealedChatEvent({ id: "d".repeat(64), content: "ignored-outer" }),
      "wss://other.relay",
      {
        groupId,
        relayUrl: scopedRelay,
        conversationId,
        myPublicKeyHex: actor,
      },
    );

    expect(result).toEqual({ status: "ignored", reason: "relay_scope_mismatch" });
    expect(appendMock).not.toHaveBeenCalled();
  });
});
