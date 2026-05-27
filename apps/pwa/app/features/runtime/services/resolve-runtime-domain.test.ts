import { describe, expect, it } from "vitest";
import { resolveRuntimeDomain } from "./resolve-runtime-domain";

describe("resolveRuntimeDomain", () => {
  it("maps chat and groups to messaging", () => {
    expect(resolveRuntimeDomain("/")).toBe("messaging");
    expect(resolveRuntimeDomain("/groups/abc")).toBe("messaging");
  });

  it("maps network routes to network", () => {
    expect(resolveRuntimeDomain("/network")).toBe("network");
    expect(resolveRuntimeDomain("/network/npub1")).toBe("network");
  });

  it("maps search to search", () => {
    expect(resolveRuntimeDomain("/search")).toBe("search");
  });

  it("maps settings and vault to light", () => {
    expect(resolveRuntimeDomain("/settings")).toBe("light");
    expect(resolveRuntimeDomain("/vault")).toBe("light");
  });
});
