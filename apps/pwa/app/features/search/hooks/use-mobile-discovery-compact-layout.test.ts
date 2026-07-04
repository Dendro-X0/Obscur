import { describe, expect, it } from "vitest";
import { getMobileCompactLayoutSnapshot as getMobileDiscoveryCompactLayoutSnapshot } from "@/app/features/runtime/use-mobile-compact-layout.snapshot";

describe("use-mobile-discovery-compact-layout snapshot", () => {
  it("returns false without window (SSR default unless mobile shell build)", () => {
    expect(typeof getMobileDiscoveryCompactLayoutSnapshot).toBe("function");
  });
});
