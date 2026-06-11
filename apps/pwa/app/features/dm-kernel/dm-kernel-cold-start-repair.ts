import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { logAppEvent } from "@/app/shared/log-app-event";
import {
  runNativeDmSqliteProfileRepairScan,
  type NativeDmSqliteRepairScanReport,
} from "@/app/features/messaging/services/native-dm-sqlite-repair";
import { isDmKernelAuthority } from "./dm-kernel-policy";

const emptyReport = (profileId: string): NativeDmSqliteRepairScanReport => ({
  profileId,
  scannedConversationCount: 0,
  oneSidedConversations: [],
  repairRequested: false,
});

/**
 * Background profile scan after unlock — requests relay backfill for one-sided SQLite threads.
 * Non-blocking; respects native repair cooldown.
 */
export const scheduleDmKernelColdStartRepair = async (params: Readonly<{
  profileId: string;
  myPublicKeyHex: PublicKeyHex;
}>): Promise<NativeDmSqliteRepairScanReport> => {
  const profileId = params.profileId.trim();
  if (!profileId || !isDmKernelAuthority()) {
    return emptyReport(profileId);
  }

  const report = await runNativeDmSqliteProfileRepairScan({
    profileId,
    myPublicKeyHex: params.myPublicKeyHex,
    trigger: "dm_kernel:cold_start",
    requestBackfill: true,
  });

  if (report.oneSidedConversations.length > 0) {
    logAppEvent({
      name: "dm_kernel.cold_start_repair",
      level: report.repairRequested ? "warn" : "info",
      scope: { feature: "messaging", action: "dm_kernel_cold_start_repair" },
      context: {
        profileId,
        oneSidedCount: report.oneSidedConversations.length,
        repairRequested: report.repairRequested,
        scannedConversationCount: report.scannedConversationCount,
      },
    });
  }

  return report;
};
