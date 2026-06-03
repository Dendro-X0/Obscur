import { describe, expect, it } from "vitest";
import { resolveGroupListAuthority } from "./group-list-authority";

describe("group-list-authority (P3d)", () => {
  it("uses sqlite authority on native runtime", () => {
    expect(resolveGroupListAuthority({ isNativeRuntime: true })).toEqual({
      authority: "sqlite",
      reason: "sqlite_native",
    });
  });

  it("falls back to persisted chat-state on web dev harness", () => {
    expect(resolveGroupListAuthority({ isNativeRuntime: false })).toEqual({
      authority: "persisted",
      reason: "persisted_fallback",
    });
  });
});
