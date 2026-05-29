import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { evaluateCommunityChatMessageIngest } from "./community-bot-message-policy";

const MEMBER = "11".repeat(32) as PublicKeyHex;
const BOT = "aa".repeat(32) as PublicKeyHex;
const STEWARD = "bb".repeat(32) as PublicKeyHex;
const STRANGER = "cc".repeat(32) as PublicKeyHex;

describe("community-bot-message-policy", () => {
  it("accepts all authors on sovereign room", () => {
    expect(evaluateCommunityChatMessageIngest({
      communityMode: "sovereign_room",
      authorPublicKeyHex: STRANGER,
      botPubkeys: [BOT],
      stewardPubkeys: [],
      activeMemberPubkeys: [MEMBER],
    })).toEqual({ accept: true, reasonCode: "accepted" });
  });

  it("stays permissive when no bots registered", () => {
    expect(evaluateCommunityChatMessageIngest({
      communityMode: "managed_workspace",
      authorPublicKeyHex: STRANGER,
      botPubkeys: [],
      stewardPubkeys: [STEWARD],
      activeMemberPubkeys: [MEMBER],
    })).toEqual({ accept: true, reasonCode: "accepted" });
  });

  it("rejects unlisted author when bot allowlist active", () => {
    expect(evaluateCommunityChatMessageIngest({
      communityMode: "managed_workspace",
      authorPublicKeyHex: STRANGER,
      botPubkeys: [BOT],
      stewardPubkeys: [STEWARD],
      activeMemberPubkeys: [MEMBER],
    })).toEqual({ accept: false, reasonCode: "unlisted_author_managed_workspace" });
  });

  it("accepts listed bot and members", () => {
    expect(evaluateCommunityChatMessageIngest({
      communityMode: "managed_workspace",
      authorPublicKeyHex: BOT,
      botPubkeys: [BOT],
      stewardPubkeys: [STEWARD],
      activeMemberPubkeys: [MEMBER],
    })).toEqual({ accept: true, reasonCode: "accepted" });

    expect(evaluateCommunityChatMessageIngest({
      communityMode: "managed_workspace",
      authorPublicKeyHex: MEMBER,
      botPubkeys: [BOT],
      stewardPubkeys: [STEWARD],
      activeMemberPubkeys: [MEMBER],
    })).toEqual({ accept: true, reasonCode: "accepted" });
  });
});
