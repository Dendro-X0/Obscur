import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { setProfileRuntimeScope } from "../../profiles/services/profile-runtime-scope";
import { useGroupThreadRelayIngest } from "./use-group-thread-relay-ingest";
import { SEALED_COMMUNITY_KIND_MEMBERS } from "../services/sealed-community-relay-kinds";

vi.mock("../services/community-dev-flags", () => ({
  isWorkspaceR1MembershipEnforced: vi.fn(() => true),
}));

vi.mock("../services/community-membership-sync-mode", () => ({
  isCoordinationConfigured: vi.fn(() => true),
  readMembershipSyncMode: vi.fn(() => "coordination_preferred"),
}));

describe("useGroupThreadRelayIngest Path B B1-2", () => {
  const scopedRelay = "wss://relay.team.internal";
  const groupId = "group-workspace";
  const actor = "aa".repeat(32) as PublicKeyHex;
  let subscribeFilters: ReadonlyArray<{ kinds?: ReadonlyArray<number> }> | null = null;

  beforeEach(async () => {
    vi.clearAllMocks();
    subscribeFilters = null;
    const { createProfileMessageBus } = await import("@dweb/core/profile-message-bus");
    const bus = createProfileMessageBus({ profileId: "default" });
    setProfileRuntimeScope({ profileId: "default", bus });
  });

  it("subscribes to chat-only kinds for managed_workspace", () => {
    const pool = {
      subscribe: vi.fn((_filters, _onEvent) => {
        subscribeFilters = _filters;
        return "sub-id";
      }),
      unsubscribe: vi.fn(),
    };

    renderHook(() => useGroupThreadRelayIngest({
      pool: pool as never,
      relayUrl: scopedRelay,
      groupId,
      communityMode: "managed_workspace",
      myPublicKeyHex: actor,
      enabled: true,
    }));

    expect(subscribeFilters?.[0]?.kinds).toContain(10105);
    expect(subscribeFilters?.[0]?.kinds).not.toContain(SEALED_COMMUNITY_KIND_MEMBERS);
  });

  it("does not mutate membership when relay roster events arrive", async () => {
    let onEvent: ((event: unknown, url: string) => void) | null = null;
    const pool = {
      subscribe: vi.fn((_filters, handler) => {
        onEvent = handler;
        return "sub-id";
      }),
      unsubscribe: vi.fn(),
    };

    renderHook(() => useGroupThreadRelayIngest({
      pool: pool as never,
      relayUrl: scopedRelay,
      groupId,
      communityMode: "managed_workspace",
      myPublicKeyHex: actor,
      enabled: true,
    }));

    await act(async () => {
      onEvent?.({
        id: "members-event",
        pubkey: actor,
        kind: SEALED_COMMUNITY_KIND_MEMBERS,
        created_at: 700,
        sig: "sig",
        content: "",
        tags: [["h", groupId], ["p", actor]],
      }, scopedRelay);
    });

    expect(pool.subscribe).toHaveBeenCalled();
  });
});
