/**
 * Desktop CDP soak hooks (P2-S S2/S3/S4) — Tauri only.
 * @see specs/backend/p2s-s4-inbound-export-l3-soak-2026-11.md
 * @see specs/backend/p2s-s2-quarantine-persist-l3-soak-2026-11.md
 * @see specs/backend/p2s-s3-inbound-preview-l3-soak-2026-11.md
 */

import type { Attachment } from "@/app/features/messaging/types";
import {
  exportInboundMediaToUserPath,
  requiresInboundMediaExportConfirm,
  type ExportInboundMediaToUserPathResult,
  type InboundMediaExportConsentInput,
} from "./services/inbound-media-export";
import {
  createInboundMediaPreviewObjectUrl,
  shouldAllowInboundMediaPreview,
} from "./services/inbound-media-preview";
import {
  planInboundMediaWrite,
  relativePathBelongsToProfileQuarantine,
} from "./services/inbound-media-quarantine";
import {
  persistInboundMediaQuarantineBytes,
  readInboundMediaQuarantineBytes,
} from "./services/inbound-media-quarantine-persist";

export type ObscurStorageSoakHooks = Readonly<{
  requiresInboundMediaExportConfirm: (input: InboundMediaExportConsentInput) => boolean;
  exportInboundMediaToUserPath: (params: Readonly<{
    attachment: Attachment;
    userConsentConfirmed: boolean;
    sourceUrl?: string;
    contentAvailabilityState?: string | null;
  }>) => Promise<ExportInboundMediaToUserPathResult>;
  shouldAllowInboundMediaPreview: typeof shouldAllowInboundMediaPreview;
  createInboundMediaPreviewObjectUrl: typeof createInboundMediaPreviewObjectUrl;
  planInboundMediaWrite: typeof planInboundMediaWrite;
  relativePathBelongsToProfileQuarantine: typeof relativePathBelongsToProfileQuarantine;
  persistInboundMediaQuarantineBytes: typeof persistInboundMediaQuarantineBytes;
  readInboundMediaQuarantineBytes: typeof readInboundMediaQuarantineBytes;
}>;

declare global {
  interface Window {
    __OBSCUR_STORAGE_SOAK__?: ObscurStorageSoakHooks;
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

export const installStorageSoakHooks = (): void => {
  if (!hasTauri()) {
    return;
  }
  window.__OBSCUR_STORAGE_SOAK__ = {
    requiresInboundMediaExportConfirm,
    exportInboundMediaToUserPath,
    shouldAllowInboundMediaPreview,
    createInboundMediaPreviewObjectUrl,
    planInboundMediaWrite,
    relativePathBelongsToProfileQuarantine,
    persistInboundMediaQuarantineBytes,
    readInboundMediaQuarantineBytes,
  };
};
