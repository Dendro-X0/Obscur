import {
  sendPrivateDcHomeEnvelope,
  type DeliverHomeEnvelope,
  type PrivateDcHomeSession,
} from "@obscur/private-trust-engine";
import { createFailClosedHomeEnvelopeDeliver } from "./fail-closed-home-deliver";

/**
 * Cut 4.4 — Vite-owned H-dc session read (same key convention as Next, no pwa import).
 */

export const VITE_PRIVATE_DC_SESSION_BASE_KEY = "obscur.private_dc_session.v1";

export const getVitePrivateDcSessionStorageKey = (profileId: string): string => (
  `${VITE_PRIVATE_DC_SESSION_BASE_KEY}::${profileId}`
);

const parseSession = (raw: string): PrivateDcHomeSession | null => {
  try {
    const parsed = JSON.parse(raw) as Partial<PrivateDcHomeSession>;
    if (typeof parsed.baseUrl !== "string" || parsed.baseUrl.trim().length === 0) {
      return null;
    }
    const baseUrl = parsed.baseUrl.trim().replace(/\/+$/, "");
    if (!/^https?:\/\//i.test(baseUrl)) {
      return null;
    }
    return {
      baseUrl,
      bearerToken: typeof parsed.bearerToken === "string" && parsed.bearerToken.trim()
        ? parsed.bearerToken.trim()
        : undefined,
    };
  } catch {
    return null;
  }
};

export const readVitePrivateDcSession = (
  profileId: string,
  env: Readonly<{
    baseUrl?: string;
    bearerToken?: string;
  }> = {
    baseUrl: typeof import.meta !== "undefined" ? import.meta.env?.OBSCUR_PRIVATE_DC_BASE_URL : undefined,
    bearerToken: typeof import.meta !== "undefined" ? import.meta.env?.OBSCUR_PRIVATE_DC_BEARER_TOKEN : undefined,
  },
): PrivateDcHomeSession | null => {
  const envBase = env.baseUrl?.trim();
  if (envBase && /^https?:\/\//i.test(envBase)) {
    return {
      baseUrl: envBase.replace(/\/+$/, ""),
      bearerToken: env.bearerToken?.trim() || undefined,
    };
  }
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(getVitePrivateDcSessionStorageKey(profileId));
  if (!raw) {
    return null;
  }
  return parseSession(raw);
};

/**
 * Cut 11.3 — persist private home session for Continuity M2 / H-dc (opaque transport only).
 * ≠ Continuity Pass.
 */
export const writeVitePrivateDcSession = (
  profileId: string,
  session: PrivateDcHomeSession,
): PrivateDcHomeSession => {
  const baseUrl = session.baseUrl.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(baseUrl)) {
    throw new Error("Private home base URL must be http(s)");
  }
  const next: PrivateDcHomeSession = {
    baseUrl,
    bearerToken: session.bearerToken?.trim() || undefined,
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      getVitePrivateDcSessionStorageKey(profileId),
      JSON.stringify(next),
    );
  }
  return next;
};

export const clearVitePrivateDcSession = (profileId: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(getVitePrivateDcSessionStorageKey(profileId));
};

export const createViteHomeEnvelopeDeliver = (params: Readonly<{
  profileId: string;
  fetchImpl?: typeof fetch;
}>): DeliverHomeEnvelope => {
  const session = readVitePrivateDcSession(params.profileId);
  if (!session) {
    return createFailClosedHomeEnvelopeDeliver(
      "Vite H-dc session missing — set OBSCUR_PRIVATE_DC_BASE_URL or localStorage session",
    );
  }
  const fetchImpl = params.fetchImpl ?? fetch;
  return async (deliverParams) => {
    const ack = await sendPrivateDcHomeEnvelope(session, deliverParams, fetchImpl);
    return {
      id: ack.id,
      status: ack.status,
      sentAtUnixMs: ack.sentAtUnixMs,
    };
  };
};
