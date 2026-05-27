import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { resolveAuthorEvidencePubkeysFromCommunityMessages } from "../services/community-message-author-evidence";

const normalizePubkey = (value: string): string => value.trim().toLowerCase();

export const getLatestCommunityMessageUnixMsByPubkey = (
  messages: ReadonlyArray<Readonly<{ pubkey?: string | null; created_at?: number }>>,
): ReadonlyMap<string, number> => {
  const latestByPubkey = new Map<string, number>();
  messages.forEach((message) => {
    const pubkey = typeof message.pubkey === "string" ? message.pubkey.trim() : "";
    if (!pubkey) {
      return;
    }
    const createdAtRaw = message.created_at;
    if (typeof createdAtRaw !== "number" || !Number.isFinite(createdAtRaw)) {
      return;
    }
    const createdAtMs = createdAtRaw < 1_000_000_000_000
      ? Math.floor(createdAtRaw * 1000)
      : Math.floor(createdAtRaw);
    const key = normalizePubkey(pubkey);
    const existing = latestByPubkey.get(key);
    if (existing === undefined || createdAtMs > existing) {
      latestByPubkey.set(key, createdAtMs);
    }
  });
  return latestByPubkey;
};

/** Stale relay leave replay must not override newer sealed chat participation. */
export const shouldSuppressStaleCommunityMemberRemoval = (params: Readonly<{
  subjectPubkey: string;
  removalAtUnixMs: number;
  communityMessages: ReadonlyArray<Readonly<{ pubkey?: string | null; created_at?: number }>>;
}>): boolean => {
  const subjectKey = normalizePubkey(params.subjectPubkey);
  if (!subjectKey) {
    return false;
  }
  const latestMessageAtMs = getLatestCommunityMessageUnixMsByPubkey(params.communityMessages).get(subjectKey);
  if (latestMessageAtMs === undefined) {
    return false;
  }
  const removalAtMs = params.removalAtUnixMs < 1_000_000_000_000
    ? Math.floor(params.removalAtUnixMs * 1000)
    : Math.floor(params.removalAtUnixMs);
  return latestMessageAtMs >= removalAtMs;
};

/** Pubkeys that disprove terminal left/expel (chat, roster seed, relay-active). */
export const resolveCommunityParticipationPubkeys = (params: Readonly<{
  communityMessages?: ReadonlyArray<Readonly<{ pubkey?: string | null }>>;
  additionalParticipationPubkeys?: ReadonlyArray<PublicKeyHex | string>;
}>): ReadonlyArray<PublicKeyHex> => (
  Array.from(new Set(
    [
      ...resolveAuthorEvidencePubkeysFromCommunityMessages(params.communityMessages ?? []),
      ...(params.additionalParticipationPubkeys ?? []),
    ]
      .map((pubkey) => pubkey.trim())
      .filter((pubkey) => pubkey.length > 0),
  )) as ReadonlyArray<PublicKeyHex>
);

export const filterTerminalMembersWithoutParticipationEvidence = (params: Readonly<{
  leftMemberPubkeys: ReadonlyArray<PublicKeyHex | string>;
  expelledMemberPubkeys?: ReadonlyArray<PublicKeyHex | string>;
  communityMessages: ReadonlyArray<Readonly<{ pubkey?: string | null; created_at?: number }>>;
  additionalParticipationPubkeys?: ReadonlyArray<PublicKeyHex | string>;
}>): Readonly<{
  leftMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  expelledMemberPubkeys: ReadonlyArray<PublicKeyHex>;
}> => {
  const participationSet = new Set(
    resolveCommunityParticipationPubkeys({
      communityMessages: params.communityMessages,
      additionalParticipationPubkeys: params.additionalParticipationPubkeys,
    }).map(normalizePubkey),
  );
  const filterList = (list: ReadonlyArray<PublicKeyHex | string>): ReadonlyArray<PublicKeyHex> => (
    list
      .map((pubkey) => pubkey.trim() as PublicKeyHex)
      .filter((pubkey) => pubkey.length > 0 && !participationSet.has(normalizePubkey(pubkey)))
  );
  return {
    leftMemberPubkeys: filterList(params.leftMemberPubkeys),
    expelledMemberPubkeys: filterList(params.expelledMemberPubkeys ?? []),
  };
};
