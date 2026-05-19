import type { DeliveryReasonCode } from "@dweb/core/security-foundation-contracts";

export type RelayPublishOutcomeContext = Readonly<{
  success: boolean;
  successCount: number;
  totalRelays: number;
  openRelayCount?: number;
  writableRelayCount?: number;
  overallError?: string;
}>;

export const inferRelayPublishReasonCode = (
  context: RelayPublishOutcomeContext,
): DeliveryReasonCode | undefined => {
  if (context.success) {
    return undefined;
  }

  const writableOrOpen = context.writableRelayCount ?? context.openRelayCount ?? 0;
  if (writableOrOpen === 0 || context.totalRelays === 0) {
    return "no_writable_relays";
  }

  if (context.successCount > 0 && context.successCount < context.totalRelays) {
    return "quorum_not_met";
  }

  const normalizedError = (context.overallError ?? "").toLowerCase();
  if (
    normalizedError.includes("closed")
    || normalizedError.includes("timeout")
    || normalizedError.includes("degraded")
  ) {
    return "relay_degraded";
  }

  return "failed";
};

export const getRelayPublishFailureUserMessage = (params: Readonly<{
  reasonCode?: DeliveryReasonCode;
  error?: string;
  successCount?: number;
  totalRelays?: number;
  partialWireDelivery?: boolean;
}>): string => {
  if (params.partialWireDelivery) {
    return "Message left your device but relays have not confirmed delivery yet. Obscur will keep retrying in the background.";
  }

  switch (params.reasonCode) {
    case "no_writable_relays":
      return "No writable relays are connected. Check network settings and try again.";
    case "quorum_not_met":
      return `Relay confirmation was partial (${params.successCount ?? 0}/${params.totalRelays ?? 0}). The message may not reach everyone yet.`;
    case "relay_degraded":
      return "Relay connection is degraded. Delivery could not be confirmed — try again after reconnect.";
    case "offline":
      return "You appear offline. Reconnect and resend.";
    case "failed":
      return params.error?.trim() || "Delivery could not be confirmed. Check your connection and try again.";
    case "retry_scheduled":
      return "Send is queued — Obscur will retry in the background when the network is ready.";
    case "provider_unavailable":
      return "The upload service is unavailable. Try again in a moment.";
    case "upload_timeout":
      return "Upload timed out. Check your connection and try again with a smaller attachment if needed.";
    case "upload_provider_failed":
      return "Upload could not be completed. Try again or pick a different file.";
    case "storage_unavailable":
      return "Local storage is unavailable. Free space or restart the app, then try again.";
    default:
      return params.error?.trim() || "Message could not be confirmed on relays. Check connection and retry.";
  }
};
