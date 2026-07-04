/**
 * Explicit relay backfill port — NOT the hydrate pipeline.
 * Repair policy lives in @obscur/dm-engine; host supplies native scheduler.
 */
import { logAppEvent } from "@/app/shared/log-app-event";
import { maybeScheduleNativeDmRelayBackfillRepair } from "@/app/features/messaging/services/native-dm-sqlite-repair";
import {
  requestDmRelayBackfill,
  type DmRepairRequest,
  type DmRepairResult,
} from "@obscur/dm-engine";
import { isDmKernelAuthority } from "./dm-kernel-policy";

export type DmKernelRepairRequest = DmRepairRequest;
export type DmKernelRepairResult = DmRepairResult;

export const requestDmKernelRelayBackfill = async (
  request: DmKernelRepairRequest,
): Promise<DmKernelRepairResult> => (
  requestDmRelayBackfill({
    kernelAuthority: isDmKernelAuthority(),
    port: {
      scheduleRelayBackfill: maybeScheduleNativeDmRelayBackfillRepair,
    },
    request,
    emitTelemetry: ({ level, status, request: repairRequest }) => {
      logAppEvent({
        name: "dm_kernel.repair_requested",
        level,
        scope: { feature: "messaging", action: "dm_kernel_repair" },
        context: {
          profileId: repairRequest.profileId,
          conversationIdHint: repairRequest.conversationId.slice(0, 24),
          trigger: repairRequest.reason,
          status,
        },
      });
    },
  })
);
