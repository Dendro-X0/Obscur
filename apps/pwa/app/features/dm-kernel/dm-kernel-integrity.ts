import { logAppEvent } from "@/app/shared/log-app-event";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import type { Message } from "@/app/features/messaging/types";
import { requestDmKernelRelayBackfill } from "./dm-kernel-repair";

export type DmKernelDirectionCounts = Readonly<{
  outgoing: number;
  incoming: number;
  total: number;
}>;

export const countDmKernelDirections = (
  messages: ReadonlyArray<Message>,
  myPublicKeyHex: string,
): DmKernelDirectionCounts => {
  const self = normalizePublicKeyHex(myPublicKeyHex);
  let outgoing = 0;
  let incoming = 0;

  for (const message of messages) {
    const sender = normalizePublicKeyHex(message.senderPubkey);
    if (self && sender === self) {
      outgoing += 1;
    } else {
      incoming += 1;
    }
  }

  return { outgoing, incoming, total: messages.length };
};

export const isDmKernelOneSided = (
  messages: ReadonlyArray<Message>,
  myPublicKeyHex: string,
): boolean => {
  const counts = countDmKernelDirections(messages, myPublicKeyHex);
  return counts.total > 0 && (counts.outgoing === 0 || counts.incoming === 0);
};

export const logDmKernelOneSidedIfNeeded = (params: Readonly<{
  conversationId: string;
  messages: ReadonlyArray<Message>;
  myPublicKeyHex: string;
  profileId?: string;
  peerPubkey?: string;
}>): void => {
  if (!isDmKernelOneSided(params.messages, params.myPublicKeyHex)) {
    return;
  }

  const counts = countDmKernelDirections(params.messages, params.myPublicKeyHex);
  logAppEvent({
    name: "dm_kernel.one_sided_sqlite",
    level: "warn",
    scope: { feature: "messaging", action: "dm_kernel_integrity" },
    context: {
      conversationId: params.conversationId,
      outgoing: counts.outgoing,
      incoming: counts.incoming,
      total: counts.total,
    },
  });

  if (params.profileId && params.peerPubkey) {
    void requestDmKernelRelayBackfill({
      profileId: params.profileId,
      conversationId: params.conversationId,
      peerPubkey: params.peerPubkey,
      reason: "one_sided_sqlite",
    });
  }
};
