import { describe, expect, it, vi, beforeEach } from "vitest";
import { setProfileRuntimeScope } from "@/app/features/profiles/services/profile-runtime-scope";
import {
  withAccountRestoreMaterializationEvents,
} from "./restore-materialization-events";

const detail = {
  publicKeyHex: "a".repeat(64),
  profileId: "profile-a",
};

const restoreMatBusRuntime = vi.hoisted(() => {
  const { createProfileMessageBus } =
    require("@dweb/core/profile-message-bus") as typeof import("@dweb/core/profile-message-bus");
  const profileId = "profile-a";
  const api = {
    bus: createProfileMessageBus({ profileId }),
    reset() {
      api.bus = createProfileMessageBus({ profileId });
      setProfileRuntimeScope({ profileId, bus: api.bus });
    },
  };
  return api;
});

describe("restore materialization events", () => {
  beforeEach(() => {
    restoreMatBusRuntime.reset();
  });

  it("dispatches start and completion around successful materialization", async () => {
    const publishSpy = vi.spyOn(restoreMatBusRuntime.bus, "publish");

    await expect(withAccountRestoreMaterializationEvents(detail, async () => "ok")).resolves.toBe("ok");

    expect(publishSpy).toHaveBeenCalledTimes(2);
    expect(publishSpy.mock.calls.map(([event]) => event)).toEqual([
      expect.objectContaining({
        type: "account-restore-materialization-started",
        detail,
      }),
      expect.objectContaining({
        type: "account-restore-materialization-completed",
        detail,
      }),
    ]);
  });

  it("dispatches completion when materialization fails", async () => {
    const publishSpy = vi.spyOn(restoreMatBusRuntime.bus, "publish");

    await expect(withAccountRestoreMaterializationEvents(detail, async () => {
      throw new Error("restore failed");
    })).rejects.toThrow("restore failed");

    expect(publishSpy.mock.calls.map(([event]) => event)).toEqual([
      expect.objectContaining({
        type: "account-restore-materialization-started",
        detail,
      }),
      expect.objectContaining({
        type: "account-restore-materialization-completed",
        detail,
      }),
    ]);
  });
});
