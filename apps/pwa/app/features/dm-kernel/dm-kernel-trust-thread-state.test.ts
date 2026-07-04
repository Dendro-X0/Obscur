import { describe, expect, it } from "vitest";
import { resolveTrustThreadStateKey } from "./dm-kernel-trust-thread-state";

describe("dm-kernel-trust-thread-state", () => {
  it("scopes group sender thread state separately from DM conversation id", () => {
    expect(resolveTrustThreadStateKey("group-1", "group", "aa".repeat(32))).toBe(
      `group-1#${"aa".repeat(32)}`,
    );
    expect(resolveTrustThreadStateKey("dm-1", "dm", "bb".repeat(32))).toBe("dm-1");
  });
});
