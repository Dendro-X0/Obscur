import { describe, expect, it } from "vitest";
import { GROUP_MESSAGING_STUB_MESSAGE } from "./group-messaging-stub-policy";

describe("group-messaging-stub-policy", () => {
  it("exports stable stub toast copy", () => {
    expect(GROUP_MESSAGING_STUB_MESSAGE).toContain("community backend");
  });
});
