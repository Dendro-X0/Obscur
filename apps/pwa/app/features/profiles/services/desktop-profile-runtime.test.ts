import { beforeEach, describe, expect, it } from "vitest";
import { applyCachedWindowProfileScope } from "./desktop-profile-runtime";

describe("desktop-profile-runtime cached scope", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("applies last-known profile id for a secondary window label", () => {
    const windowLabel = "profile-profile-2-1700000000000";
    localStorage.setItem("obscur.desktop.window_profile.last_known.v1::profile-profile-2-1700000000000", "profile-2");

    expect(applyCachedWindowProfileScope(windowLabel)).toBe(true);
  });
});
