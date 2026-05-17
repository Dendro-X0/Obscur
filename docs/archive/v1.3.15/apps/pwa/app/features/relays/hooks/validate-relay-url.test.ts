import { describe, expect, it } from "vitest";
import { validateRelayUrl } from "./validate-relay-url";

describe("validateRelayUrl", () => {
  it("accepts trusted wss relay URLs", () => {
    const result = validateRelayUrl("  wss://relay.damus.io/  ");
    expect(result?.normalizedUrl).toBe("wss://relay.damus.io");
  });

  it("rejects non-wss relay URLs by default", () => {
    expect(validateRelayUrl("ws://localhost:7001")).toBeNull();
    expect(validateRelayUrl("ws://relay.example")).toBeNull();
  });

  it("accepts ws://localhost only when explicitly enabled", () => {
    const allowed = validateRelayUrl("ws://localhost:7001", { allowLocalhostWs: true });
    expect(allowed?.normalizedUrl).toBe("ws://localhost:7001");

    expect(validateRelayUrl("ws://127.0.0.1:7001", { allowLocalhostWs: true })).toBeNull();
    expect(validateRelayUrl("ws://evil.example", { allowLocalhostWs: true })).toBeNull();
  });
});
