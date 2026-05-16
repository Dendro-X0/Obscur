"use client";

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import {
  createEmptyRequestFlowEvidence,
  type RequestFlowEvidence,
} from "./request-flow-contracts";

const STORAGE_KEY = "obscur.messaging.request_flow_evidence.v1";

const resolveStorageKey = (profileId?: string): string => (
  getScopedStorageKey(STORAGE_KEY, profileId ?? getResolvedProfileId())
);

type RequestFlowEvidenceState = Readonly<{
  byPeer: Readonly<Record<string, RequestFlowEvidence>>;
}>;

const createEmptyState = (): RequestFlowEvidenceState => ({
  byPeer: {},
});

const readState = (profileId?: string): RequestFlowEvidenceState => {
  if (typeof window === "undefined") return createEmptyState();
  try {
    const raw = window.localStorage.getItem(resolveStorageKey(profileId));
    if (!raw) return createEmptyState();
    const parsed = JSON.parse(raw) as RequestFlowEvidenceState;
    if (!parsed || typeof parsed !== "object" || typeof parsed.byPeer !== "object") {
      return createEmptyState();
    }
    return parsed;
  } catch {
    return createEmptyState();
  }
};

const writeState = (state: RequestFlowEvidenceState, profileId?: string): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(resolveStorageKey(profileId), JSON.stringify(state));
  } catch {
    // Ignore storage write errors to keep transport path non-throwing.
  }
};

const normalizePeer = (peerPublicKeyHex: string): PublicKeyHex | null => {
  return normalizePublicKeyHex(peerPublicKeyHex);
};

const upsert = (
  peerPublicKeyHex: string,
  updater: (current: RequestFlowEvidence) => RequestFlowEvidence,
  profileId?: string,
): RequestFlowEvidence => {
  const normalized = normalizePeer(peerPublicKeyHex);
  if (!normalized) {
    return createEmptyRequestFlowEvidence();
  }
  const state = readState(profileId);
  const current = state.byPeer[normalized] ?? createEmptyRequestFlowEvidence();
  const next = updater(current);
  writeState({
    byPeer: {
      ...state.byPeer,
      [normalized]: next,
    },
  }, profileId);
  return next;
};

const get = (peerPublicKeyHex: string, profileId?: string): RequestFlowEvidence => {
  const normalized = normalizePeer(peerPublicKeyHex);
  if (!normalized) return createEmptyRequestFlowEvidence();
  const state = readState(profileId);
  return state.byPeer[normalized] ?? createEmptyRequestFlowEvidence();
};

const markRequestPublished = (params: Readonly<{
  peerPublicKeyHex: string;
  requestEventId?: string;
  profileId?: string;
}>): RequestFlowEvidence => {
  return upsert(params.peerPublicKeyHex, (current) => ({
    ...current,
    requestEventId: params.requestEventId || current.requestEventId,
    lastEvidenceUnixMs: Date.now(),
  }), params.profileId);
};

const markReceiptAck = (params: Readonly<{
  peerPublicKeyHex: string;
  requestEventId?: string;
  profileId?: string;
}>): RequestFlowEvidence => {
  return upsert(params.peerPublicKeyHex, (current) => ({
    ...current,
    requestEventId: params.requestEventId || current.requestEventId,
    receiptAckSeen: true,
    lastEvidenceUnixMs: Date.now(),
  }), params.profileId);
};

const markAccept = (params: Readonly<{
  peerPublicKeyHex: string;
  requestEventId?: string;
  profileId?: string;
}>): RequestFlowEvidence => {
  return upsert(params.peerPublicKeyHex, (current) => ({
    ...current,
    requestEventId: params.requestEventId || current.requestEventId,
    acceptSeen: true,
    lastEvidenceUnixMs: Date.now(),
  }), params.profileId);
};

const markTerminalFailure = (params: Readonly<{
  peerPublicKeyHex: string;
  profileId?: string;
}>): RequestFlowEvidence => {
  return upsert(params.peerPublicKeyHex, (current) => ({
    ...current,
    lastEvidenceUnixMs: Date.now(),
  }), params.profileId);
};

const clear = (peerPublicKeyHex: string, profileId?: string): void => {
  const normalized = normalizePeer(peerPublicKeyHex);
  if (!normalized) return;
  const state = readState(profileId);
  const { [normalized]: _unused, ...rest } = state.byPeer;
  void _unused;
  writeState({ byPeer: rest }, profileId);
};

export const requestFlowEvidenceStore = {
  get,
  markRequestPublished,
  markReceiptAck,
  markAccept,
  markTerminalFailure,
  clear,
  reset: clear,
};

export const requestFlowEvidenceStoreInternals = {
  readState,
  writeState,
  getStorageKey: resolveStorageKey,
};
