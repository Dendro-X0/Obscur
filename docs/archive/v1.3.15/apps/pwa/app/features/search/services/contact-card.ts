"use client";

import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { cryptoService } from "@/app/features/crypto/crypto-service";
import type { ContactCardV1 } from "@/app/features/search/types/discovery";

const CONTACT_CARD_PREFIX = "obscur-card:";

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

const normalizeInviteCode = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : undefined;
};

const isContactCardLike = (value: unknown): value is ContactCardV1 => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return candidate.version === 1
    && typeof candidate.pubkey === "string"
    && Array.isArray(candidate.relays)
    && typeof candidate.issuedAt === "number"
    && typeof candidate.expiresAt === "number";
};

const buildSignaturePayload = (card: ContactCardV1) => ({
  publicKey: card.pubkey as PublicKeyHex,
  displayName: card.label,
  message: card.inviteCode,
  timestamp: card.issuedAt,
  expirationTime: card.expiresAt,
  inviteId: `card-v1-${card.pubkey.slice(0, 8)}-${card.issuedAt}`,
});

export const encodeContactCard = (card: ContactCardV1): string => {
  return `${CONTACT_CARD_PREFIX}${toBase64Url(JSON.stringify(card))}`;
};

export const decodeContactCard = (input: string): ContactCardV1 | null => {
  const trimmed = input.trim();
  const encoded = trimmed.startsWith(CONTACT_CARD_PREFIX) ? trimmed.slice(CONTACT_CARD_PREFIX.length) : trimmed;
  if (!encoded) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(encoded));
    if (!isContactCardLike(parsed)) {
      return null;
    }
    const inviteCode = normalizeInviteCode(typeof parsed.inviteCode === "string" ? parsed.inviteCode : undefined);
    return {
      version: 1,
      pubkey: parsed.pubkey,
      relays: parsed.relays.filter((relay): relay is string => typeof relay === "string"),
      label: typeof parsed.label === "string" ? parsed.label : undefined,
      inviteCode,
      issuedAt: parsed.issuedAt,
      expiresAt: parsed.expiresAt,
      sig: typeof parsed.sig === "string" ? parsed.sig : undefined,
    };
  } catch {
    return null;
  }
};

export const buildContactCardDeepLink = (card: ContactCardV1): string => {
  const encoded = encodeContactCard(card).slice(CONTACT_CARD_PREFIX.length);
  return `obscur://contact?card=${encodeURIComponent(encoded)}`;
};

export const extractContactCardFromQuery = (input: string): ContactCardV1 | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith(CONTACT_CARD_PREFIX)) {
    return decodeContactCard(trimmed);
  }

  try {
    const asUrl = new URL(trimmed);
    const cardParam = asUrl.searchParams.get("card");
    if (cardParam) {
      return decodeContactCard(cardParam);
    }
  } catch {
    // Not a URL, continue.
  }

  return decodeContactCard(trimmed);
};

export const verifyContactCard = async (card: ContactCardV1): Promise<boolean> => {
  const now = Date.now();
  if (card.expiresAt <= now) {
    return false;
  }
  if (!card.sig) {
    return true;
  }
  try {
    return await cryptoService.verifyInviteSignature(
      buildSignaturePayload(card),
      card.sig,
      card.pubkey as PublicKeyHex
    );
  } catch {
    return false;
  }
};

export const createSignedContactCard = async (params: Readonly<{
  pubkey: PublicKeyHex;
  privateKeyHex?: PrivateKeyHex | null;
  relays: ReadonlyArray<string>;
  label?: string;
  inviteCode?: string;
  ttlMs?: number;
}>): Promise<ContactCardV1> => {
  const now = Date.now();
  const cardBase: ContactCardV1 = {
    version: 1,
    pubkey: params.pubkey,
    relays: params.relays.slice(0, 8),
    label: params.label?.trim() || undefined,
    inviteCode: normalizeInviteCode(params.inviteCode),
    issuedAt: now,
    expiresAt: now + (params.ttlMs ?? 1000 * 60 * 60 * 24 * 30),
  };

  if (!params.privateKeyHex) {
    return cardBase;
  }

  try {
    const sig = await cryptoService.signInviteData(
      buildSignaturePayload(cardBase),
      params.privateKeyHex
    );
    return { ...cardBase, sig };
  } catch {
    return cardBase;
  }
};

export const contactCardInternals = {
  toBase64Url,
  fromBase64Url,
  isContactCardLike,
  normalizeInviteCode,
};
