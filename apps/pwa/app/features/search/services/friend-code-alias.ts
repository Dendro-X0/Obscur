import type { UnsignedNostrEvent } from "@/app/features/crypto/crypto-service";
import { isValidInviteCode } from "@/app/features/invites/utils/invite-parser";
import { parsePublicKeyInput } from "@/app/features/profile/utils/parse-public-key-input";
import type { DiscoveryProfileRecord } from "./discovery-cache";

/** NIP-33 parameterized replaceable. Dedicated kind — do not reuse 30078. */
export const FRIEND_CODE_ALIAS_KIND = 31950;
export const FRIEND_CODE_ALIAS_LABEL = "obscur-friend-code";

const HEX_PUBKEY = /^[0-9a-f]{64}$/i;

const tagValue = (tags: unknown, name: string): string | undefined => {
  if (!Array.isArray(tags)) return undefined;
  for (const tag of tags) {
    if (!Array.isArray(tag) || tag[0] !== name) continue;
    const value = typeof tag[1] === "string" ? tag[1].trim() : "";
    if (value) return value;
  }
  return undefined;
};

const parsePubkeyHex = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!HEX_PUBKEY.test(trimmed)) return undefined;
  const parsed = parsePublicKeyInput(trimmed);
  if (!parsed.ok) return undefined;
  return parsed.publicKeyHex.toLowerCase();
};

export type FriendCodeAliasPayload = Readonly<{
  pubkey: string;
  inviteCode: string;
  createdAtUnixSeconds: number;
}>;

export const buildFriendCodeAliasUnsignedEvent = (params: Readonly<{
  pubkey: string;
  inviteCode: string;
  createdAtUnixSeconds?: number;
}>): UnsignedNostrEvent | null => {
  const pubkey = parsePubkeyHex(params.pubkey);
  const inviteCode = params.inviteCode.trim().toUpperCase();
  if (!pubkey || !isValidInviteCode(inviteCode)) {
    return null;
  }
  return {
    kind: FRIEND_CODE_ALIAS_KIND,
    pubkey,
    created_at: params.createdAtUnixSeconds ?? Math.floor(Date.now() / 1000),
    tags: [
      ["d", inviteCode],
      ["p", pubkey],
      ["l", FRIEND_CODE_ALIAS_LABEL],
    ],
    content: JSON.stringify({
      v: 1,
      code: inviteCode,
      pubkey,
    }),
  };
};

export const parseFriendCodeAliasEvent = (event: Readonly<{
  kind?: unknown;
  pubkey?: unknown;
  content?: unknown;
  tags?: unknown;
  created_at?: unknown;
}>): FriendCodeAliasPayload | null => {
  if (event.kind !== FRIEND_CODE_ALIAS_KIND) return null;
  const author = parsePubkeyHex(event.pubkey);
  if (!author) return null;
  if (tagValue(event.tags, "l") !== FRIEND_CODE_ALIAS_LABEL) return null;

  const dTag = tagValue(event.tags, "d")?.toUpperCase();
  const pTag = parsePubkeyHex(tagValue(event.tags, "p"));
  let contentCode: string | undefined;
  let contentPubkey: string | undefined;
  if (typeof event.content === "string" && event.content.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(event.content) as Record<string, unknown>;
      contentCode = typeof parsed.code === "string" ? parsed.code.trim().toUpperCase() : undefined;
      contentPubkey = parsePubkeyHex(parsed.pubkey);
    } catch {
      return null;
    }
  }

  const inviteCode = dTag ?? contentCode;
  if (!inviteCode || !isValidInviteCode(inviteCode)) return null;
  if (contentCode && contentCode !== inviteCode) return null;

  const pointed = pTag ?? contentPubkey ?? author;
  if (pointed !== author) return null;
  if (pTag && pTag !== author) return null;
  if (contentPubkey && contentPubkey !== author) return null;

  const createdAtUnixSeconds = typeof event.created_at === "number" && Number.isFinite(event.created_at)
    ? event.created_at
    : Math.floor(Date.now() / 1000);

  return {
    pubkey: author,
    inviteCode,
    createdAtUnixSeconds,
  };
};

export const profileRecordFromFriendCodeAlias = (
  alias: FriendCodeAliasPayload,
): DiscoveryProfileRecord => ({
  pubkey: alias.pubkey,
  inviteCode: alias.inviteCode,
  updatedAtUnixMs: alias.createdAtUnixSeconds * 1000,
});
