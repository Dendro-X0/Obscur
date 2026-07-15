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

    expect(validateRelayUrl("ws://evil.example", { allowLocalhostWs: true })).toBeNull();
  });

  it("accepts ws://127.0.0.1 when explicitly enabled", () => {
    const allowed = validateRelayUrl("ws://127.0.0.1:7001", { allowLocalhostWs: true });
    expect(allowed?.normalizedUrl).toBe("ws://127.0.0.1:7001");
  });

  it("accepts localhost mesh HTTP gateway when explicitly enabled", () => {
    const allowed = validateRelayUrl("http://127.0.0.1:8788", { allowLocalhostWs: true });
    expect(allowed?.normalizedUrl).toBe("http://127.0.0.1:8788");

    expect(validateRelayUrl("http://127.0.0.1:8788")).toBeNull();
    expect(validateRelayUrl("http://evil.example", { allowLocalhostWs: true })).toBeNull();
  });
});

