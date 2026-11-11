import type { HostEnginePort } from "@obscur/engine-contracts";
import {
  guardPrivateTrustSendFace,
  listPrivateTrustConversationsViaHost,
  listPrivateTrustMessagesViaHost,
  resolveActiveProtocolIdFromEvidence,
  sendPrivateTrustT3ViaHost,
  type DeliverHomeEnvelope,
  type PrivateTrustProtocolId,
} from "@obscur/private-trust-engine";
import type { PrivateTrustHomePorts } from "./ports";

/**
 * Cut 4.2 — native PrivateTrustHomePorts via HostEnginePort + T3 helpers.
 * No apps/pwa feature imports. Home envelope delivery is injectable.
 */

export type CreateNativePrivateTrustHomePortsParams = Readonly<{
  host: HostEnginePort;
  profileId: string;
  windowLabel?: string;
  preferPrivateDc?: boolean;
  /** Required for private_dc send — Vite supplies lab/home client without pwa import. */
  deliverHomeEnvelope: DeliverHomeEnvelope;
  initialProtocolId?: PrivateTrustProtocolId | null;
}>;

export const createNativePrivateTrustHomePorts = (
  params: CreateNativePrivateTrustHomePortsParams,
): PrivateTrustHomePorts => {
  let storedProtocolId: PrivateTrustProtocolId | null = params.initialProtocolId ?? null;
  const preferPrivateDc = params.preferPrivateDc !== false;

  const resolveActive = (): PrivateTrustProtocolId => resolveActiveProtocolIdFromEvidence({
    storedProtocolId,
    preferPrivateDcWhenNoStored: preferPrivateDc,
  });

  return {
    resolveProtocolId: resolveActive,
    setProtocolId: (protocolId) => {
      storedProtocolId = protocolId;
    },
    listConversations: async () => listPrivateTrustConversationsViaHost({
      host: params.host,
      profileId: params.profileId,
      windowLabel: params.windowLabel,
    }),
    listMessages: async (conversationId) => listPrivateTrustMessagesViaHost({
      host: params.host,
      profileId: params.profileId,
      windowLabel: params.windowLabel,
      conversationId,
    }),
    sendDm: async ({ conversationId, body, carrier }) => {
      const active = resolveActive();
      const guarded = guardPrivateTrustSendFace({
        activeProtocolId: active,
        requestedCarrier: carrier,
        body,
      });
      if (guarded) {
        return guarded;
      }
      if (carrier !== active) {
        return {
          ok: false,
          reasonCode: "send_failed",
          error: `Carrier ${carrier} does not match active face ${active}`,
        };
      }
      if (carrier !== "private_dc") {
        return {
          ok: false,
          reasonCode: "send_failed",
          error: `Native Vite home send supports private_dc only (got ${carrier})`,
        };
      }
      try {
        const sent = await sendPrivateTrustT3ViaHost({
          host: params.host,
          profileId: params.profileId,
          windowLabel: params.windowLabel,
          conversationId,
          peerPubkey: conversationId,
          plaintext: body.trim(),
          deliverHomeEnvelope: params.deliverHomeEnvelope,
        });
        return {
          ok: sent.deliveryStatus === "accepted",
          messageId: sent.messageId,
          deliveryStatus: sent.deliveryStatus,
          ...(sent.deliveryStatus === "failed"
            ? { reasonCode: "send_failed" as const, error: "Home ACK failed" }
            : {}),
        };
      } catch (error) {
        return {
          ok: false,
          reasonCode: "send_failed",
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
};
