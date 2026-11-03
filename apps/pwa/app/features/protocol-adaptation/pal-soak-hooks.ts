/**
 * Desktop CDP soak hooks (P4d/P4f) — installed only under Tauri.
 * Not a product API; scripts call `window.__OBSCUR_PAL_SOAK__`.
 * @see specs/backend/platform-p4d-private-dc-adapter-cdp-soak-2026-11.md
 * @see specs/backend/platform-p4f-private-dc-connect-list-scope-2026-11.md
 */

import { ProtocolAdaptationLayer } from "./layer";
import {
  clearPrivateDcSession,
  writePrivateDcSession,
  type PrivateDcSession,
} from "./private-dc-session";

export type ObscurPalSoakHooks = Readonly<{
  writePrivateDcSession: (session: PrivateDcSession, profileId?: string) => void;
  clearPrivateDcSession: (profileId?: string) => void;
  setActiveProtocolId: (protocolId: "nostr" | "matrix" | "private_dc", profileId?: string) => void;
  getActiveProtocolId: (profileId?: string) => string;
  connect: (profileId?: string) => Promise<void>;
  listConversations: (profileId: string) => Promise<ReadonlyArray<{ id: string; title: string }>>;
  listMessages: (params: Readonly<{
    profileId: string;
    conversationId: string;
    myPublicKeyHex: string;
    limit?: number;
  }>) => Promise<ReadonlyArray<{
    id: string;
    conversationId: string;
    body: string;
  }>>;
  sendMessage: (params: Readonly<{
    profileId: string;
    conversationId: string;
    body: string;
  }>) => Promise<{
    id: string;
    conversationId: string;
    body: string;
  }>;
}>;

declare global {
  interface Window {
    __OBSCUR_PAL_SOAK__?: ObscurPalSoakHooks;
  }
}

const hasTauri = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  const w = window as Window & {
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
  };
  return Boolean(w.__TAURI_INTERNALS__ || w.__TAURI__);
};

/** Idempotent — safe to call from provider mount. */
export const installPalSoakHooks = (): void => {
  if (!hasTauri()) {
    return;
  }
  window.__OBSCUR_PAL_SOAK__ = {
    writePrivateDcSession,
    clearPrivateDcSession,
    setActiveProtocolId: (protocolId, profileId) => {
      ProtocolAdaptationLayer.setActiveProtocolId(protocolId, profileId);
    },
    getActiveProtocolId: (profileId) => ProtocolAdaptationLayer.getActiveProtocolId(profileId),
    connect: (profileId) => ProtocolAdaptationLayer.connect(profileId),
    listConversations: (profileId) => ProtocolAdaptationLayer.listConversations(profileId),
    listMessages: (params) => ProtocolAdaptationLayer.listMessages(params),
    sendMessage: (params) => ProtocolAdaptationLayer.sendMessage(params),
  };
};
