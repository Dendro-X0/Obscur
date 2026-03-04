import { describe, expect, it } from "vitest";
import { deriveRelayRuntimeStatus } from "./relay-runtime-status";

describe("deriveRelayRuntimeStatus", () => {
  it("returns unavailable when no relays configured", () => {
    const status = deriveRelayRuntimeStatus({ openCount: 0, totalCount: 0 });
    expect(status.status).toBe("unavailable");
    expect(status.label).toContain("No relay");
  });

  it("returns degraded when only subset is connected", () => {
    const status = deriveRelayRuntimeStatus({ openCount: 1, totalCount: 3 });
    expect(status.status).toBe("degraded");
  });

  it("returns healthy when all enabled relays are connected", () => {
    const status = deriveRelayRuntimeStatus({ openCount: 2, totalCount: 2 });
    expect(status.status).toBe("healthy");
  });
});

