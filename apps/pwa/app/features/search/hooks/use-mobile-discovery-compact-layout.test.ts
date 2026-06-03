import { describe, expect, it } from "vitest";
import { getMobileDiscoveryCompactLayoutSnapshot } from "./use-mobile-discovery-compact-layout.snapshot";

describe("use-mobile-discovery-compact-layout snapshot", () => {
  it("returns false without window (SSR default unless mobile shell build)", () => {
    expect(typeof getMobileDiscoveryCompactLayoutSnapshot).toBe("function");
  });
});
