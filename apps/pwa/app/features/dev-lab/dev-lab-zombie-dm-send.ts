import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { RelayPoolContract } from "@/app/features/messaging/controllers/v2/dm-controller-types";
import { sendDm } from "@/app/features/messaging/controllers/v2/dm-send-pipeline";
import { resolveDevLabPersona } from "./dev-lab-persona";

export type DevLabZombieDmSendResult = Readonly<{
  success: boolean;
  deliveryStatus: string;
  messageId: string;
  error: string | null;
}>;

/**
 * Dev-only: publish a DM signed by an in-memory zombie persona without switching
 * the bound profile slot (avoids ProfileSlotAccountConflictError on Tester1 windows).
 */
export const sendDevLabZombiePersonaDm = async (params: Readonly<{
  pool: RelayPoolContract;
  personaId: string;
  peerPublicKeyHex: string;
  text: string;
  profileId?: string;
}>): Promise<DevLabZombieDmSendResult> => {
  const persona = resolveDevLabPersona(params.personaId);
  if (!persona) {
    return {
      success: false,
      deliveryStatus: "failed",
      messageId: "",
      error: `Dev Lab zombie persona not found: ${params.personaId}`,
    };
  }

  const result = await sendDm({
    pool: params.pool,
    senderPublicKeyHex: persona.publicKeyHex,
    senderPrivateKeyHex: persona.privateKeyHex,
    recipientPublicKeyHex: params.peerPublicKeyHex as PublicKeyHex,
    plaintext: params.text,
    profileId: params.profileId,
  });

  return {
    success: result.success,
    deliveryStatus: result.deliveryStatus,
    messageId: result.messageId,
    error: result.error ?? null,
  };
};
