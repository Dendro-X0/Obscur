/**
 * Node-side coordination room-key wrap publish (Slice C fixture backfill).
 */
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const requireFromNostr = createRequire(resolve(repoRoot, "packages/dweb-nostr/package.json"));
const { getSharedSecret } = requireFromNostr("@noble/secp256k1");
const { schnorr } = requireFromNostr("@noble/curves/secp256k1");

export const ROOM_KEY_WRAP_SCHEME_V1 = "obscur.nip04_room_key_wrap.v1";
export const TESTER1_PRIVATE_KEY_HEX = "c09832d637eb265d90b29c12eb8dfcfffe165b8fb34094af75236d5be4d97884";
export const NEWTEST2_GROUP_ID = "b93f53e23d8c4456835afd3f4d3a627b";
export const NEWTEST2_RELAY_URL = "ws://localhost:7000";

const toHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

const hexToBytes = (hex) => {
  const normalized = hex.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error("Expected 64-char hex string");
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i += 1) {
    out[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
};

export const derivePublicKeyHexFromPrivate = (privateKeyHex) => {
  const privateKeyBytes = hexToBytes(privateKeyHex);
  return toHex(schnorr.getPublicKey(privateKeyBytes));
};

export const generateRoomKeyHex = () => toHex(crypto.getRandomValues(new Uint8Array(32)));

export const deriveLegacyCommunityId = (groupId, relayUrl = NEWTEST2_RELAY_URL) => (
  `${groupId.trim()}:${relayUrl.trim()}`
);

const sha256Hex = async (payload) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return toHex(new Uint8Array(digest));
};

const toBase64 = (bytes) => Buffer.from(bytes).toString("base64");

const nip04Encrypt = async ({ senderPrivateKeyHex, recipientPublicKeyHex, plaintext }) => {
  const recipientCompressedHex = `02${recipientPublicKeyHex.trim().toLowerCase()}`;
  const secret = getSharedSecret(senderPrivateKeyHex, recipientCompressedHex);
  const keyBytes = secret.slice(1, 33);
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-CBC" }, false, ["encrypt"]);
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-CBC", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return `${toBase64(new Uint8Array(ciphertextBuffer))}?iv=${toBase64(iv)}`;
};

export const buildRoomKeyWrapSignPayload = (params) => JSON.stringify({
  communityId: params.communityId.trim(),
  subjectPubkey: params.subjectPubkey.trim().toLowerCase(),
  wrapSeq: params.wrapSeq,
  scheme: params.scheme,
  ciphertext: params.ciphertext.trim(),
  actorPubkey: params.actorPubkey.trim().toLowerCase(),
  createdAtUnixMs: params.createdAtUnixMs,
});

export const signRoomKeyWrap = async (params) => {
  const payload = buildRoomKeyWrapSignPayload(params);
  const hashHex = await sha256Hex(payload);
  const signature = await schnorr.sign(hashHex, params.actorPrivateKeyHex);
  return typeof signature === "string" ? signature : toHex(signature);
};

export const buildRoomKeyWrapInnerPayload = (groupId, roomKeyHex) => ({
  v: 1,
  groupId: groupId.trim(),
  roomKeyHex: roomKeyHex.trim().toLowerCase(),
});

export const resolveNextWrapSeqForSubject = (wraps, subjectPubkey) => {
  const normalizedSubject = subjectPubkey.trim().toLowerCase();
  let maxSeq = 0;
  wraps.forEach((wrap) => {
    if ((wrap.subjectPubkey ?? "").trim().toLowerCase() !== normalizedSubject) {
      return;
    }
    if (typeof wrap.wrapSeq === "number" && wrap.wrapSeq > maxSeq) {
      maxSeq = wrap.wrapSeq;
    }
  });
  return maxSeq + 1;
};

export const fetchCoordinationRoomKeyWrapsSince = async (coordinationBaseUrl, communityId, sinceSeq = 0) => {
  const safeSince = Number.isFinite(sinceSeq) && sinceSeq >= 0 ? Math.floor(sinceSeq) : 0;
  const url = `${coordinationBaseUrl.replace(/\/$/, "")}/communities/${encodeURIComponent(communityId.trim())}/membership/room-key-wraps?sinceSeq=${safeSince}`;
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    throw new Error(`wrap_fetch_http_${response.status}`);
  }
  const json = await response.json();
  if (!json || json.ok !== true || !json.data || typeof json.data !== "object") {
    throw new Error("wrap_fetch_invalid_payload");
  }
  return json.data.wraps ?? [];
};

export const signMembershipDelta = async (params) => {
  const payload = JSON.stringify({
    communityId: params.communityId.trim(),
    action: params.action,
    subjectPubkey: params.subjectPubkey.trim().toLowerCase(),
    actorPubkey: params.actorPubkey.trim().toLowerCase(),
    createdAtUnixMs: params.createdAtUnixMs,
  });
  const hashHex = await sha256Hex(payload);
  const signature = await schnorr.sign(hashHex, params.actorPrivateKeyHex);
  return typeof signature === "string" ? signature : toHex(signature);
};

export const ensureCoordinationMembershipJoin = async (params) => {
  const coordinationBaseUrl = params.coordinationBaseUrl.replace(/\/$/, "");
  const communityId = params.communityId.trim();
  const actorPrivateKeyHex = params.actorPrivateKeyHex.trim().toLowerCase();
  const actorPubkey = derivePublicKeyHexFromPrivate(actorPrivateKeyHex);
  const subjectPubkey = (params.subjectPubkey ?? actorPubkey).trim().toLowerCase();
  const createdAtUnixMs = params.createdAtUnixMs ?? Date.now();

  const headResponse = await fetch(
    `${coordinationBaseUrl}/communities/${encodeURIComponent(communityId)}/membership/head`,
  );
  if (headResponse.ok) {
    const headJson = await headResponse.json();
    const seq = headJson?.data?.seq;
    if (typeof seq === "number" && seq > 0) {
      return { joined: true, skipped: true };
    }
  }

  const signature = await signMembershipDelta({
    communityId,
    action: "join",
    subjectPubkey,
    actorPubkey,
    createdAtUnixMs,
    actorPrivateKeyHex,
  });

  const response = await fetch(
    `${coordinationBaseUrl}/communities/${encodeURIComponent(communityId)}/membership/delta`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "join",
        subjectPubkey,
        actorPubkey,
        createdAtUnixMs,
        signature,
      }),
    },
  );

  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.ok !== true) {
    throw new Error(json.error ? String(json.error) : `join_delta_http_${response.status}`);
  }

  return { joined: true, skipped: false };
};

export const publishCoordinationRoomKeyWrapFixture = async (params) => {
  const coordinationBaseUrl = params.coordinationBaseUrl.replace(/\/$/, "");
  const communityId = params.communityId.trim();
  const groupId = params.groupId.trim();
  const actorPrivateKeyHex = params.actorPrivateKeyHex.trim().toLowerCase();
  const actorPubkey = derivePublicKeyHexFromPrivate(actorPrivateKeyHex);
  const subjectPubkey = (params.subjectPubkey ?? actorPubkey).trim().toLowerCase();
  const roomKeyHex = (params.roomKeyHex ?? generateRoomKeyHex()).trim().toLowerCase();

  await ensureCoordinationMembershipJoin({
    coordinationBaseUrl,
    communityId,
    actorPrivateKeyHex,
    subjectPubkey,
  });

  const existingWraps = await fetchCoordinationRoomKeyWrapsSince(coordinationBaseUrl, communityId, 0);
  const wrapSeq = resolveNextWrapSeqForSubject(existingWraps, subjectPubkey);
  const createdAtUnixMs = params.createdAtUnixMs ?? Date.now();
  const inner = buildRoomKeyWrapInnerPayload(groupId, roomKeyHex);
  const ciphertext = await nip04Encrypt({
    senderPrivateKeyHex: actorPrivateKeyHex,
    recipientPublicKeyHex: subjectPubkey,
    plaintext: JSON.stringify(inner),
  });
  const signature = await signRoomKeyWrap({
    communityId,
    subjectPubkey,
    wrapSeq,
    scheme: ROOM_KEY_WRAP_SCHEME_V1,
    ciphertext,
    actorPubkey,
    createdAtUnixMs,
    actorPrivateKeyHex,
  });

  const response = await fetch(
    `${coordinationBaseUrl}/communities/${encodeURIComponent(communityId)}/membership/room-key-wrap`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        subjectPubkey,
        scheme: ROOM_KEY_WRAP_SCHEME_V1,
        ciphertext,
        actorPubkey,
        createdAtUnixMs,
        signature,
      }),
    },
  );

  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.ok !== true) {
    throw new Error(json.error ? String(json.error) : `wrap_publish_http_${response.status}`);
  }

  return {
    communityId,
    groupId,
    subjectPubkey,
    actorPubkey,
    wrapSeq,
    roomKeyHex,
    roomKeySource: params.roomKeyHex ? "provided" : "generated",
  };
};
