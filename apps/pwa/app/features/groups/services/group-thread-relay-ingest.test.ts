import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  buildGroupTimelineSubscriptionFilters,
  ingestSealedCommunityRelayEvent,
} from "./group-thread-relay-ingest";
import { SEALED_COMMUNITY_KIND_DELETE, SEALED_COMMUNITY_KIND_MEMBERS } from "./sealed-community-relay-kinds";

vi.mock("./community-dev-flags", () => ({
  isWorkspaceR1MembershipEnforced: vi.fn(() => true),
}));

vi.mock("./community-membership-sync-mode", () => ({
  isCoordinationConfigured: vi.fn(() => true),
  readMembershipSyncMode: vi.fn(() => "coordination_preferred" as const),
}));

const { appendMock, suppressMock, resolveRoomKeyForIngestMock } = vi.hoisted(() => ({
  appendMock: vi.fn(async (params: { eventId?: string }) => ({
    status: "persisted" as const,
    eventId: params.eventId ?? "evt-1",
  })),
  suppressMock: vi.fn(async () => ({
    status: "suppressed" as const,
    eventIds: ["target-event"],
  })),
  resolveRoomKeyForIngestMock: vi.fn<() => Promise<string | null>>(async () => "room-key"),
}));

vi.mock("@/app/features/messaging/services/thread-history/group-thread-append", () => ({
  appendGroupThreadMessage: appendMock,
}));

vi.mock("@/app/features/messaging/services/thread-history/group-thread-suppress", () => ({
  suppressGroupThreadMessage: suppressMock,
}));

vi.mock("./community-coordination-room-key-owner", () => ({
  resolveRoomKeyHexForGroupRelayIngest: resolveRoomKeyForIngestMock,
}));

vi.mock("@/app/features/crypto/crypto-service", () => ({
  cryptoService: {
    decryptGroupMessage: vi.fn(),
  },
}));

vi.mock("@/app/features/crypto/room-key-store", () => ({
  roomKeyStore: {
    getRoomKeyRecord: vi.fn(async () => null),
  },
}));

vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
  getResolvedProfileId: vi.fn(() => "profile-1"),
}));

import { cryptoService } from "@/app/features/crypto/crypto-service";
import { resolveRoomKeyHexForGroupRelayIngest } from "./community-coordination-room-key-owner";

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
    suppressMock.mockClear();
    resolveRoomKeyForIngestMock.mockClear();
    resolveRoomKeyForIngestMock.mockResolvedValue("room-key");
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
    expect(filters[0]?.kinds).toContain(SEALED_COMMUNITY_KIND_DELETE);
    expect(filters[0]?.kinds).not.toContain(SEALED_COMMUNITY_KIND_MEMBERS);
  });

  it("applies kind-5 delete events through suppressGroupThreadMessage", async () => {
    const targetEventId = "f".repeat(64);
    const deleteEventId = "e".repeat(64);
    const result = await ingestSealedCommunityRelayEvent(
      {
        id: deleteEventId,
        pubkey: actor,
        kind: SEALED_COMMUNITY_KIND_DELETE,
        created_at: 1_700_000_100,
        sig: "sig",
        content: "",
        tags: [["e", targetEventId], ["h", groupId]],
      },
      scopedRelay,
      {
        groupId,
        relayUrl: scopedRelay,
        conversationId,
        myPublicKeyHex: actor,
      },
    );

    expect(result).toEqual({
      status: "suppressed",
      eventId: deleteEventId,
      targetEventIds: [targetEventId],
    });
    expect(suppressMock).toHaveBeenCalledWith(expect.objectContaining({
      conversationId,
      groupId,
      primaryMessageId: targetEventId,
      deletedByPublicKeyHex: actor,
    }));
    expect(appendMock).not.toHaveBeenCalled();
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
        localPrivateKeyHex: "bb".repeat(32),
        communityId: "community-1",
      },
    );

    expect(result).toEqual({ status: "persisted", eventId });
    expect(resolveRoomKeyForIngestMock).toHaveBeenCalledWith(expect.objectContaining({
      groupId,
      communityId: "community-1",
      localPubkey: actor,
      localPrivateKeyHex: "bb".repeat(32),
    }));
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

  it("returns decrypt_failed when ingest room-key owner misses", async () => {
    resolveRoomKeyForIngestMock.mockResolvedValue(null);
    const result = await ingestSealedCommunityRelayEvent(
      createSealedChatEvent({ id: "f".repeat(64), content: "ignored-outer" }),
      scopedRelay,
      {
        groupId,
        relayUrl: scopedRelay,
        conversationId,
        myPublicKeyHex: actor,
      },
    );

    expect(result).toEqual({ status: "failed", reason: "decrypt_failed" });
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
