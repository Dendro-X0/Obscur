import { describe, expect, it } from "vitest";
import { stripChatStateMessageBodiesForNativeMirror } from "./restore-merge-chat-state";

describe("stripChatStateMessageBodiesForNativeMirror", () => {
  it("clears DM and group message bodies while retaining sidebar metadata", () => {
    const stripped = stripChatStateMessageBodiesForNativeMirror({
      version: 2,
      createdConnections: [{
        id: "dm:peer",
        displayName: "Peer",
        pubkey: "b".repeat(64),
        lastMessage: "preview",
        unreadCount: 0,
        lastMessageTimeMs: 1,
      }],
      createdGroups: [],
      unreadByConversationId: {},
      connectionOverridesByConnectionId: {},
      messagesByConversationId: {
        "dm:peer": [{
          id: "msg-1",
          content: "restore ghost",
          timestampMs: 2,
          isOutgoing: false,
          senderPubkey: "b".repeat(64),
        }],
      },
      groupMessages: {
        "community:room": [{
          id: "group-msg",
          content: "group ghost",
          timestampMs: 3,
          senderPubkey: "c".repeat(64),
        }],
      },
      connectionRequests: [],
      pinnedChatIds: ["dm:peer"],
      hiddenChatIds: [],
    });

    expect(stripped?.messagesByConversationId).toEqual({});
    expect(stripped?.groupMessages).toEqual({});
    expect(stripped?.createdConnections).toHaveLength(1);
    expect(stripped?.pinnedChatIds).toEqual(["dm:peer"]);
  });
});
