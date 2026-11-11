import type { HostEnginePort } from "@obscur/engine-contracts";
import { completeT3HomeAck, prepareT3Outbound } from "./private-trust-t3";

/**
 * Cut 4.2 — package-facing T3 send orchestration (prepare → home deliver → ACK).
 * Home HTTP stays injectable so Vite never imports apps/pwa private-dc-client.
 * Home ACK accepted ≠ delivered.
 */

export type HomeEnvelopeAck = Readonly<{
  id: string;
  status?: string;
  sentAtUnixMs?: number;
}>;

export type DeliverHomeEnvelope = (
  params: Readonly<{
    conversationId: string;
    envelope: string;
    clientMessageId: string;
  }>,
) => Promise<HomeEnvelopeAck>;

export type SendPrivateTrustT3ViaHostParams = Readonly<{
  host: HostEnginePort;
  profileId: string;
  windowLabel?: string;
  conversationId: string;
  peerPubkey: string;
  plaintext: string;
  deliverHomeEnvelope: DeliverHomeEnvelope;
}>;

export type SendPrivateTrustT3ViaHostResult = Readonly<{
  messageId: string;
  clientMessageId: string;
  deliveryStatus: "accepted" | "failed";
  sentAtUnixMs: number;
}>;

export const sendPrivateTrustT3ViaHost = async (
  params: SendPrivateTrustT3ViaHostParams,
): Promise<SendPrivateTrustT3ViaHostResult> => {
  const prepared = await prepareT3Outbound({
    host: params.host,
    profileId: params.profileId,
    windowLabel: params.windowLabel,
    conversationId: params.conversationId,
    peerPubkey: params.peerPubkey,
    plaintext: params.plaintext,
  });
  const ack = await params.deliverHomeEnvelope({
    conversationId: params.conversationId,
    envelope: prepared.envelope,
    clientMessageId: prepared.clientMessageId,
  });
  const homeMessageId = ack.id.trim();
  if (!homeMessageId) {
    throw new Error("privateTrust home envelope ACK missing id");
  }
  await completeT3HomeAck({
    host: params.host,
    profileId: params.profileId,
    windowLabel: params.windowLabel,
    clientMessageId: prepared.clientMessageId,
    homeMessageId,
  });
  const status = (ack.status ?? "accepted").trim().toLowerCase();
  const deliveryStatus: "accepted" | "failed" = (
    status === "failed" || status === "rejected" ? "failed" : "accepted"
  );
  return {
    messageId: homeMessageId,
    clientMessageId: prepared.clientMessageId,
    deliveryStatus,
    sentAtUnixMs: typeof ack.sentAtUnixMs === "number" ? ack.sentAtUnixMs : Date.now(),
  };
};
