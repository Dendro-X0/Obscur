"use client";

import { isValidInviteCode } from "@/app/features/invites/utils/invite-parser";
import { parsePublicKeyInput } from "@/app/features/profile/utils/parse-public-key-input";
import type { RelayQueryPool } from "@/app/features/search/services/relay-discovery-query";
import { queryRelayProfiles } from "@/app/features/search/services/relay-discovery-query";
import { extractContactCardFromQuery, verifyContactCard } from "./contact-card";
import { consumeFriendCodeV3, decodeFriendCodeV3 } from "./friend-code-v3";
import { decodeFriendCodeV2 } from "./friend-code-v2";
import { resolvedIdentityCache } from "./resolved-identity-cache";
import type { ResolveResult, ResolvedIdentity } from "@/app/features/search/types/discovery";

type ResolveIdentityParams = Readonly<{
  query: string;
  pool: RelayQueryPool;
  indexBaseUrl?: string;
  signal?: AbortSignal;
  allowLegacyInviteCode?: boolean;
}>;

const withAbort = <T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> => {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(resolve).catch(reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
};

const ok = (identity: ResolvedIdentity): ResolveResult => ({ ok: true, identity });

type ResolveFailureReason = Extract<ResolveResult, { ok: false }>["reason"];

const fail = (reason: ResolveFailureReason, message: string): ResolveResult => ({
  ok: false,
  reason,
  message,
});

const looksLikeShortCode = (value: string): boolean => /^[A-Z0-9]{2,6}(?:-[A-Z0-9]{2,32}){1,5}$/i.test(value.trim());

const resolveViaIndex = async (
  raw: string,
  baseUrl: string | undefined,
  signal?: AbortSignal
): Promise<ResolvedIdentity | null> => {
  const normalizedBaseUrl = baseUrl?.trim();
  if (!normalizedBaseUrl) return null;
  try {
    const endpoint = new URL("/v1/discovery/resolve", normalizedBaseUrl);
    endpoint.searchParams.set("code_or_card", raw);
    const response = await withAbort(fetch(endpoint.toString(), { signal }), signal);
    if (!response.ok) return null;
    const payload = await response.json() as Record<string, unknown>;
    const pubkey = typeof payload.pubkey === "string" ? payload.pubkey : "";
    const parsed = parsePublicKeyInput(pubkey);
    if (!parsed.ok) return null;
    const relays = Array.isArray(payload.relays)
      ? payload.relays.filter((entry): entry is string => typeof entry === "string").slice(0, 6)
      : undefined;
    return {
      pubkey: parsed.publicKeyHex,
      display: typeof payload.display === "string" ? payload.display : undefined,
      relays,
      inviteCode: typeof payload.inviteCode === "string" ? payload.inviteCode.toUpperCase() : undefined,
      source: "legacy_code",
      confidence: "relay_confirmed",
    };
  } catch {
    return null;
  }
};

export const resolveIdentity = async (params: ResolveIdentityParams): Promise<ResolveResult> => {
  const raw = params.query.trim();
  if (!raw) {
    return fail("invalid_input", "Input is required.");
  }

  resolvedIdentityCache.runOneTimeMigration();

  // 1) Contact card (QR/link/raw)
  const card = extractContactCardFromQuery(raw);
  if (card) {
    const isValid = await withAbort(verifyContactCard(card), params.signal).catch(() => false);
    const identity: ResolvedIdentity = {
      pubkey: card.pubkey,
      display: card.label,
      relays: card.relays,
      inviteCode: card.inviteCode,
      source: "contact_card",
      confidence: isValid ? "direct" : "cached_only",
    };
    resolvedIdentityCache.upsert(identity);
    return ok(identity);
  }

  // 2) Friend Code v3 (ephemeral)
  if (looksLikeShortCode(raw)) {
    const indexResolved = await resolveViaIndex(raw, params.indexBaseUrl, params.signal);
    if (indexResolved) {
      const resolved: ResolvedIdentity = {
        ...indexResolved,
        source: "friend_code_v3",
        confidence: "relay_confirmed",
      };
      resolvedIdentityCache.upsert(resolved);
      return ok(resolved);
    }
  }

  const decodedFriendCodeV3 = decodeFriendCodeV3(raw);
  if (decodedFriendCodeV3.ok) {
    const identity: ResolvedIdentity = {
      pubkey: decodedFriendCodeV3.payload.pubkey,
      relays: decodedFriendCodeV3.payload.relays,
      source: "friend_code_v3",
      confidence: "direct",
    };
    if (decodedFriendCodeV3.payload.singleUse) {
      consumeFriendCodeV3(decodedFriendCodeV3.codeId);
    }
    resolvedIdentityCache.upsert(identity);
    return ok(identity);
  }
  if (decodedFriendCodeV3.reason === "expired_code") {
    return fail("expired_code", "Friend code expired. Ask for a new short code, QR, or contact link.");
  }
  if (decodedFriendCodeV3.reason === "code_used") {
    return fail("code_used", "Friend code already used. Ask for a new short code.");
  }

  // 3) Friend Code v2
  const decodedFriendCode = decodeFriendCodeV2(raw);
  if (decodedFriendCode.ok) {
    const identity: ResolvedIdentity = {
      pubkey: decodedFriendCode.payload.pubkey,
      relays: decodedFriendCode.payload.relays,
      source: "friend_code_v2",
      confidence: "direct",
    };
    resolvedIdentityCache.upsert(identity);
    return ok(identity);
  }

  // 4) npub/hex pubkey
  const parsedPubkey = parsePublicKeyInput(raw);
  if (parsedPubkey.ok) {
    const cached = resolvedIdentityCache.getByPubkey(parsedPubkey.publicKeyHex);
    if (cached) {
      return ok({
        ...cached,
        source: parsedPubkey.format === "npub" ? "npub" : "hex",
        confidence: "direct",
      });
    }
    const identity: ResolvedIdentity = {
      pubkey: parsedPubkey.publicKeyHex,
      relays: parsedPubkey.relays,
      source: parsedPubkey.format === "npub" ? "npub" : "hex",
      confidence: "direct",
    };
    resolvedIdentityCache.upsert(identity);
    return ok(identity);
  }

  // 5) Legacy OBSCUR code bridge (+ optional index resolve)
  const upper = raw.toUpperCase();
  if (isValidInviteCode(upper)) {
    // Legacy invite-code lookup remains a compatibility contract for existing
    // users and should not silently disappear behind rollout drift.
    const cachedLegacy = resolvedIdentityCache.getByLegacyInviteCode(upper);
    if (cachedLegacy) {
      return ok(cachedLegacy);
    }
    const indexResolved = await resolveViaIndex(upper, params.indexBaseUrl, params.signal);
    if (indexResolved) {
      resolvedIdentityCache.upsert(indexResolved);
      return ok(indexResolved);
    }
    try {
      const relayRecords = await withAbort(queryRelayProfiles({
        pool: params.pool,
        mode: "invite",
        query: upper,
        timeoutMs: 4500,
        maxResults: 20,
      }), params.signal);
      const matched = relayRecords.find((record) => (record.inviteCode ?? "").toUpperCase() === upper) ?? relayRecords[0];
      if (!matched) {
        return fail("legacy_code_unresolvable", "Legacy code could not be resolved. Ask for QR, contact link, or Friend Code v2.");
      }
      const identity: ResolvedIdentity = {
        pubkey: matched.pubkey,
        display: matched.displayName || matched.name,
        inviteCode: upper,
        source: "legacy_code",
        confidence: "relay_confirmed",
      };
      resolvedIdentityCache.upsert(identity);
      return ok(identity);
    } catch {
      if (params.indexBaseUrl?.trim()) {
        return fail("index_unavailable_fallback", "Index unavailable and relay fallback degraded. Ask for QR/contact link/Friend Code.");
      }
      return fail("relay_degraded", "Relay network is degraded. Ask for QR, contact link, or Friend Code.");
    }
  }

  // 6) Text fallback is not deterministic for Add Friend.
  return fail("unsupported_token", "Input is not a deterministic add token. Use QR/contact card/Friend Code/npub.");
};
