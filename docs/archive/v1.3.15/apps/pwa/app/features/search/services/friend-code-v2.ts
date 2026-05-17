"use client";

import type { FriendCodeDecodeResult, FriendCodeV2Payload } from "@/app/features/search/types/discovery";
import { parsePublicKeyInput } from "@/app/features/profile/utils/parse-public-key-input";

const PREFIX = "OB2";

const toBase64Url = (value: string): string => {
  const encoded = typeof window === "undefined"
    ? Buffer.from(value, "utf-8").toString("base64")
    : window.btoa(unescape(encodeURIComponent(value)));
  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const fromBase64Url = (value: string): string => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  if (typeof window === "undefined") {
    return Buffer.from(padded, "base64").toString("utf-8");
  }
  return decodeURIComponent(escape(window.atob(padded)));
};

const checksum4 = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  const normalized = (hash >>> 0).toString(16).toUpperCase();
  return normalized.slice(-4).padStart(4, "0");
};

const normalizeRelays = (relays: ReadonlyArray<string> | undefined): ReadonlyArray<string> | undefined => {
  if (!relays || relays.length === 0) return undefined;
  const unique = Array.from(new Set(relays.map((relay) => relay.trim()).filter((relay) => relay.length > 0)));
  return unique.slice(0, 4);
};

export const encodeFriendCodeV2 = (params: Readonly<{
  pubkey: string;
  relays?: ReadonlyArray<string>;
}>): string | null => {
  const parsed = parsePublicKeyInput(params.pubkey);
  if (!parsed.ok) return null;
  const payload: FriendCodeV2Payload = {
    version: 2,
    pubkey: parsed.publicKeyHex,
    relays: normalizeRelays(params.relays),
  };
  const body = toBase64Url(JSON.stringify(payload));
  const check = checksum4(body);
  return `${PREFIX}-${body}-${check}`;
};

export const decodeFriendCodeV2 = (input: string): FriendCodeDecodeResult => {
  const trimmed = input.trim();
  if (!trimmed.toUpperCase().startsWith(`${PREFIX}-`)) {
    return { ok: false, reason: "invalid_prefix" };
  }
  const parts = trimmed.split("-");
  if (parts.length < 3) {
    return { ok: false, reason: "invalid_payload" };
  }
  const body = parts.slice(1, -1).join("-");
  const check = (parts[parts.length - 1] ?? "").toUpperCase();
  if (checksum4(body) !== check) {
    return { ok: false, reason: "checksum_mismatch" };
  }
  try {
    const parsed = JSON.parse(fromBase64Url(body)) as FriendCodeV2Payload;
    if (parsed.version !== 2 || typeof parsed.pubkey !== "string") {
      return { ok: false, reason: "invalid_payload" };
    }
    const parsedPubkey = parsePublicKeyInput(parsed.pubkey);
    if (!parsedPubkey.ok) {
      return { ok: false, reason: "invalid_pubkey" };
    }
    return {
      ok: true,
      payload: {
        version: 2,
        pubkey: parsedPubkey.publicKeyHex,
        relays: normalizeRelays(parsed.relays),
      },
    };
  } catch {
    return { ok: false, reason: "invalid_payload" };
  }
};

export const friendCodeV2Internals = {
  checksum4,
  toBase64Url,
  fromBase64Url,
};
