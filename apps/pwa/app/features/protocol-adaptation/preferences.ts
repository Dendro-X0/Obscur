import { resolveActiveProtocolIdFromEvidence } from "@obscur/private-trust-engine";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import { hasPrivateDcSession } from "./private-dc-session";
import type { ProtocolId, TransportId } from "./types";
import { PHASE0_ACTIVE_TRANSPORT_ID } from "./types";

const PROTOCOL_STORAGE_KEY = "obscur.active_protocol_id.v1";
const TRANSPORT_STORAGE_KEY = "obscur.active_transport_id.v1";

/** Fired when protocol or transport preference changes (C3 shell reactivity). */
export const PROTOCOL_ADAPTATION_CHANGED_EVENT = "protocol-adaptation-changed";

const emitProtocolAdaptationChanged = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.dispatchEvent(new Event(PROTOCOL_ADAPTATION_CHANGED_EVENT));
  } catch {
    // ignore
  }
};

const isProtocolId = (value: string): value is ProtocolId => (
  value === "nostr" || value === "matrix" || value === "private_dc"
);

const isTransportId = (value: string): value is TransportId => (
  value === "clearnet" || value === "tor" || value === "quiet"
);

export const getActiveProtocolStorageKey = (profileId?: string): string => (
  getScopedStorageKey(PROTOCOL_STORAGE_KEY, profileId ?? getResolvedProfileId())
);

export const getActiveTransportStorageKey = (profileId?: string): string => (
  getScopedStorageKey(TRANSPORT_STORAGE_KEY, profileId ?? getResolvedProfileId())
);

/**
 * Explicit user/module selection from storage only (null = never written).
 * Cut 2.1 — do not treat missing key as Nostr authority on native + H-dc.
 */
export const readStoredActiveProtocolId = (profileId?: string): ProtocolId | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(getActiveProtocolStorageKey(profileId));
    if (raw && isProtocolId(raw)) {
      return raw;
    }
  } catch {
    // ignore
  }
  return null;
};

/**
 * Cut 2.1 — resolve product-facing active protocol.
 * Explicit LS selection wins; else native + H-dc session → private_dc; else nostr.
 * Does not write a Nostr default when H-dc session is present.
 */
export const resolveActiveProtocolId = (profileId?: string): ProtocolId => (
  resolveActiveProtocolIdFromEvidence({
    storedProtocolId: readStoredActiveProtocolId(profileId),
    preferPrivateDcWhenNoStored: requiresSqlitePersistence() && hasPrivateDcSession(profileId),
  })
);

/** Product-facing active protocol (Cut 2.1 resolve). */
export const readActiveProtocolId = (profileId?: string): ProtocolId => (
  resolveActiveProtocolId(profileId)
);

export const writeActiveProtocolId = (
  protocolId: ProtocolId,
  profileId?: string,
): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(getActiveProtocolStorageKey(profileId), protocolId);
    emitProtocolAdaptationChanged();
  } catch {
    // ignore
  }
};

export const readActiveTransportId = (profileId?: string): TransportId => {
  if (typeof window === "undefined") {
    return PHASE0_ACTIVE_TRANSPORT_ID;
  }
  try {
    const raw = window.localStorage.getItem(getActiveTransportStorageKey(profileId));
    if (raw && isTransportId(raw)) {
      return raw;
    }
  } catch {
    // ignore
  }
  return PHASE0_ACTIVE_TRANSPORT_ID;
};

export const writeActiveTransportId = (
  transportId: TransportId,
  profileId?: string,
): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(getActiveTransportStorageKey(profileId), transportId);
    emitProtocolAdaptationChanged();
  } catch {
    // ignore
  }
};
