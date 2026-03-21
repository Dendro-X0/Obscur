import { describe, expect, it } from "vitest";
import type { DmConversation, GroupConversation } from "../types";
import { resolveConversationByToken } from "../utils/conversation-target";
import { applySelectedConversationUnreadIsolation } from "./unread-isolation";
import { mergeProjectionUnreadByConversationId } from "./projection-unread";

const LOCAL_PUBKEY = "a".repeat(64);
const PEER_ALPHA = "b".repeat(64);
const PEER_BRAVO = "c".repeat(64);

const toCanonicalDmId = (left: string, right: string): string => (
  [left, right].sort().join(":")
);

const DM_ALPHA: DmConversation = {
  kind: "dm",
  id: toCanonicalDmId(LOCAL_PUBKEY, PEER_ALPHA),
  pubkey: PEER_ALPHA as DmConversation["pubkey"],
  displayName: "Alpha Peer",
  lastMessage: "alpha",
  unreadCount: 9,
  lastMessageTime: new Date(2_000),
};

const DM_BRAVO: DmConversation = {
  kind: "dm",
  id: toCanonicalDmId(LOCAL_PUBKEY, PEER_BRAVO),
  pubkey: PEER_BRAVO as DmConversation["pubkey"],
  displayName: "Bravo Peer",
  lastMessage: "bravo",
  unreadCount: 5,
  lastMessageTime: new Date(3_000),
};

const GROUP_ALPHA: GroupConversation = {
  kind: "group",
  id: "community:alpha:wss://relay.alpha",
  communityId: "v2_alpha",
  groupId: "alpha",
  relayUrl: "wss://relay.alpha",
  displayName: "Alpha Group",
  memberPubkeys: [],
  lastMessage: "group",
  unreadCount: 7,
  lastMessageTime: new Date(1_500),
  access: "invite-only",
  memberCount: 3,
  adminPubkeys: [],
};

describe("conversation-unread-convergence integration", () => {
  it("keeps selected group unread isolated across projection refresh in mixed dm/group histories", () => {
    const resolved = resolveConversationByToken({
      token: encodeURIComponent(GROUP_ALPHA.id),
      groups: [GROUP_ALPHA],
      connections: [DM_ALPHA, DM_BRAVO],
      dmFallbackPolicy: "canonical_id_only",
    });
    expect(resolved?.kind).toBe("group");

    const isolated = applySelectedConversationUnreadIsolation({
      currentUnreadByConversationId: {
        [GROUP_ALPHA.id]: 6,
        "community:alpha:wss://relay.alpha": 4,
        "group:alpha:wss://relay.alpha": 2,
        "alpha@relay.alpha": 3,
        [DM_ALPHA.id]: 1,
        [DM_BRAVO.id]: 8,
      },
      selectedConversation: resolved,
    });

    expect(isolated).not.toBeNull();
    expect(isolated?.[GROUP_ALPHA.id]).toBe(0);
    expect(isolated?.["community:alpha:wss://relay.alpha"]).toBe(0);
    expect(isolated?.["group:alpha:wss://relay.alpha"]).toBe(0);
    expect(isolated?.["alpha@relay.alpha"]).toBe(0);
    expect(isolated?.[DM_ALPHA.id]).toBe(1);
    expect(isolated?.[DM_BRAVO.id]).toBe(8);

    const merged = mergeProjectionUnreadByConversationId({
      currentUnreadByConversationId: isolated ?? {},
      projectionConnections: [DM_ALPHA, DM_BRAVO],
      selectedConversationId: GROUP_ALPHA.id,
      selectedConversationKind: "group",
    });

    // Group-focused selection must not let DM projection overwrite local DM unread state.
    expect(merged[DM_ALPHA.id]).toBe(1);
    expect(merged[DM_BRAVO.id]).toBe(8);
    expect(merged[GROUP_ALPHA.id]).toBe(0);
    expect(merged["community:alpha:wss://relay.alpha"]).toBe(0);
    expect(merged["group:alpha:wss://relay.alpha"]).toBe(0);
    expect(merged["alpha@relay.alpha"]).toBe(0);
  });

  it("uses canonical dm token routing and converges selected dm unread to zero", () => {
    const resolvedDm = resolveConversationByToken({
      token: encodeURIComponent(DM_ALPHA.id),
      groups: [GROUP_ALPHA],
      connections: [DM_ALPHA, DM_BRAVO],
      dmFallbackPolicy: "canonical_id_only",
    });
    expect(resolvedDm?.kind).toBe("dm");
    expect(resolvedDm?.id).toBe(DM_ALPHA.id);

    const isolated = applySelectedConversationUnreadIsolation({
      currentUnreadByConversationId: {
        [GROUP_ALPHA.id]: 4,
        [DM_ALPHA.id]: 6,
        [DM_BRAVO.id]: 2,
      },
      selectedConversation: resolvedDm,
    });

    expect(isolated).not.toBeNull();
    expect(isolated?.[DM_ALPHA.id]).toBe(0);
    expect(isolated?.[DM_BRAVO.id]).toBe(2);
    expect(isolated?.[GROUP_ALPHA.id]).toBe(4);

    const merged = mergeProjectionUnreadByConversationId({
      currentUnreadByConversationId: isolated ?? {},
      projectionConnections: [DM_ALPHA, DM_BRAVO],
      selectedConversationId: DM_ALPHA.id,
      selectedConversationKind: "dm",
    });

    expect(merged[DM_ALPHA.id]).toBe(0);
    expect(merged[DM_BRAVO.id]).toBe(5);
    expect(merged[GROUP_ALPHA.id]).toBe(4);
  });

  it("rejects non-canonical dm token at strict routing boundary without unread mutation", () => {
    const legacyDm: DmConversation = {
      ...DM_ALPHA,
      id: "legacy-dm-token",
      unreadCount: 3,
    };
    const resolved = resolveConversationByToken({
      token: "legacy-dm-token",
      groups: [],
      connections: [legacyDm],
      dmFallbackPolicy: "canonical_id_only",
    });

    expect(resolved).toBeNull();
    const isolated = applySelectedConversationUnreadIsolation({
      currentUnreadByConversationId: {
        [legacyDm.id]: 3,
      },
      selectedConversation: resolved,
    });
    expect(isolated).toBeNull();
  });
});
