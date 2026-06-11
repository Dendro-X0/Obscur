import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: vi.fn(),
}));

vi.mock("./dm-kernel-policy", () => ({
  isDmKernelAuthority: vi.fn(() => true),
}));

vi.mock("@/app/features/messaging/services/native-dm-sqlite-repair", () => ({
  maybeScheduleNativeDmRelayBackfillRepair: vi.fn(() => true),
}));

import { maybeScheduleNativeDmRelayBackfillRepair } from "@/app/features/messaging/services/native-dm-sqlite-repair";
import { isDmKernelAuthority } from "./dm-kernel-policy";
import { requestDmKernelRelayBackfill } from "./dm-kernel-repair";

describe("requestDmKernelRelayBackfill", () => {
  beforeEach(() => {
    vi.mocked(isDmKernelAuthority).mockReturnValue(true);
    vi.mocked(maybeScheduleNativeDmRelayBackfillRepair).mockReturnValue(true);
  });

  it("dispatches relay backfill repair when kernel authority is active", async () => {
    const result = await requestDmKernelRelayBackfill({
      profileId: "default",
      conversationId: "dm:aa:bb",
      peerPubkey: "bb".repeat(64),
      reason: "one_sided_sqlite",
    });

    expect(result.requested).toBe(true);
    expect(result.reason).toBe("relay_backfill_dispatched");
    expect(maybeScheduleNativeDmRelayBackfillRepair).toHaveBeenCalledWith({
      profileId: "default",
      reason: "one_sided_sqlite",
      conversationId: "dm:aa:bb",
      trigger: "dm_kernel:one_sided_sqlite",
    });
  });

  it("skips when kernel authority is inactive", async () => {
    vi.mocked(isDmKernelAuthority).mockReturnValue(false);

    const result = await requestDmKernelRelayBackfill({
      profileId: "default",
      conversationId: "dm:aa:bb",
      peerPubkey: "bb".repeat(64),
      reason: "manual",
    });

    expect(result.requested).toBe(false);
    expect(result.reason).toBe("not_dm_kernel_authority");
    expect(maybeScheduleNativeDmRelayBackfillRepair).not.toHaveBeenCalled();
  });

  it("surfaces cooldown skip from native repair scheduler", async () => {
    vi.mocked(maybeScheduleNativeDmRelayBackfillRepair).mockReturnValue(false);

    const result = await requestDmKernelRelayBackfill({
      profileId: "default",
      conversationId: "dm:aa:bb",
      peerPubkey: "bb".repeat(64),
      reason: "cold_start",
    });

    expect(result.requested).toBe(false);
    expect(result.reason).toBe("cooldown_or_ineligible");
  });
});
