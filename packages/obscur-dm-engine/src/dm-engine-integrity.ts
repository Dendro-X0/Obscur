export type DmMessageDirectionCounts = Readonly<{
  outgoing: number;
  incoming: number;
  total: number;
}>;

export type DmDirectionProbe = Readonly<{
  senderPubkey: string;
}>;

export const countDmMessageDirections = (
  messages: ReadonlyArray<DmDirectionProbe>,
  myPublicKeyHex: string,
): DmMessageDirectionCounts => {
  const self = myPublicKeyHex.trim().toLowerCase();
  let outgoing = 0;
  let incoming = 0;

  for (const message of messages) {
    const sender = message.senderPubkey.trim().toLowerCase();
    if (self && sender === self) {
      outgoing += 1;
    } else {
      incoming += 1;
    }
  }

  return { outgoing, incoming, total: messages.length };
};

export const isDmMessageThreadOneSided = (
  messages: ReadonlyArray<DmDirectionProbe>,
  myPublicKeyHex: string,
): boolean => {
  const counts = countDmMessageDirections(messages, myPublicKeyHex);
  return counts.total > 0 && (counts.outgoing === 0 || counts.incoming === 0);
};
