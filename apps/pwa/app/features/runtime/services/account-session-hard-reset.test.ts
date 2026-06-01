import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  accountSessionHardResetInternals,
  performAccountSessionHardReset,
} from "./account-session-hard-reset";

describe("account session hard reset", () => {
  beforeEach(() => {
    accountSessionHardResetInternals.resetForTests();
    vi.stubGlobal("location", { reload: vi.fn() });
  });

  it("schedules a single hard reload per page lifetime", () => {
    performAccountSessionHardReset({ reason: "logout", profileId: "default" });
    performAccountSessionHardReset({ reason: "logout", profileId: "default" });
    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });
});
