import { describe, expect, it } from "vitest";
import {
  classifyRelaySettingsCategory,
  isRelayNodeCurrentlyAvailable,
  relayMatchesSettingsCategory,
} from "./relay-settings-node-filter";
import type { RelayNodeStatus } from "@/app/features/relays/lib/relay-runtime-status";

describe("relay-settings-node-filter", () => {
  it("classifies public relays as nostr and localhost as intranet", () => {
    expect(classifyRelaySettingsCategory("wss://relay.damus.io")).toBe("nostr");
    expect(classifyRelaySettingsCategory("ws://localhost:7000")).toBe("intranet");
  });

  it("filters by category tab", () => {
    expect(relayMatchesSettingsCategory("wss://relay.damus.io", "all")).toBe(true);
    expect(relayMatchesSettingsCategory("wss://relay.damus.io", "nostr")).toBe(true);
    expect(relayMatchesSettingsCategory("ws://localhost:7000", "nostr")).toBe(false);
    expect(relayMatchesSettingsCategory("ws://localhost:7000", "intranet")).toBe(true);
  });

  it("treats open sockets and healthy status as available", () => {
    const healthy: RelayNodeStatus = {
      status: "healthy",
      badge: "Active transport",
      detail: "",
      roleLabel: "Active transport",
      successLabel: "100%",
      confidenceLabel: "High confidence (20)",
    };
    expect(isRelayNodeCurrentlyAvailable({
      nodeStatus: healthy,
      connection: { url: "wss://relay.damus.io", status: "open", updatedAtUnixMs: 1 },
    })).toBe(true);

    const disabled: RelayNodeStatus = {
      status: "unavailable",
      badge: "Disabled",
      detail: "",
      roleLabel: "Disabled",
      successLabel: "n/a",
      confidenceLabel: "Insufficient data (0)",
    };
    expect(isRelayNodeCurrentlyAvailable({ nodeStatus: disabled })).toBe(false);
  });
});
