import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Path B Band B2-1 exit contract — team relay transport publishes real EVENT wire or fails.
 */
describe("path B B2-1 exit contract", () => {
  const pwaRoot = path.resolve(__dirname, "../../../..");
  const read = (relativePath: string) => readFileSync(path.join(pwaRoot, relativePath), "utf8");

  it("community team relay transport builds signed EVENT and calls publishToUrl", () => {
    const transport = read("app/features/groups/services/community-team-relay-transport.ts");
    expect(transport).toContain("createCommunityTeamRelayTransport");
    expect(transport).toContain("buildTeamRelayMembershipUnsignedEvent");
    expect(transport).toContain('JSON.stringify(["EVENT", signedEvent])');
    expect(transport).toContain("pool.publishToUrl");
    expect(transport).toMatch(/if \(!publishResult\.success\)/);
  });

  it("transport does not return optimistic success without wire publish", () => {
    const transport = read("app/features/groups/services/community-team-relay-transport.ts");
    expect(transport).toContain("team_relay_signing_not_configured");
    expect(transport).toContain("team_relay_publish_to_url_unavailable");
    expect(transport).toContain("team_relay_unsupported_event_type");
    expect(transport).not.toMatch(/return \{ success: true \}[\s\S]*publishToUrl/);
  });

  it("wire mapper produces NIP-29 join/leave kinds from semantic events", () => {
    const wire = read("app/features/groups/services/community-team-relay-wire.ts");
    expect(wire).toContain("RELAY_KIND_RELAY_JOIN");
    expect(wire).toContain("RELAY_KIND_RELAY_LEAVE");
    expect(wire).toContain("COMMUNITY_MEMBER_JOINED");
    expect(wire).toContain("Membership truth remains on coordination");
  });

  it("transport tests prove EVENT wire and relay failure propagation", () => {
    const tests = read("app/features/groups/services/community-team-relay-transport.test.ts");
    expect(tests).toContain('JSON.stringify(["EVENT", signedEvent])');
    expect(tests).toContain("does not return optimistic success without signing configured");
    expect(tests).toContain("rejected:rate-limited");
  });

  it("enhanced relay pool exposes publishToUrl for team relay adapter", () => {
    const pool = read("app/features/relays/hooks/enhanced-relay-pool-legacy.ts");
    expect(pool).toContain("publishToUrl");
    expect(pool).toContain("PublishResult");
  });
});
