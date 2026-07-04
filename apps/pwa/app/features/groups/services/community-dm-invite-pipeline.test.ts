import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "@/app/features/messaging/types";
import type { CommunityDmInviteId } from "./community-dm-invite-contract";
import {
  augmentCommunityDmInviteThreadMessages,
  buildCommunityInviteThreadDisplayBundle,
  buildSyntheticOutboundInviteMessages,
  dedupeCommunityInviteResponseMessagesByGroupAndStatus,
  dedupeCommunityInviteResponseMessagesByInviteId,
  dedupeCommunityInviteThreadMessagesByInviteId,
  filterMisdirectedCommunityInviteResponses,
  parseInvitePayloadFromMessageContent,
  parseInviteResponsePayloadFromMessageContent,
} from "./community-dm-invite-pipeline";
import { buildCommunityInviteResponseStatusByMessageId } from "../utils/community-invite-resolution";
import {
  upsertCommunityDmInviteLedgerEntry,
  loadCommunityDmInviteLedger,
} from "./community-dm-invite-ledger";

const storage = vi.hoisted(() => new Map<string, string>());

vi.mock("@/app/features/profiles/services/profile-scope", () => ({
  getScopedStorageKey: (prefix: string, profileId: string) => `${prefix}:${profileId}`,
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
    }, "default", "a".repeat(64));

    const senderPubkey = "a".repeat(64) as Message["senderPubkey"] & string;
    const synthetic = buildSyntheticOutboundInviteMessages("a:b", [], "default", senderPubkey);
    expect(synthetic).toHaveLength(1);
    expect(parseInvitePayloadFromMessageContent(synthetic[0]!.content)?.inviteId).toBe(inviteId);
    expect(synthetic[0]?.senderPubkey).toBe(senderPubkey);
  });

  it("does not inject ledger synthetic invites during thread augment (IRA-3)", () => {
    const inviteId = "inv-augment-no-synthetic" as CommunityDmInviteId;
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
    }, "default", "a".repeat(64));

    const augmented = augmentCommunityDmInviteThreadMessages([], "a:b", "default", "a".repeat(64));
    expect(augmented).toHaveLength(0);
  });

  it("applies ledger terminal status to hydrated invite without injecting synthetic rows (IRA-3)", () => {
    const inviteId = "inv-ledger-status-only" as CommunityDmInviteId;
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
      status: "accepted",
      sentAtUnixMs: 1_700_000_000_000,
      updatedAtUnixMs: 1_700_000_000_100,
    }, "default", "a".repeat(64));

    const invite: Message = {
      id: "invite-wire",
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
    };

    const augmented = augmentCommunityDmInviteThreadMessages([invite], "a:b", "default");
    expect(augmented).toHaveLength(1);
    expect(augmented[0]?.id).toBe("invite-wire");
    expect(buildCommunityInviteResponseStatusByMessageId(augmented, "a:b", "default").get("invite-wire")).toBe("accepted");
  });

  it("maps canceled status onto invite when cancel response is hidden from display", () => {
    const inviteId = "inv-cancel-hidden" as CommunityDmInviteId;
    const inviterPk = "a".repeat(64);
    const inviteePk = "b".repeat(64);
    const invite: Message = {
      id: "invite-wire",
      conversationId: "a:b",
      kind: "user",
      content: JSON.stringify({
        type: "community-invite",
        inviteId,
        groupId: "group-1",
        roomKey: "rk",
        creatorPubkey: inviterPk,
        metadata: { id: "group-1", name: "Test Group", access: "invite-only" },
      }),
      timestamp: new Date(1_700_000_000_000),
      isOutgoing: false,
      status: "delivered",
      senderPubkey: inviterPk as Message["senderPubkey"] & string,
      recipientPubkey: inviteePk as Message["recipientPubkey"] & string,
    };
    const cancelResponse: Message = {
      id: "cancel-wire",
      conversationId: "a:b",
      kind: "user",
      content: JSON.stringify({
        type: "community-invite-response",
        inviteId,
        status: "canceled",
        groupId: "group-1",
      }),
      timestamp: new Date(1_700_000_000_500),
      isOutgoing: false,
      status: "delivered",
      senderPubkey: inviterPk as Message["senderPubkey"] & string,
      recipientPubkey: inviteePk as Message["recipientPubkey"] & string,
    };

    const bundle = buildCommunityInviteThreadDisplayBundle(
      [invite, cancelResponse],
      "a:b",
      "default",
      inviteePk,
    );

    expect(bundle.messages).toHaveLength(1);
    expect(bundle.messages[0]?.id).toBe("invite-wire");
    expect(bundle.inviteResponseStatusByMessageId.get("invite-wire")).toBe("canceled");
    expect(
      augmentCommunityDmInviteThreadMessages([invite, cancelResponse], "a:b", "default", inviteePk),
    ).toHaveLength(1);
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

  it("hides linked incoming response rows when invite is present in thread", () => {
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

  it("hides outbound acceptance response when invite card already shows terminal status", () => {
    const inviteId = "inv-789" as CommunityDmInviteId;
    const invite: Message = {
      id: "invite-inbound",
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
    const response: Message = {
      id: "response-outbound",
      conversationId: "a:b",
      kind: "user",
      content: JSON.stringify({
        type: "community-invite-response",
        inviteId,
        status: "accepted",
        groupId: "g1",
      }),
      timestamp: new Date(2),
      isOutgoing: true,
      status: "delivered",
    };

    const augmented = augmentCommunityDmInviteThreadMessages([invite, response], "a:b", "default");
    expect(augmented.some((message) => message.id === "response-outbound")).toBe(false);
    expect(buildCommunityInviteResponseStatusByMessageId([invite, response]).get("invite-inbound")).toBe("accepted");
  });

  it("dedupes duplicate outbound acceptance responses for the same inviteId", () => {
    const inviteId = "inv-dup-resp" as CommunityDmInviteId;
    const invite: Message = {
      id: "invite-inbound",
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
    const responseA: Message = {
      id: "response-a",
      conversationId: "a:b",
      kind: "user",
      content: JSON.stringify({
        type: "community-invite-response",
        inviteId,
        status: "accepted",
        groupId: "g1",
      }),
      timestamp: new Date(2),
      isOutgoing: true,
      status: "delivered",
    };
    const responseB: Message = {
      ...responseA,
      id: "response-b",
      timestamp: new Date(3),
    };

    const deduped = dedupeCommunityInviteResponseMessagesByInviteId([invite, responseA, responseB]);
    expect(deduped.filter((message) => parseInviteResponsePayloadFromMessageContent(message.content))).toHaveLength(1);
    expect(deduped.some((message) => message.id === "response-b")).toBe(true);
  });

  it("inviter thread drops bogus outgoing accept and legacy-id duplicate after restart hydrate", () => {
    const inviteId = "inv-inviter-restart" as CommunityDmInviteId;
    const invite: Message = {
      id: "invite-outbound",
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
    const peerAccept: Message = {
      id: "response-inbound",
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
    const bogusOutgoingAccept: Message = {
      id: "response-bogus-out",
      conversationId: "a:b",
      kind: "user",
      content: JSON.stringify({
        type: "community-invite-response",
        inviteId: "legacy:g1",
        status: "accepted",
        groupId: "g1",
      }),
      timestamp: new Date(3),
      isOutgoing: true,
      status: "delivered",
    };

    const augmented = augmentCommunityDmInviteThreadMessages(
      [invite, peerAccept, bogusOutgoingAccept],
      "a:b",
      "default",
    );
    expect(augmented.some((message) => message.id === "response-bogus-out")).toBe(false);
    expect(augmented.some((message) => message.id === "response-inbound")).toBe(false);
    expect(buildCommunityInviteResponseStatusByMessageId([invite, peerAccept, bogusOutgoingAccept]).get("invite-outbound")).toBe("accepted");
  });

  it("filterMisdirectedCommunityInviteResponses keeps inviter incoming and invitee outgoing only", () => {
    const inviteId = "inv-role" as CommunityDmInviteId;
    const outgoingInvite: Message = {
      id: "invite-out",
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
    const incomingAccept: Message = {
      id: "accept-in",
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
    const outgoingAccept: Message = {
      id: "accept-out",
      conversationId: "a:b",
      kind: "user",
      content: JSON.stringify({
        type: "community-invite-response",
        inviteId,
        status: "accepted",
        groupId: "g1",
      }),
      timestamp: new Date(3),
      isOutgoing: true,
      status: "delivered",
    };

    const filtered = filterMisdirectedCommunityInviteResponses([
      outgoingInvite,
      incomingAccept,
      outgoingAccept,
    ]);
    expect(filtered.map((message) => message.id)).toEqual(["invite-out", "accept-in"]);
    const deduped = dedupeCommunityInviteResponseMessagesByGroupAndStatus(filtered);
    expect(deduped.filter((message) => parseInviteResponsePayloadFromMessageContent(message.content))).toHaveLength(1);
  });
});
