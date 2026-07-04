export type DmRepairReason = "one_sided_sqlite" | "cold_start" | "manual";

export type DmRepairRequest = Readonly<{
  profileId: string;
  conversationId: string;
  peerPubkey: string;
  reason: DmRepairReason;
}>;

export type DmRepairResult = Readonly<{
  requested: boolean;
  reason: string;
}>;

export type DmRepairTelemetry = Readonly<{
  level: "info" | "warn";
  status: string;
  request: DmRepairRequest;
}>;

export type DmRepairPort = Readonly<{
  scheduleRelayBackfill: (params: Readonly<{
    profileId: string;
    reason: DmRepairReason;
    conversationId: string;
    trigger: string;
  }>) => boolean;
}>;

/** Cold-start / one-sided repair — dispatches through injected port only. */
export const requestDmRelayBackfill = async (params: Readonly<{
  kernelAuthority: boolean;
  port: DmRepairPort;
  request: DmRepairRequest;
  emitTelemetry?: (event: DmRepairTelemetry) => void;
}>): Promise<DmRepairResult> => {
  if (!params.kernelAuthority) {
    params.emitTelemetry?.({
      level: "info",
      status: "skipped_not_kernel_authority",
      request: params.request,
    });
    return { requested: false, reason: "not_dm_kernel_authority" };
  }

  const requested = params.port.scheduleRelayBackfill({
    profileId: params.request.profileId,
    reason: params.request.reason,
    conversationId: params.request.conversationId,
    trigger: `dm_kernel:${params.request.reason}`,
  });

  params.emitTelemetry?.({
    level: requested ? "warn" : "info",
    status: requested ? "relay_backfill_dispatched" : "skipped_cooldown_or_ineligible",
    request: params.request,
  });

  return {
    requested,
    reason: requested ? "relay_backfill_dispatched" : "cooldown_or_ineligible",
  };
};
