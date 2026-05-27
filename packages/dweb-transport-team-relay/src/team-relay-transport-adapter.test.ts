import { describe, expect, it, vi } from "vitest";
import { createTeamRelayTransportAdapter } from "./team-relay-transport-adapter";

describe("createTeamRelayTransportAdapter", () => {
  it("uses team_relay kind and scopes publish to the configured relay URL", async () => {
    const publish = vi.fn(async () => ({ success: true }));
    const adapter = createTeamRelayTransportAdapter({
      relayUrl: "wss://relay.team.internal",
      publish,
    });
    expect(adapter.kind).toBe("team_relay");
    await adapter.publishCommunityControl({
      type: "COMMUNITY_MEMBER_JOINED",
      communityId: "community-1",
      subjectPublicKeyHex: "aa".repeat(32),
      actorPublicKeyHex: "bb".repeat(32),
      createdAtUnixMs: 1,
      logicalEventId: "evt-1",
      source: "team_relay",
    });
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({
      relayUrl: "wss://relay.team.internal",
    }));
  });
});
