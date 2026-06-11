import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: vi.fn(),
}));

vi.mock("./dm-kernel-policy", () => ({
  isDmKernelAuthority: vi.fn(() => true),
}));

vi.mock("@/app/features/messaging/services/native-dm-sqlite-repair", () => ({
  runNativeDmSqliteProfileRepairScan: vi.fn(async () => ({
    profileId: "default",
    scannedConversationCount: 2,
    oneSidedConversations: [{
      conversationId: "dm:aa:bb",
      peerPublicKeyHex: "b".repeat(64),
      outgoing: 3,
      incoming: 0,
      total: 3,
      missingDirection: "incoming" as const,
    }],
    repairRequested: true,
  })),
}));

import { logAppEvent } from "@/app/shared/log-app-event";
import { runNativeDmSqliteProfileRepairScan } from "@/app/features/messaging/services/native-dm-sqlite-repair";
import { isDmKernelAuthority } from "./dm-kernel-policy";
import { scheduleDmKernelColdStartRepair } from "./dm-kernel-cold-start-repair";

describe("scheduleDmKernelColdStartRepair", () => {
  beforeEach(() => {
    vi.mocked(isDmKernelAuthority).mockReturnValue(true);
  });

  it("runs profile repair scan with dm_kernel:cold_start trigger", async () => {
    const myPublicKeyHex = "a".repeat(64) as never;
    const report = await scheduleDmKernelColdStartRepair({
      profileId: "default",
      myPublicKeyHex,
    });

    expect(runNativeDmSqliteProfileRepairScan).toHaveBeenCalledWith({
      profileId: "default",
      myPublicKeyHex,
      trigger: "dm_kernel:cold_start",
      requestBackfill: true,
    });
    expect(report.repairRequested).toBe(true);
    expect(logAppEvent).toHaveBeenCalledWith(expect.objectContaining({
      name: "dm_kernel.cold_start_repair",
    }));
  });

  it("skips when kernel authority is inactive", async () => {
    vi.mocked(isDmKernelAuthority).mockReturnValue(false);

    const report = await scheduleDmKernelColdStartRepair({
      profileId: "default",
      myPublicKeyHex: "a".repeat(64) as never,
    });

    expect(runNativeDmSqliteProfileRepairScan).not.toHaveBeenCalled();
    expect(report.repairRequested).toBe(false);
  });
});
