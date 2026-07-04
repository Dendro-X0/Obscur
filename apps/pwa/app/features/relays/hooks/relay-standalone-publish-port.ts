"use client";

import type { MultiRelayPublishResult, PublishResult } from "./enhanced-relay-pool-types";
import { publishToRelayStandalone as publishLegacyToRelayStandalone } from "./enhanced-relay-pool-legacy";
import { publishToUrlsStandalone as publishLegacyToUrlsStandalone } from "./enhanced-relay-pool-legacy";
import {
  shouldUseLegacyStandaloneRelayPublish,
  shouldRouteHostTransportPublish,
  shouldRouteSubtractedStandalonePublishPort,
} from "@/app/features/transport-kernel/transport-kernel-publish-port";
import {
  publishTransportKernelToRelay,
  publishTransportKernelToRelayUrls,
} from "@/app/features/transport-kernel/transport-kernel-standalone-publish-legacy";
import {
  publishHostTransportShimToRelay,
  publishHostTransportShimToRelayUrls,
} from "@/app/features/transport-kernel/transport-kernel-host-publish-shim";
import {
  publishToRelayStandaloneSubtracted,
  publishToUrlsStandaloneSubtracted,
} from "./relay-standalone-publish-port-subtracted";
import { relayTransportJournal } from "@/app/features/relays/services/relay-transport-journal";

const JOURNAL_SOURCE = "transport_kernel_standalone_publish";
const JOURNAL_SOURCE_HOST_SHIM = "transport_kernel_host_publish_shim";

const normalizeRelayUrl = (url: string): string | null => {
  const normalized = url.trim();
  return normalized.length > 0 ? normalized : null;
};

const normalizeRelayUrls = (urls: ReadonlyArray<string>): ReadonlyArray<string> => (
  Array.from(new Set(urls.map(normalizeRelayUrl).filter((value): value is string => !!value)))
);

export const publishToRelayStandalone = async (url: string, payload: string): Promise<PublishResult> => {
  if (shouldUseLegacyStandaloneRelayPublish()) {
    return publishLegacyToRelayStandalone(url, payload);
  }

  if (shouldRouteSubtractedStandalonePublishPort()) {
    return publishToRelayStandaloneSubtracted(url, payload);
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

  relayTransportJournal.setPendingOutbound(JOURNAL_SOURCE, 1);
  try {
    return await publishTransportKernelToRelay(normalized, payload);
  } finally {
    relayTransportJournal.clearPendingOutbound(JOURNAL_SOURCE);
  }
};

export const publishToUrlsStandalone = async (
  urls: ReadonlyArray<string>,
  payload: string,
): Promise<MultiRelayPublishResult> => {
  if (shouldUseLegacyStandaloneRelayPublish()) {
    return publishLegacyToUrlsStandalone(urls, payload);
  }

  if (shouldRouteSubtractedStandalonePublishPort()) {
    return publishToUrlsStandaloneSubtracted(urls, payload);
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

  relayTransportJournal.setPendingOutbound(JOURNAL_SOURCE, normalized.length);
  try {
    return await publishTransportKernelToRelayUrls(normalized, payload);
  } finally {
    relayTransportJournal.clearPendingOutbound(JOURNAL_SOURCE);
  }
};
