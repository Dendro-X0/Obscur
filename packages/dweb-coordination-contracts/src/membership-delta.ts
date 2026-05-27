import { schnorr } from "@noble/curves/secp256k1";

export type MembershipDeltaAction = "join" | "leave" | "expel";

export type MembershipDeltaWire = Readonly<{
  communityId: string;
  seq: number;
  action: MembershipDeltaAction;
  subjectPubkey: string;
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

export const buildMembershipDeltaSignPayload = (params: Readonly<{
  communityId: string;
  action: MembershipDeltaAction;
  subjectPubkey: string;
  actorPubkey: string;
  createdAtUnixMs: number;
}>): string => JSON.stringify({
  communityId: params.communityId.trim(),
  action: params.action,
  subjectPubkey: params.subjectPubkey.trim().toLowerCase(),
  actorPubkey: params.actorPubkey.trim().toLowerCase(),
  createdAtUnixMs: params.createdAtUnixMs,
});

export const signMembershipDelta = async (params: Readonly<{
  communityId: string;
  action: MembershipDeltaAction;
  subjectPubkey: string;
  actorPubkey: string;
  createdAtUnixMs: number;
  actorPrivateKeyHex: string;
}>): Promise<string> => {
  const payload = buildMembershipDeltaSignPayload(params);
  const hashHex = await sha256Hex(payload);
  const signature = await schnorr.sign(hashHex, params.actorPrivateKeyHex);
  return typeof signature === "string" ? signature : bytesToHex(signature);
};

export const verifyMembershipDeltaSignature = async (
  params: Readonly<{
    communityId: string;
    action: MembershipDeltaAction;
    subjectPubkey: string;
    actorPubkey: string;
    createdAtUnixMs: number;
    signature: string;
  }>,
): Promise<boolean> => {
  const payload = buildMembershipDeltaSignPayload({
    communityId: params.communityId,
    action: params.action,
    subjectPubkey: params.subjectPubkey,
    actorPubkey: params.actorPubkey,
    createdAtUnixMs: params.createdAtUnixMs,
  });
  const hashHex = await sha256Hex(payload);
  try {
    return schnorr.verify(params.signature, hashHex, params.actorPubkey);
  } catch {
    return false;
  }
};
