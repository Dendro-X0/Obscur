import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "@/app/features/messaging/types";
import type { CommunityDmInviteId } from "./community-dm-invite-contract";
import {
  augmentCommunityDmInviteThreadMessages,
  buildSyntheticOutboundInviteMessages,
  dedupeCommunityInviteThreadMessagesByInviteId,
  parseInvitePayloadFromMessageContent,
} from "./community-dm-invite-pipeline";
import { buildCommunityInviteResponseStatusByMessageId } from "../utils/community-invite-resolution";
import {
  upsertCommunityDmInviteLedgerEntry,
  loadCommunityDmInviteLedger,
} from "./community-dm-invite-ledger";

const storage = vi.hoisted(() => new Map<string, string>());

vi.mock("@/app/features/profiles/services/profile-scope", () => ({
  getScopedStorageKey: (_prefix: string, profileId: string) => `ledger:${profileId}`,
}));

vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
  getResolvedProfileId: () => "default",
}));

describe("community-dm-invite-pipeline", () => {
  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    });
    loadCommunityDmInviteLedger("default").forEach(() => undefined);
  });

  it("synthesizes outbound invite rows from ledger when hydrate missed them", () => {
    const inviteId = "inv-123" as CommunityDmInviteId;
    upsertCommunityDmInviteLedgerEntry({
      inviteId,
      conversationId: "a:b",
      peerPubkey: "b".repeat(64) as Message["recipientPubkey"] & string,
      direction: "outbound",
      groupId: "group-1",
      groupName: "Test Group",
      invitePayload: {
        type: "community-invite",
        inviteId,
        groupId: "group-1",
        roomKey: "rk",
        metadata: { id: "group-1", name: "Test Group", access: "invite-only" },
      },
      status: "pending",
      sentAtUnixMs: 1_700_000_000_000,
      updatedAtUnixMs: 1_700_000_000_000,
    }, "default");

    const senderPubkey = "a".repeat(64) as Message["senderPubkey"] & string;
    const synthetic = buildSyntheticOutboundInviteMessages("a:b", [], "default", senderPubkey);
    expect(synthetic).toHaveLength(1);
    expect(parseInvitePayloadFromMessageContent(synthetic[0]!.content)?.inviteId).toBe(inviteId);
    expect(synthetic[0]?.senderPubkey).toBe(senderPubkey);
  });

  it("prefers hydrated invite rows over ledger synthetic duplicates", () => {
    const inviteId = "inv-prefer-real" as CommunityDmInviteId;
    const senderPubkey = "a".repeat(64) as Message["senderPubkey"] & string;
    const hydrated: Message = {
      id: "gift-wrap-real",
      conversationId: "a:b",
      kind: "user",
      content: JSON.stringify({
        type: "community-invite",
        inviteId,
        groupId: "group-1",
        roomKey: "rk",
        metadata: { id: "group-1", name: "Test Group", access: "invite-only" },
      }),
      timestamp: new Date(1_700_000_000_000),
      isOutgoing: true,
      status: "delivered",
      senderPubkey,
      recipientPubkey: "b".repeat(64) as Message["recipientPubkey"] & string,
    };
    const synthetic: Message = {
      id: `ledger-invite:${inviteId}`,
      conversationId: "a:b",
      kind: "user",
      content: hydrated.content,
      timestamp: new Date(1_700_000_000_500),
      isOutgoing: true,
      status: "delivered",
      recipientPubkey: "b".repeat(64) as Message["recipientPubkey"] & string,
    };
    const deduped = dedupeCommunityInviteThreadMessagesByInviteId([hydrated, synthetic]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.id).toBe("gift-wrap-real");
    expect(deduped[0]?.senderPubkey).toBe(senderPubkey);
  });

  it("dedupes duplicate invite rows that share the same inviteId", () => {
    const inviteId = "inv-dedupe" as CommunityDmInviteId;
    const older: Message = {
      id: "invite-old",
      conversationId: "a:b",
      kind: "user",
      content: JSON.stringify({
        type: "community-invite",
        inviteId,
        groupId: "g1",
        roomKey: "rk",
        metadata: { id: "g1", name: "G" },
      }),
      timestamp: new Date(1),
      isOutgoing: false,
      status: "delivered",
    };
    const newer: Message = {
      id: "invite-new",
      conversationId: "a:b",
      kind: "user",
      content: JSON.stringify({
        type: "community-invite",
        inviteId,
        groupId: "g1",
        roomKey: "rk",
        metadata: { id: "g1", name: "G" },
      }),
      timestamp: new Date(2),
      isOutgoing: false,
      status: "delivered",
    };

    const deduped = dedupeCommunityInviteThreadMessagesByInviteId([older, newer]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.id).toBe("invite-new");
  });

  it("hides linked response rows when invite is present in thread", () => {
    const inviteId = "inv-456" as CommunityDmInviteId;
    const invite: Message = {
      id: "invite-msg",
      conversationId: "a:b",
      kind: "user",
      content: JSON.stringify({
        type: "community-invite",
        inviteId,
        groupId: "g1",
        roomKey: "rk",
        metadata: { id: "g1", name: "G" },
      }),
      timestamp: new Date(1),
      isOutgoing: true,
      status: "delivered",
    };
    const response: Message = {
      id: "response-msg",
      conversationId: "a:b",
      kind: "user",
      content: JSON.stringify({
        type: "community-invite-response",
        inviteId,
        status: "accepted",
        groupId: "g1",
      }),
      timestamp: new Date(2),
      isOutgoing: false,
      status: "delivered",
    };

    const augmented = augmentCommunityDmInviteThreadMessages([invite, response], "a:b", "default");
    expect(augmented.some((message) => message.id === "response-msg")).toBe(false);
    expect(buildCommunityInviteResponseStatusByMessageId([invite, response]).get("invite-msg")).toBe("accepted");
  });
});
