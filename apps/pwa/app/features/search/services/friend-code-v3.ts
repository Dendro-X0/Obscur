"use client";

import { parsePublicKeyInput } from "@/app/features/profile/utils/parse-public-key-input";
import type {
  FriendCodeV3DecodeResult,
  FriendCodeV3Payload,
} from "@/app/features/search/types/discovery";

const PREFIX = "OB3";
const USED_CODES_STORAGE_KEY = "obscur.discovery.friend_code_v3.used.v1";

const toBase64Url = (value: string): string => {
  const hasBrowserBtoa = typeof window !== "undefined" && typeof window.btoa === "function";
  const encoded = hasBrowserBtoa
    ? window.btoa(unescape(encodeURIComponent(value)))
    : Buffer.from(value, "utf-8").toString("base64");
  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const fromBase64Url = (value: string): string => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const hasBrowserAtob = typeof window !== "undefined" && typeof window.atob === "function";
  if (!hasBrowserAtob) {
    return Buffer.from(padded, "base64").toString("utf-8");
  }
  return decodeURIComponent(escape(window.atob(padded)));
};

const checksum6 = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  const normalized = (hash >>> 0).toString(36).toUpperCase();
  return normalized.slice(-6).padStart(6, "0");
};

const normalizeRelays = (relays: ReadonlyArray<string> | undefined): ReadonlyArray<string> | undefined => {
  if (!relays || relays.length === 0) return undefined;
  const unique = Array.from(new Set(relays.map((relay) => relay.trim()).filter((relay) => relay.length > 0)));
  return unique.slice(0, 4);
};

const readUsedCodeIds = (): Set<string> => {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(USED_CODES_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as ReadonlyArray<string>;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((entry): entry is string => typeof entry === "string"));
  } catch {
    return new Set();
  }
};

const writeUsedCodeIds = (next: Set<string>): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(USED_CODES_STORAGE_KEY, JSON.stringify(Array.from(next.values())));
  } catch {
    // Ignore storage errors in best-effort dedupe cache.
  }
};

const makeCodeId = (payloadBody: string): string => checksum6(payloadBody).slice(0, 4);

export const encodeFriendCodeV3 = (params: Readonly<{
  pubkey: string;
  relays?: ReadonlyArray<string>;
  ttlMs?: number;
  singleUse?: boolean;
  nowUnixMs?: number;
}>): string | null => {
  const parsed = parsePublicKeyInput(params.pubkey);
  if (!parsed.ok) return null;
  const now = params.nowUnixMs ?? Date.now();
  const ttlMs = Math.max(15_000, params.ttlMs ?? 10 * 60 * 1000);
  const payload: FriendCodeV3Payload = {
    version: 3,
    pubkey: parsed.publicKeyHex,
    relays: normalizeRelays(params.relays),
    issuedAt: now,
    expiresAt: now + ttlMs,
    singleUse: params.singleUse === true ? true : undefined,
  };
  const body = toBase64Url(JSON.stringify(payload));
  const codeId = makeCodeId(body);
  const check = checksum6(`${body}.${codeId}`);
  return `${PREFIX}-${codeId}-${body}-${check}`;
};

export const decodeFriendCodeV3 = (input: string, nowUnixMs = Date.now()): FriendCodeV3DecodeResult => {
  const trimmed = input.trim();
  if (!trimmed.toUpperCase().startsWith(`${PREFIX}-`)) {
    return { ok: false, reason: "invalid_prefix" };
  }
  const parts = trimmed.split("-");
  if (parts.length < 4) {
    return { ok: false, reason: "invalid_payload" };
  }
  const codeId = (parts[1] ?? "").toUpperCase();
  const body = parts.slice(2, -1).join("-");
  const check = (parts[parts.length - 1] ?? "").toUpperCase();
  if (checksum6(`${body}.${codeId}`) !== check) {
    return { ok: false, reason: "checksum_mismatch" };
  }
  try {
    const parsed = JSON.parse(fromBase64Url(body)) as FriendCodeV3Payload;
    if (
      parsed.version !== 3
      || typeof parsed.pubkey !== "string"
      || typeof parsed.issuedAt !== "number"
      || typeof parsed.expiresAt !== "number"
    ) {
      return { ok: false, reason: "invalid_payload" };
    }
    const parsedPubkey = parsePublicKeyInput(parsed.pubkey);
    if (!parsedPubkey.ok) {
      return { ok: false, reason: "invalid_pubkey" };
    }
    if (parsed.expiresAt <= nowUnixMs) {
      return { ok: false, reason: "expired_code" };
    }
    const normalizedPayload: FriendCodeV3Payload = {
      version: 3,
      pubkey: parsedPubkey.publicKeyHex,
      relays: normalizeRelays(parsed.relays),
      issuedAt: parsed.issuedAt,
      expiresAt: parsed.expiresAt,
      singleUse: parsed.singleUse === true ? true : undefined,
    };
    if (normalizedPayload.singleUse) {
      const usedIds = readUsedCodeIds();
      if (usedIds.has(codeId)) {
        return { ok: false, reason: "code_used" };
      }
    }
    return { ok: true, codeId, payload: normalizedPayload };
  } catch {
    return { ok: false, reason: "invalid_payload" };
  }
};

export const consumeFriendCodeV3 = (codeId: string): void => {
  if (!codeId) return;
  const normalized = codeId.toUpperCase();
  const usedIds = readUsedCodeIds();
  usedIds.add(normalized);
  writeUsedCodeIds(usedIds);
};

export const friendCodeV3Internals = {
  checksum6,
  toBase64Url,
  fromBase64Url,
  readUsedCodeIds,
  writeUsedCodeIds,
  makeCodeId,
};
