/**
 * Explicit relay backfill port — NOT the hydrate pipeline.
 * Dispatches native SQLite repair via custom event; transport owner listens and syncs.
 */
import { logAppEvent } from "@/app/shared/log-app-event";
import { maybeScheduleNativeDmRelayBackfillRepair } from "@/app/features/messaging/services/native-dm-sqlite-repair";
import { isDmKernelAuthority } from "./dm-kernel-policy";

export type DmKernelRepairRequest = Readonly<{
  profileId: string;
  conversationId: string;
  peerPubkey: string;
  reason: "one_sided_sqlite" | "cold_start" | "manual";
}>;

export type DmKernelRepairResult = Readonly<{
  requested: boolean;
  reason: string;
}>;

export const requestDmKernelRelayBackfill = async (
  request: DmKernelRepairRequest,
): Promise<DmKernelRepairResult> => {
  if (!isDmKernelAuthority()) {
    logAppEvent({
      name: "dm_kernel.repair_requested",
      level: "info",
      scope: { feature: "messaging", action: "dm_kernel_repair" },
      context: {
        profileId: request.profileId,
        conversationIdHint: request.conversationId.slice(0, 24),
        trigger: request.reason,
        status: "skipped_not_kernel_authority",
      },
    });
    return { requested: false, reason: "not_dm_kernel_authority" };
  }

  const requested = maybeScheduleNativeDmRelayBackfillRepair({
    profileId: request.profileId,
    reason: request.reason,
    conversationId: request.conversationId,
    trigger: `dm_kernel:${request.reason}`,
  });

  logAppEvent({
    name: "dm_kernel.repair_requested",
    level: requested ? "warn" : "info",
    scope: { feature: "messaging", action: "dm_kernel_repair" },
    context: {
      profileId: request.profileId,
      conversationIdHint: request.conversationId.slice(0, 24),
      trigger: request.reason,
      status: requested ? "relay_backfill_dispatched" : "skipped_cooldown_or_ineligible",
    },
  });

  return {
    requested,
    reason: requested ? "relay_backfill_dispatched" : "cooldown_or_ineligible",
  };
};
