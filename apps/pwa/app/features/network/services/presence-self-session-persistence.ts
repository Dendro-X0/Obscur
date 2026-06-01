import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

const PRESENCE_SELF_SESSION_STORAGE_KEY = "obscur.presence.self_session.v1";

type PresenceSelfSessionRecord = Readonly<{
  publicKeyHex: PublicKeyHex;
  sessionId: string;
  startedAtMs: number;
}>;

type PresenceSelfSessionMap = Record<string, PresenceSelfSessionRecord>;

const normalizePublicKeyHex = (value: string): PublicKeyHex | null => {
  const normalized = value.trim().toLowerCase();
  if (normalized.length !== 64) {
    return null;
  }
  return normalized as PublicKeyHex;
};

const readSessionMap = (): PresenceSelfSessionMap => {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(PRESENCE_SELF_SESSION_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as PresenceSelfSessionMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeSessionMap = (map: PresenceSelfSessionMap): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(PRESENCE_SELF_SESSION_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // best-effort
  }
};

const createSessionId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

/** Reuse one presence session per account within this profile WebView storage. */
export const readOrCreatePresenceSelfSession = (
  publicKeyHex: PublicKeyHex,
): Readonly<{ sessionId: string; startedAtMs: number }> => {
  const normalized = normalizePublicKeyHex(publicKeyHex);
  if (!normalized || typeof window === "undefined") {
    return {
      sessionId: createSessionId(),
      startedAtMs: Date.now(),
    };
  }

  const map = readSessionMap();
  const existing = map[normalized];
  if (existing?.sessionId && typeof existing.startedAtMs === "number") {
    return {
      sessionId: existing.sessionId,
      startedAtMs: existing.startedAtMs,
    };
  }

  const created: PresenceSelfSessionRecord = {
    publicKeyHex: normalized,
    sessionId: createSessionId(),
    startedAtMs: Date.now(),
  };
  map[normalized] = created;
  writeSessionMap(map);
  return {
    sessionId: created.sessionId,
    startedAtMs: created.startedAtMs,
  };
};

export const clearPresenceSelfSession = (publicKeyHex: PublicKeyHex | null | undefined): void => {
  const normalized = publicKeyHex ? normalizePublicKeyHex(publicKeyHex) : null;
  if (!normalized || typeof window === "undefined") {
    return;
  }
  const map = readSessionMap();
  if (!map[normalized]) {
    return;
  }
  delete map[normalized];
  writeSessionMap(map);
};
