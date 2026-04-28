import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { dedupeCommunityMemberPubkeys } from "./community-member-roster-projection";

const STORAGE_PREFIX = "obscur.groups.known_participants.v1";

export type CommunityKnownParticipantsEntry = Readonly<{
  conversationId: string;
  groupId: string;
  relayUrl: string;
  communityId?: string;
  participantPubkeys: ReadonlyArray<PublicKeyHex>;
  updatedAtUnixMs: number;
}>;

const getStorageKey = (publicKeyHex: PublicKeyHex): string => (
  getScopedStorageKey(`${STORAGE_PREFIX}.${publicKeyHex}`)
);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

const parseEntry = (value: unknown): CommunityKnownParticipantsEntry | null => {
  if (!isRecord(value)) {
    return null;
  }
  if (
    typeof value.conversationId !== "string"
    || typeof value.groupId !== "string"
    || typeof value.relayUrl !== "string"
    || !Array.isArray(value.participantPubkeys)
    || typeof value.updatedAtUnixMs !== "number"
  ) {
    return null;
  }
  return {
    conversationId: value.conversationId,
    groupId: value.groupId,
    relayUrl: value.relayUrl,
    communityId: typeof value.communityId === "string" ? value.communityId : undefined,
    participantPubkeys: dedupeCommunityMemberPubkeys(
      value.participantPubkeys.filter((entry): entry is string => typeof entry === "string") as ReadonlyArray<PublicKeyHex>
    ),
    updatedAtUnixMs: value.updatedAtUnixMs,
  };
};

const readEntries = (publicKeyHex: PublicKeyHex): ReadonlyArray<CommunityKnownParticipantsEntry> => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(getStorageKey(publicKeyHex));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((entry) => parseEntry(entry))
      .filter((entry): entry is CommunityKnownParticipantsEntry => entry !== null);
  } catch {
    return [];
  }
};

const writeEntries = (publicKeyHex: PublicKeyHex, entries: ReadonlyArray<CommunityKnownParticipantsEntry>): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(getStorageKey(publicKeyHex), JSON.stringify(entries));
  } catch {
    return;
  }
};

export const loadCommunityKnownParticipantsEntries = (
  publicKeyHex: PublicKeyHex,
): ReadonlyArray<CommunityKnownParticipantsEntry> => readEntries(publicKeyHex);

export const upsertCommunityKnownParticipantsEntry = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  entry: CommunityKnownParticipantsEntry;
}>): void => {
  const current = readEntries(params.publicKeyHex);
  const index = current.findIndex((entry) => (
    entry.groupId === params.entry.groupId
    && entry.relayUrl === params.entry.relayUrl
  ));
  const nextEntry = index === -1
    ? params.entry
    : {
        ...current[index],
        conversationId: params.entry.conversationId,
        communityId: params.entry.communityId ?? current[index]?.communityId,
        participantPubkeys: dedupeCommunityMemberPubkeys([
          ...current[index]!.participantPubkeys,
          ...params.entry.participantPubkeys,
        ]),
        updatedAtUnixMs: Math.max(current[index]!.updatedAtUnixMs, params.entry.updatedAtUnixMs),
      };
  const nextEntries = index === -1
    ? [...current, nextEntry]
    : current.map((entry, entryIndex) => (
        entryIndex === index ? nextEntry : entry
      ));
  writeEntries(params.publicKeyHex, nextEntries);
};
