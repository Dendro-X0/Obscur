import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

const REQUEST_COOLDOWN_PREFIX = "obscur:dm:request-cooldown:v1";
const DEFAULT_REQUEST_COOLDOWN_MS = 2 * 60 * 1000;

type RequestCooldownRecord = Readonly<{
  untilUnixMs: number;
  reason: "declined" | "canceled" | "manual";
  updatedAtUnixMs: number;
}>;

const getRequestCooldownKey = (params: Readonly<{ myPublicKeyHex: PublicKeyHex; peerPublicKeyHex: PublicKeyHex }>): string =>
  `${REQUEST_COOLDOWN_PREFIX}:${params.myPublicKeyHex}:${params.peerPublicKeyHex}`;

const readRequestCooldownRecord = (storageKey: string): RequestCooldownRecord | null => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RequestCooldownRecord>;
    if (
      typeof parsed.untilUnixMs !== "number" ||
      typeof parsed.updatedAtUnixMs !== "number" ||
      (parsed.reason !== "declined" && parsed.reason !== "canceled" && parsed.reason !== "manual")
    ) {
      window.localStorage.removeItem(storageKey);
      return null;
    }
    return parsed as RequestCooldownRecord;
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
};

export const getRequestCooldownRemainingMs = (params: Readonly<{ myPublicKeyHex: PublicKeyHex; peerPublicKeyHex: PublicKeyHex }>): number => {
  const storageKey = getRequestCooldownKey(params);
  const record = readRequestCooldownRecord(storageKey);
  if (!record) return 0;
  const remaining = record.untilUnixMs - Date.now();
  if (remaining <= 0) {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(storageKey);
    }
    return 0;
  }
  return remaining;
};

export const setRequestCooldown = (params: Readonly<{
  myPublicKeyHex: PublicKeyHex;
  peerPublicKeyHex: PublicKeyHex;
  reason: "declined" | "canceled" | "manual";
  durationMs?: number;
}>): void => {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const durationMs = Math.max(1_000, params.durationMs ?? DEFAULT_REQUEST_COOLDOWN_MS);
  const storageKey = getRequestCooldownKey(params);
  const next: RequestCooldownRecord = {
    reason: params.reason,
    untilUnixMs: now + durationMs,
    updatedAtUnixMs: now
  };
  window.localStorage.setItem(storageKey, JSON.stringify(next));
};

export const clearRequestCooldown = (params: Readonly<{ myPublicKeyHex: PublicKeyHex; peerPublicKeyHex: PublicKeyHex }>): void => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(getRequestCooldownKey(params));
};
