import { schnorr } from "@noble/curves/secp256k1";

export const ROOM_KEY_WRAP_SCHEME_V1 = "obscur.nip04_room_key_wrap.v1" as const;

export type RoomKeyWrapScheme = typeof ROOM_KEY_WRAP_SCHEME_V1;

export type RoomKeyWrapWire = Readonly<{
  communityId: string;
  subjectPubkey: string;
  wrapSeq: number;
  scheme: RoomKeyWrapScheme;
  ciphertext: string;
  actorPubkey: string;
  createdAtUnixMs: number;
  signature: string;
}>;

const bytesToHex = (bytes: Uint8Array): string => {
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i]!.toString(16).padStart(2, "0");
  }
  return out;
};

const sha256Hex = async (input: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return bytesToHex(new Uint8Array(digest));
};

const normalizePubkey = (pubkey: string): string => pubkey.trim().toLowerCase();

export const buildRoomKeyWrapSignPayload = (params: Readonly<{
  communityId: string;
  subjectPubkey: string;
  wrapSeq: number;
  scheme: RoomKeyWrapScheme;
  ciphertext: string;
  actorPubkey: string;
  createdAtUnixMs: number;
}>): string => JSON.stringify({
  communityId: params.communityId.trim(),
  subjectPubkey: normalizePubkey(params.subjectPubkey),
  wrapSeq: params.wrapSeq,
  scheme: params.scheme,
  ciphertext: params.ciphertext.trim(),
  actorPubkey: normalizePubkey(params.actorPubkey),
  createdAtUnixMs: params.createdAtUnixMs,
});

export const signRoomKeyWrap = async (params: Readonly<{
  communityId: string;
  subjectPubkey: string;
  wrapSeq: number;
  scheme: RoomKeyWrapScheme;
  ciphertext: string;
  actorPubkey: string;
  createdAtUnixMs: number;
  actorPrivateKeyHex: string;
}>): Promise<string> => {
  const payload = buildRoomKeyWrapSignPayload(params);
  const hashHex = await sha256Hex(payload);
  const signature = await schnorr.sign(hashHex, params.actorPrivateKeyHex);
  return typeof signature === "string" ? signature : bytesToHex(signature);
};

export const verifyRoomKeyWrapSignature = async (
  params: Readonly<{
    communityId: string;
    subjectPubkey: string;
    wrapSeq: number;
    scheme: RoomKeyWrapScheme;
    ciphertext: string;
    actorPubkey: string;
    createdAtUnixMs: number;
    signature: string;
  }>,
): Promise<boolean> => {
  const payload = buildRoomKeyWrapSignPayload({
    communityId: params.communityId,
    subjectPubkey: params.subjectPubkey,
    wrapSeq: params.wrapSeq,
    scheme: params.scheme,
    ciphertext: params.ciphertext,
    actorPubkey: params.actorPubkey,
    createdAtUnixMs: params.createdAtUnixMs,
  });
  const hashHex = await sha256Hex(payload);
  try {
    return schnorr.verify(params.signature, hashHex, normalizePubkey(params.actorPubkey));
  } catch {
    return false;
  }
};
