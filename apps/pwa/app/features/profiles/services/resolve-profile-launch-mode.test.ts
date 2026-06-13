import { describe, expect, it } from "vitest";
import { resolveProfileLaunchMode } from "./resolve-profile-launch-mode";

describe("resolveProfileLaunchMode", () => {
  it("preserves explicit new_window from native snapshot", () => {
    expect(resolveProfileLaunchMode("main", "new_window")).toBe("new_window");
  });

  it("infers new_window for secondary profile window labels", () => {
    expect(resolveProfileLaunchMode("profile-tester2-1710000000000", "existing")).toBe("new_window");
  });

  it("defaults main window to existing", () => {
    expect(resolveProfileLaunchMode("main")).toBe("existing");
  });
});
