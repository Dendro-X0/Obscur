"use client";

/**
 * W62 post-subtraction port routing — host + fail-closed blocked path only.
 * Swapped into `relay-standalone-publish-port.ts` when production legacy is deleted.
 */

import type { MultiRelayPublishResult, PublishResult } from "./enhanced-relay-pool-types";
import { publishToRelayStandalone as publishLegacyToRelayStandalone } from "./enhanced-relay-pool-legacy";
import { publishToUrlsStandalone as publishLegacyToUrlsStandalone } from "./enhanced-relay-pool-legacy";
import {
  shouldUseLegacyStandaloneRelayPublish,
  shouldRouteHostTransportPublish,
} from "@/app/features/transport-kernel/transport-kernel-publish-port";
import {
  publishStandaloneLegacyBlockedToRelay,
  publishStandaloneLegacyBlockedToRelayUrls,
} from "@/app/features/transport-kernel/transport-kernel-standalone-publish-blocked";
import {
  publishHostTransportShimToRelay,
  publishHostTransportShimToRelayUrls,
} from "@/app/features/transport-kernel/transport-kernel-host-publish-shim";
import { relayTransportJournal } from "@/app/features/relays/services/relay-transport-journal";

const JOURNAL_SOURCE_HOST_SHIM = "transport_kernel_host_publish_shim";

const normalizeRelayUrl = (url: string): string | null => {
  const normalized = url.trim();
  return normalized.length > 0 ? normalized : null;
};

const normalizeRelayUrls = (urls: ReadonlyArray<string>): ReadonlyArray<string> => (
  Array.from(new Set(urls.map(normalizeRelayUrl).filter((value): value is string => !!value)))
);

export const publishToRelayStandaloneSubtracted = async (
  url: string,
  payload: string,
): Promise<PublishResult> => {
  if (shouldUseLegacyStandaloneRelayPublish()) {
    return publishLegacyToRelayStandalone(url, payload);
  }

  const normalized = normalizeRelayUrl(url);
  if (!normalized) {
    return { success: false, relayUrl: url, error: "Empty relay URL." };
  }

  if (shouldRouteHostTransportPublish()) {
    relayTransportJournal.setPendingOutbound(JOURNAL_SOURCE_HOST_SHIM, 1);
    try {
      return await publishHostTransportShimToRelay(normalized, payload);
    } finally {
      relayTransportJournal.clearPendingOutbound(JOURNAL_SOURCE_HOST_SHIM);
    }
  }

  return publishStandaloneLegacyBlockedToRelay(normalized, payload);
};

export const publishToUrlsStandaloneSubtracted = async (
  urls: ReadonlyArray<string>,
  payload: string,
): Promise<MultiRelayPublishResult> => {
  if (shouldUseLegacyStandaloneRelayPublish()) {
    return publishLegacyToUrlsStandalone(urls, payload);
  }

  const normalized = normalizeRelayUrls(urls);

  if (shouldRouteHostTransportPublish()) {
    relayTransportJournal.setPendingOutbound(JOURNAL_SOURCE_HOST_SHIM, normalized.length);
    try {
      return await publishHostTransportShimToRelayUrls(normalized, payload);
    } finally {
      relayTransportJournal.clearPendingOutbound(JOURNAL_SOURCE_HOST_SHIM);
    }
  }

  return publishStandaloneLegacyBlockedToRelayUrls(normalized, payload);
};
