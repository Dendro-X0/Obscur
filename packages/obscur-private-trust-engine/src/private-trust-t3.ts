import type { HostEnginePort } from "@obscur/engine-contracts";
import {
  buildPrivateTrustCompleteT3HomeAckRequest,
  buildPrivateTrustPrepareT3OutboundRequest,
} from "@obscur/engine-contracts";

export type PrivateTrustT3Params = Readonly<{
  host: HostEnginePort;
  profileId: string;
  windowLabel?: string;
}>;

export type T3OutboundPrepared = Readonly<{
  clientMessageId: string;
  conversationId: string;
  envelope: string;
  status: string;
}>;

export const prepareT3Outbound = async (
  params: PrivateTrustT3Params & Readonly<{
    conversationId: string;
    peerPubkey: string;
    plaintext: string;
  }>,
): Promise<T3OutboundPrepared> => {
  const result = await params.host.invoke(
    buildPrivateTrustPrepareT3OutboundRequest({
      profileId: params.profileId,
      windowLabel: params.windowLabel,
      conversationId: params.conversationId,
      peerPubkey: params.peerPubkey,
      plaintext: params.plaintext,
    }),
  );
  if (!result.ok || !result.data || typeof result.data !== "object") {
    throw new Error(result.errorMessage ?? result.errorCode ?? "privateTrust.prepareT3Outbound failed");
  }
  const data = result.data as Record<string, unknown>;
  const clientMessageId = typeof data.clientMessageId === "string" ? data.clientMessageId : "";
  const conversationId = typeof data.conversationId === "string" ? data.conversationId : "";
  const envelope = typeof data.envelope === "string" ? data.envelope : "";
  const status = typeof data.status === "string" ? data.status : "sending";
  if (!clientMessageId || !envelope) {
    throw new Error("privateTrust.prepareT3Outbound malformed payload");
  }
  return { clientMessageId, conversationId, envelope, status };
};

export const completeT3HomeAck = async (
  params: PrivateTrustT3Params & Readonly<{
    clientMessageId: string;
    homeMessageId: string;
  }>,
): Promise<void> => {
  const result = await params.host.invoke(
    buildPrivateTrustCompleteT3HomeAckRequest({
      profileId: params.profileId,
      windowLabel: params.windowLabel,
      clientMessageId: params.clientMessageId,
      homeMessageId: params.homeMessageId,
    }),
  );
  if (!result.ok) {
    throw new Error(result.errorMessage ?? result.errorCode ?? "privateTrust.completeT3HomeAck failed");
  }
};
