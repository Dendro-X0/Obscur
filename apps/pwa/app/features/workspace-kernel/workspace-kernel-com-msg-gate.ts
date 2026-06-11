import type { Message } from "@/app/features/messaging/types";

export type ComMsgThreadSnapshot = ReadonlyArray<Readonly<Pick<Message, "id" | "content" | "isOutgoing" | "senderPubkey">>>;

export type ComMsgGateEvaluation = Readonly<{
  passed: boolean;
  reason: string;
  profileAMessageIds: ReadonlyArray<string>;
  profileBMessageIds: ReadonlyArray<string>;
}>;

const snapshotMessageIds = (snapshot: ComMsgThreadSnapshot): ReadonlyArray<string> => (
  snapshot.map((message) => message.id).sort()
);

/**
 * COM-MSG programmatic gate — after cold restart both profiles must see the same full thread.
 */
export const evaluateComMsgTwoProfileColdRestartGate = (params: Readonly<{
  profileA: ComMsgThreadSnapshot;
  profileB: ComMsgThreadSnapshot;
  expectedMessageIds: ReadonlyArray<string>;
}>): ComMsgGateEvaluation => {
  const expected = [...params.expectedMessageIds].sort();
  const profileAIds = snapshotMessageIds(params.profileA);
  const profileBIds = snapshotMessageIds(params.profileB);

  const aMatches = expected.length === profileAIds.length
    && expected.every((id, index) => id === profileAIds[index]);
  const bMatches = expected.length === profileBIds.length
    && expected.every((id, index) => id === profileBIds[index]);

  if (!aMatches || !bMatches) {
    return {
      passed: false,
      reason: !aMatches && !bMatches
        ? "both_profiles_missing_messages"
        : !aMatches
          ? "profile_a_missing_messages"
          : "profile_b_missing_messages",
      profileAMessageIds: profileAIds,
      profileBMessageIds: profileBIds,
    };
  }

  const hasBidirectional = params.profileA.some((message) => message.isOutgoing)
    && params.profileA.some((message) => !message.isOutgoing);

  if (!hasBidirectional) {
    return {
      passed: false,
      reason: "one_sided_thread",
      profileAMessageIds: profileAIds,
      profileBMessageIds: profileBIds,
    };
  }

  return {
    passed: true,
    reason: "com_msg_ok",
    profileAMessageIds: profileAIds,
    profileBMessageIds: profileBIds,
  };
};

export const buildComMsgBidirectionalScenarioSnapshots = (params: Readonly<{
  selfPubkey: string;
  peerPubkey: string;
  outgoingIds: ReadonlyArray<string>;
  incomingIds: ReadonlyArray<string>;
}>): Readonly<{ profileA: ComMsgThreadSnapshot; profileB: ComMsgThreadSnapshot; expectedMessageIds: ReadonlyArray<string> }> => {
  const profileA: ComMsgThreadSnapshot = [
    ...params.incomingIds.map((id, index) => ({
      id,
      content: `in-${index}`,
      isOutgoing: false,
      senderPubkey: params.peerPubkey,
    })),
    ...params.outgoingIds.map((id, index) => ({
      id,
      content: `out-${index}`,
      isOutgoing: true,
      senderPubkey: params.selfPubkey,
    })),
  ];
  const profileB: ComMsgThreadSnapshot = profileA.map((message) => ({
    ...message,
    isOutgoing: message.senderPubkey === params.peerPubkey ? false : true,
  }));
  const expectedMessageIds = [...params.incomingIds, ...params.outgoingIds].sort();
  return { profileA, profileB, expectedMessageIds };
};
