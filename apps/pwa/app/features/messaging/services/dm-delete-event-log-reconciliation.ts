/**
 * @deprecated Use `messagingClientOperations.reconcileAccountEventLog`.
 */
import { messagingClientOperations } from "./messaging-client-operations";

export type ReconcileDmDeleteSuppressionWithEventLogParams = Readonly<{
  profileId: string;
  accountPublicKeyHex: string;
  extraMessageIds?: ReadonlyArray<string>;
  replayProjection?: boolean;
}>;

export async function reconcileDmDeleteSuppressionWithEventLog(
  params: ReconcileDmDeleteSuppressionWithEventLogParams,
): Promise<Readonly<{ redactedCount: number; removedEventsAppended: number }>> {
  return messagingClientOperations.reconcileAccountEventLog(params);
}

/** @deprecated Alias for `reconcileDmDeleteSuppressionWithEventLog`. */
export const reconcileDmDeleteEventLog = reconcileDmDeleteSuppressionWithEventLog;
