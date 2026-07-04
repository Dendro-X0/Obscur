import { logAppEvent } from "@/app/shared/log-app-event";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import type { Message } from "@/app/features/messaging/types";
import { isDmMessageThreadOneSided, countDmMessageDirections } from "@obscur/dm-engine";
import { requestDmKernelRelayBackfill } from "./dm-kernel-repair";

export type DmKernelDirectionCounts = Readonly<{
  outgoing: number;
  incoming: number;
  total: number;
}>;

const toDirectionRows = (
  messages: ReadonlyArray<Message>,
): ReadonlyArray<Readonly<{ senderPubkey: string }>> => (
  messages.flatMap((message) => {
    const senderPubkey = normalizePublicKeyHex(message.senderPubkey) ?? message.senderPubkey;
    return senderPubkey ? [{ senderPubkey }] : [];
  })
);

export const countDmKernelDirections = (
  messages: ReadonlyArray<Message>,
  myPublicKeyHex: string,
): DmKernelDirectionCounts => {
  const selfHex = normalizePublicKeyHex(myPublicKeyHex) ?? myPublicKeyHex;
  return countDmMessageDirections(toDirectionRows(messages), selfHex);
};

export const isDmKernelOneSided = (
  messages: ReadonlyArray<Message>,
  myPublicKeyHex: string,
): boolean => {
  const selfHex = normalizePublicKeyHex(myPublicKeyHex) ?? myPublicKeyHex;
  return isDmMessageThreadOneSided(toDirectionRows(messages), selfHex);
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
