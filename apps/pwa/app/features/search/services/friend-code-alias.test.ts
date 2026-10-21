import { describe, expect, it } from "vitest";
import {
  FRIEND_CODE_ALIAS_KIND,
  FRIEND_CODE_ALIAS_LABEL,
  buildFriendCodeAliasUnsignedEvent,
  parseFriendCodeAliasEvent,
  profileRecordFromFriendCodeAlias,
} from "./friend-code-alias";

const PUBKEY = "a".repeat(64);
const CODE = "OBSCUR-GBKMBC";

describe("friend-code-alias", () => {
  it("builds a NIP-33 alias with indexed d-tag and no private key fields", () => {
    const unsigned = buildFriendCodeAliasUnsignedEvent({
      pubkey: PUBKEY,
      inviteCode: "obscur-gbkmbc",
      createdAtUnixSeconds: 1_700_000_000,
    });
    expect(unsigned).toMatchObject({
      kind: FRIEND_CODE_ALIAS_KIND,
      pubkey: PUBKEY,
      created_at: 1_700_000_000,
    });
    expect(unsigned?.tags).toEqual([
      ["d", CODE],
      ["p", PUBKEY],
      ["l", FRIEND_CODE_ALIAS_LABEL],
    ]);
    expect(JSON.parse(unsigned?.content ?? "{}")).toEqual({
      v: 1,
      code: CODE,
      pubkey: PUBKEY,
    });
    expect(JSON.stringify(unsigned)).not.toMatch(/nsec|private/i);
  });

  it("rejects invalid invite codes and non-pubkey inputs", () => {
    expect(buildFriendCodeAliasUnsignedEvent({
      pubkey: PUBKEY,
      inviteCode: "not-a-code",
    })).toBeNull();
    expect(buildFriendCodeAliasUnsignedEvent({
      pubkey: "nsec1qqqq",
      inviteCode: CODE,
    })).toBeNull();
  });

  it("parses a matching alias and refuses author/pubkey mismatch", () => {
    const unsigned = buildFriendCodeAliasUnsignedEvent({
      pubkey: PUBKEY,
      inviteCode: CODE,
      createdAtUnixSeconds: 42,
    });
    expect(unsigned).not.toBeNull();
    const parsed = parseFriendCodeAliasEvent(unsigned!);
    expect(parsed).toEqual({
      pubkey: PUBKEY,
      inviteCode: CODE,
      createdAtUnixSeconds: 42,
    });
    expect(parseFriendCodeAliasEvent({
      ...unsigned,
      pubkey: "b".repeat(64),
    })).toBeNull();
    expect(parseFriendCodeAliasEvent({
      kind: 0,
      pubkey: PUBKEY,
      tags: [["d", CODE], ["l", FRIEND_CODE_ALIAS_LABEL]],
      content: "{}",
    })).toBeNull();
  });

  it("maps an alias to a discovery stub without scanning kind 0", () => {
    const record = profileRecordFromFriendCodeAlias({
      pubkey: PUBKEY,
      inviteCode: CODE,
      createdAtUnixSeconds: 100,
    });
    expect(record).toEqual({
      pubkey: PUBKEY,
      inviteCode: CODE,
      updatedAtUnixMs: 100_000,
    });
  });
});
