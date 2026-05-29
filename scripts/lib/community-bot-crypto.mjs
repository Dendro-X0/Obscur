/**
 * B1 outbound bot — sealed community chat publish (Node sidecar).
 * Matches apps/pwa crypto-service-impl group encryption (AES-GCM, ?v=1).
 */
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const requireFromPwa = createRequire(resolve(repoRoot, "apps/pwa/package.json"));
const requireFromDwebCrypto = createRequire(resolve(repoRoot, "packages/dweb-crypto/package.json"));
const { nip19 } = requireFromPwa("nostr-tools");
const { getPublicKey } = requireFromDwebCrypto("@noble/secp256k1");
const { schnorr } = requireFromPwa("@noble/curves/secp256k1");

const SEALED_COMMUNITY_KIND = 10105;

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

const toBase64 = (bytes) => Buffer.from(bytes).toString("base64");

export const decodePrivateKeyInput = (input) => {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("nsec")) {
    try {
      const decoded = nip19.decode(trimmed);
      if (decoded.type === "nsec") {
        return toHex(decoded.data);
      }
    } catch {
      return null;
    }
  }
  if (/^[0-9a-f]{64}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return null;
};

export const derivePublicKeyHexFromPrivate = (privateKeyHex) => {
  const privateKeyBytes = hexToBytes(privateKeyHex);
  return toHex(getPublicKey(privateKeyBytes, true));
};

const sha256Hex = async (payload) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return toHex(new Uint8Array(digest));
};

export const createNostrEvent = async (params) => {
  const pubkey = derivePublicKeyHexFromPrivate(params.privateKeyHex);
  const created_at = params.createdAtUnixSeconds ?? Math.floor(Date.now() / 1000);
  const kind = params.kind ?? 1;
  const tags = params.tags ?? [];
  const template = { pubkey, created_at, kind, tags, content: params.content };
  const id = await sha256Hex(JSON.stringify([0, pubkey, created_at, kind, tags, params.content]));
  const sig = toHex(await schnorr.sign(id, params.privateKeyHex));
  return { ...template, id, sig };
};

export const encryptGroupMessage = async (plaintext, roomKeyHex) => {
  const keyBytes = hexToBytes(roomKeyHex);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    new TextEncoder().encode(plaintext),
  );
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  return `${toBase64(combined)}?v=1`;
};

/**
 * Build kind 10105 sealed chat event (inner kind 9).
 */
export const buildSealedCommunityAnnouncementEvent = async (params) => {
  const groupId = params.groupId.trim();
  const roomKeyHex = params.roomKeyHex.trim().toLowerCase();
  const privateKeyHex = params.privateKeyHex.trim().toLowerCase();
  const content = params.content.trim();
  if (!groupId) throw new Error("groupId is required");
  if (!content) throw new Error("message content is required");
  if (!/^[0-9a-f]{64}$/.test(roomKeyHex)) throw new Error("roomKeyHex must be 64-char hex");
  if (!/^[0-9a-f]{64}$/.test(privateKeyHex)) throw new Error("privateKeyHex must be 64-char hex");

  const pubkey = derivePublicKeyHexFromPrivate(privateKeyHex);
  const created_at = Math.floor(Date.now() / 1000);
  const innerPayload = JSON.stringify({
    kind: 9,
    content,
    created_at,
    pubkey,
  });
  const encrypted = await encryptGroupMessage(innerPayload, roomKeyHex);
  return createNostrEvent({
    privateKeyHex,
    kind: SEALED_COMMUNITY_KIND,
    createdAtUnixSeconds: created_at,
    tags: [["h", groupId]],
    content: JSON.stringify(encrypted),
  });
};

export const assertBotPubkeyAllowlisted = (params) => {
  const botPubkey = derivePublicKeyHexFromPrivate(params.privateKeyHex).toLowerCase();
  const allowed = params.allowedBotPubkeys
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => /^[0-9a-f]{64}$/.test(entry));
  if (allowed.length === 0) {
    return { botPubkey, skipped: true };
  }
  if (!allowed.includes(botPubkey)) {
    throw new Error(
      `Bot pubkey ${botPubkey.slice(0, 8)}… is not in OBSCUR_BOT_ALLOWED_PUBKEYS — register it in Manage → General → Outbound bots`,
    );
  }
  return { botPubkey, skipped: false };
};

export const publishEventToRelay = async ({ relayUrl, event, timeoutMs = 12_000 }) => {
  const ws = new WebSocket(relayUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("WebSocket open timeout")), timeoutMs);
    ws.addEventListener("open", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("WebSocket connection failed"));
    }, { once: true });
  });

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      try { ws.close(); } catch { /* ignore */ }
      reject(new Error("Relay publish timeout"));
    }, timeoutMs);

    const onMessage = (messageEvent) => {
      if (typeof messageEvent.data !== "string") return;
      try {
        const parsed = JSON.parse(messageEvent.data);
        if (!Array.isArray(parsed) || parsed[0] !== "OK" || parsed[1] !== event.id) return;
        clearTimeout(timer);
        ws.removeEventListener("message", onMessage);
        try { ws.close(); } catch { /* ignore */ }
        if (parsed[2] === true) {
          resolve({ ok: true, message: typeof parsed[3] === "string" ? parsed[3] : "ok" });
          return;
        }
        reject(new Error(typeof parsed[3] === "string" ? parsed[3] : "relay rejected EVENT"));
      } catch {
        // ignore non-OK frames
      }
    };

    ws.addEventListener("message", onMessage);
    ws.send(JSON.stringify(["EVENT", event]));
  });
};

export { SEALED_COMMUNITY_KIND };
