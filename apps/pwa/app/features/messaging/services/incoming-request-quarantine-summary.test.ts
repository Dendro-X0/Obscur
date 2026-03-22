import { describe, expect, it } from "vitest";
import { summarizeIncomingRequestQuarantineEvents } from "./incoming-request-quarantine-summary";

describe("incoming-request-quarantine-summary", () => {
  it("returns default summary when no events are present", () => {
    const summary = summarizeIncomingRequestQuarantineEvents([]);
    expect(summary.totalSuppressed).toBe(0);
    expect(summary.byReason.incoming_connection_request_peer_rate_limited).toBe(0);
    expect(summary.byReason.incoming_connection_request_global_rate_limited).toBe(0);
    expect(Object.keys(summary.byPeerPrefix)).toHaveLength(0);
    expect(summary.recent).toHaveLength(0);
  });

  it("aggregates reason and peer-prefix counts from quarantined events", () => {
    const summary = summarizeIncomingRequestQuarantineEvents([
      {
        atUnixMs: 1_000,
        context: {
          reasonCode: "incoming_connection_request_peer_rate_limited",
          peerPubkeyPrefix: "aaaaaaaaaaaaaaaa",
        },
      },
      {
        atUnixMs: 2_000,
        context: {
          reasonCode: "incoming_connection_request_peer_rate_limited",
          peerPubkeyPrefix: "aaaaaaaaaaaaaaaa",
        },
      },
      {
        atUnixMs: 3_000,
        context: {
          reasonCode: "incoming_connection_request_global_rate_limited",
          peerPubkeyPrefix: "bbbbbbbbbbbbbbbb",
        },
      },
    ]);

    expect(summary.totalSuppressed).toBe(3);
    expect(summary.byReason.incoming_connection_request_peer_rate_limited).toBe(2);
    expect(summary.byReason.incoming_connection_request_global_rate_limited).toBe(1);
    expect(summary.byPeerPrefix.aaaaaaaaaaaaaaaa?.count).toBe(2);
    expect(summary.byPeerPrefix.aaaaaaaaaaaaaaaa?.lastAtUnixMs).toBe(2_000);
    expect(summary.byPeerPrefix.bbbbbbbbbbbbbbbb?.count).toBe(1);
    expect(summary.recent[0]?.reasonCode).toBe("incoming_connection_request_global_rate_limited");
    expect(summary.recent[0]?.atUnixMs).toBe(3_000);
    expect(summary.recent[0]?.peerPrefix).toBe("bbbbbbbbbbbbbbbb");
  });
});
