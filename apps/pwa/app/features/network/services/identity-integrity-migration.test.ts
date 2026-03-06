import { describe, expect, it } from "vitest";
import { __private__identityIntegrityMigration } from "./identity-integrity-migration";

describe("identity integrity migration helpers", () => {
  it("dedupes connection requests by normalized peer id and latest timestamp", () => {
    const input = [
      { id: "B".repeat(64), status: "pending", isOutgoing: true, timestampMs: 1000 },
      { id: "b".repeat(64), status: "declined", isOutgoing: true, timestampMs: 2000 },
      { id: "not-a-key", status: "pending", isOutgoing: true, timestampMs: 3000 },
    ] as any;
    const out = __private__identityIntegrityMigration.dedupeConnectionRequests(input);
    expect(out.requests).toHaveLength(1);
    expect(out.requests[0]?.id).toBe("b".repeat(64));
    expect(out.requests[0]?.status).toBe("declined");
    expect(out.dedupedCount).toBe(2);
  });

  it("dedupes dm connections and remaps conversation ids", () => {
    const me = "a".repeat(64);
    const peerUpper = "B".repeat(64);
    const peerLower = "b".repeat(64);
    const result = __private__identityIntegrityMigration.dedupeConnections(me as any, [
      { id: `${me}:${peerUpper}`, pubkey: peerUpper, displayName: "Old", lastMessage: "", unreadCount: 0, lastMessageTimeMs: 1000 },
      { id: `${peerLower}:${me}`, pubkey: peerLower, displayName: "New", lastMessage: "", unreadCount: 0, lastMessageTimeMs: 2000 },
    ] as any);
    expect(result.connections).toHaveLength(1);
    expect(result.connections[0]?.pubkey).toBe(peerLower);
    expect(result.dedupedCount).toBe(1);
    expect(result.remap.get(`${peerLower}:${me}`)).toBe(`${me}:${peerLower}`);
  });
});
