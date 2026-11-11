/**
 * Cut 1.4 — private-trust send face: prepareT3Outbound → H-dc envelope → completeT3HomeAck.
 */

import type { HostEnginePort } from "@obscur/engine-contracts";
import { createTauriEngineHost, isTauriEngineHostAvailable } from "@obscur/engine-host/tauri";
import {
  completeT3HomeAck,
  prepareT3Outbound,
} from "@obscur/private-trust-engine";
import type { CanonicalMessage } from "./types";
import { privateDcSendEnvelope } from "./private-dc-client";
import { readPrivateDcSession } from "./private-dc-session";
import {
  PRIVATE_DC_T3_ENGINE_UNAVAILABLE,
  privateDcRequiresT3Wire,
} from "./private-trust-send-policy";
import { mapHomeAckToStatus } from "./hdc-outbox-status";

let injectedHost: HostEnginePort | null = null;
let fetchImpl: typeof fetch = fetch;

export const setPrivateTrustT3HostForTests = (host: HostEnginePort | null): void => {
  injectedHost = host;
};

export const setPrivateTrustT3FetchForTests = (next: typeof fetch): void => {
  fetchImpl = next;
};

export const resetPrivateTrustT3FetchForTests = (): void => {
  fetchImpl = fetch;
};

const resolveHost = (): HostEnginePort => {
  if (injectedHost) {
    return injectedHost;
  }
  if (!isTauriEngineHostAvailable()) {
    throw new Error(PRIVATE_DC_T3_ENGINE_UNAVAILABLE);
  }
  return createTauriEngineHost();
};

export type SendPrivateTrustT3Params = Readonly<{
  profileId: string;
  conversationId: string;
  peerPubkey: string;
  plaintext: string;
}>;

/**
 * Canonical private-trust send when `privateDcRequiresT3Wire()`.
 * Never POSTs plaintext `body` to the home.
 */
export const sendPrivateTrustT3Message = async (
  params: SendPrivateTrustT3Params,
): Promise<CanonicalMessage> => {
  if (!privateDcRequiresT3Wire()) {
    throw new Error("sendPrivateTrustT3Message requires T3 wire policy");
  }
  const session = readPrivateDcSession(params.profileId);
  if (!session) {
    throw new Error("PrivateDcAdapter: no session — configure Settings → Protocols → Private DC");
  }
  const host = resolveHost();
  const prepared = await prepareT3Outbound({
    host,
    profileId: params.profileId,
    conversationId: params.conversationId,
    peerPubkey: params.peerPubkey,
    plaintext: params.plaintext,
  });
  const ack = await privateDcSendEnvelope(session, {
    conversationId: params.conversationId,
    envelope: prepared.envelope,
    clientMessageId: prepared.clientMessageId,
  }, fetchImpl);
  await completeT3HomeAck({
    host,
    profileId: params.profileId,
    clientMessageId: prepared.clientMessageId,
    homeMessageId: ack.id,
  });
  const status = mapHomeAckToStatus(ack.status);
  return {
    id: ack.id,
    conversationId: params.conversationId,
    // Ciphertext on wire — UI must not treat this as plaintext transcript.
    body: "",
    sentAtUnixMs: ack.sentAtUnixMs,
    direction: "out",
    status: status === "accepted" ? "sent" : status === "failed" || status === "rejected" ? "failed" : "sending",
  };
};
