import { describe, expect, it, vi } from "vitest";
import { createCommunityTeamRelayTransport } from "./community-team-relay-transport";

const RELAY = "wss://relay.team.internal";
const SUBJECT = "aa".repeat(32);

describe("createCommunityTeamRelayTransport", () => {
  it("publishes signed EVENT wire via publishToUrl and returns relay result", async () => {
    const publishToUrl = vi.fn(async () => ({
      success: true,
      relayUrl: RELAY,
    }));
    const signedEvent = {
      id: "e".repeat(64),
      kind: 9021,
      pubkey: SUBJECT,
      created_at: 1,
      tags: [["h", "group-1"]],
      content: "",
      sig: "s".repeat(128),
    };

    const transport = createCommunityTeamRelayTransport(
      RELAY,
      {
        addTransientRelay: vi.fn(),
        reconnectRelay: vi.fn(),
        publishToUrl,
      },
      {
        signMembershipWireEvent: vi.fn(async () => signedEvent),
      },
    );

    const result = await transport.publishCommunityControl({
      type: "COMMUNITY_MEMBER_JOINED",
      communityId: "group-1",
      subjectPublicKeyHex: SUBJECT,
      actorPublicKeyHex: SUBJECT,
      createdAtUnixMs: 1000,
      logicalEventId: "evt-1",
      source: "team_relay",
    });

    expect(result).toEqual({ success: true });
    expect(publishToUrl).toHaveBeenCalledWith(
      RELAY,
      JSON.stringify(["EVENT", signedEvent]),
    );
  });

  it("returns failure when publishToUrl reports relay rejection", async () => {
    const publishToUrl = vi.fn(async () => ({
      success: false,
      relayUrl: RELAY,
      error: "rejected:rate-limited",
    }));

    const transport = createCommunityTeamRelayTransport(
      RELAY,
      {
        addTransientRelay: vi.fn(),
        reconnectRelay: vi.fn(),
        publishToUrl,
      },
      {
        signMembershipWireEvent: vi.fn(async () => ({
          id: "e".repeat(64),
          kind: 9021,
          pubkey: SUBJECT,
          created_at: 1,
          tags: [["h", "group-1"]],
          content: "",
          sig: "s".repeat(128),
        })),
      },
    );

    const result = await transport.publishCommunityControl({
      type: "COMMUNITY_MEMBER_JOINED",
      communityId: "group-1",
      subjectPublicKeyHex: SUBJECT,
      actorPublicKeyHex: SUBJECT,
      createdAtUnixMs: 1000,
      logicalEventId: "evt-1",
      source: "team_relay",
    });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe("rejected:rate-limited");
  });

  it("does not return optimistic success without signing configured", async () => {
    const publishToUrl = vi.fn();
    const transport = createCommunityTeamRelayTransport(RELAY, {
      addTransientRelay: vi.fn(),
      reconnectRelay: vi.fn(),
      publishToUrl,
    });

    const result = await transport.publishCommunityControl({
      type: "COMMUNITY_MEMBER_LEFT",
      communityId: "group-1",
      subjectPublicKeyHex: SUBJECT,
      actorPublicKeyHex: SUBJECT,
      createdAtUnixMs: 1000,
      logicalEventId: "evt-2",
      source: "team_relay",
    });

    expect(result).toEqual({ success: false, errorMessage: "team_relay_signing_not_configured" });
    expect(publishToUrl).not.toHaveBeenCalled();
  });

  it("returns failure when publishToUrl is unavailable on pool", async () => {
    const transport = createCommunityTeamRelayTransport(
      RELAY,
      {
        addTransientRelay: vi.fn(),
        reconnectRelay: vi.fn(),
      },
      {
        signMembershipWireEvent: vi.fn(async () => ({
          id: "e".repeat(64),
          kind: 9022,
          pubkey: SUBJECT,
          created_at: 1,
          tags: [["h", "group-1"]],
          content: "",
          sig: "s".repeat(128),
        })),
      },
    );

    const result = await transport.publishCommunityControl({
      type: "COMMUNITY_MEMBER_LEFT",
      communityId: "group-1",
      subjectPublicKeyHex: SUBJECT,
      actorPublicKeyHex: SUBJECT,
      createdAtUnixMs: 1000,
      logicalEventId: "evt-3",
      source: "team_relay",
    });

    expect(result).toEqual({ success: false, errorMessage: "team_relay_publish_to_url_unavailable" });
  });

  it("returns failure for unsupported semantic event types", async () => {
    const publishToUrl = vi.fn();
    const transport = createCommunityTeamRelayTransport(
      RELAY,
      {
        addTransientRelay: vi.fn(),
        reconnectRelay: vi.fn(),
        publishToUrl,
      },
      {
        signMembershipWireEvent: vi.fn(async () => ({
          id: "e".repeat(64),
          kind: 9021,
          pubkey: SUBJECT,
          created_at: 1,
          tags: [["h", "group-1"]],
          content: "",
          sig: "s".repeat(128),
        })),
      },
    );

    const result = await transport.publishCommunityControl({
      type: "COMMUNITY_DIRECTORY_HINT",
      communityId: "group-1",
      pubkeys: [SUBJECT],
      confidence: "hint",
      source: "team_relay",
    });

    expect(result).toEqual({ success: false, errorMessage: "team_relay_unsupported_event_type" });
    expect(publishToUrl).not.toHaveBeenCalled();
  });
});
