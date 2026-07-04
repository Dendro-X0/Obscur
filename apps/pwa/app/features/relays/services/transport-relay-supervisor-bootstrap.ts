import {
  buildCheckpointRelayUrlSet,
  listConfiguredRelayUrls,
  listRelayCheckpoints,
} from "@obscur/transport-engine";
import type { RelayCheckpointRecord } from "@dweb/db";
import { getTransportEngineHost } from "@/app/features/transport-kernel/transport-engine-host-port";

export type LoadTransportConfiguredRelayUrlsParams = Readonly<{
  profileId: string;
  windowLabel?: string;
}>;

export type TransportRelayPersistenceBundle = Readonly<{
  engineConfiguredRelayUrls: ReadonlyArray<string>;
  relayCheckpoints: ReadonlyArray<RelayCheckpointRecord>;
  engineCheckpointRelayUrls: ReadonlyArray<string>;
}>;

const EMPTY_TRANSPORT_RELAY_PERSISTENCE: TransportRelayPersistenceBundle = {
  engineConfiguredRelayUrls: [],
  relayCheckpoints: [],
  engineCheckpointRelayUrls: [],
};

/** Checkpoint relay URLs ordered by most recent sync evidence first. */
export const resolveEngineCheckpointRelayUrls = (
  checkpoints: ReadonlyArray<RelayCheckpointRecord>,
): ReadonlyArray<string> => {
  const seen = new Set<string>();
  const ordered = [...checkpoints].sort((left, right) => right.last_event_at - left.last_event_at);
  const urls: string[] = [];
  for (const checkpoint of ordered) {
    const url = checkpoint.relay_url.trim();
    if (!url || seen.has(url)) {
      continue;
    }
    seen.add(url);
    urls.push(url);
  }
  return urls;
};

/** Profile-scoped relay URLs from Rust persistence (groups + checkpoints). */
export const loadTransportConfiguredRelayUrls = async (
  params: LoadTransportConfiguredRelayUrlsParams,
): Promise<ReadonlyArray<string>> => {
  const bundle = await loadTransportRelayPersistence(params);
  return bundle.engineConfiguredRelayUrls;
};

/** Profile-scoped relay checkpoints from Rust persistence. */
export const loadTransportRelayCheckpoints = async (
  params: LoadTransportConfiguredRelayUrlsParams,
): Promise<ReadonlyArray<RelayCheckpointRecord>> => {
  const bundle = await loadTransportRelayPersistence(params);
  return bundle.relayCheckpoints;
};

/** Loads configured relay URLs and relay checkpoints in one native engine round-trip pair. */
export const loadTransportRelayPersistence = async (
  params: LoadTransportConfiguredRelayUrlsParams,
): Promise<TransportRelayPersistenceBundle> => {
  const profileId = params.profileId.trim();
  if (!profileId) {
    return EMPTY_TRANSPORT_RELAY_PERSISTENCE;
  }
  const host = getTransportEngineHost();
  if (!host) {
    return EMPTY_TRANSPORT_RELAY_PERSISTENCE;
  }
  try {
    const [engineConfiguredRelayUrls, relayCheckpoints] = await Promise.all([
      listConfiguredRelayUrls({
        host,
        profileId,
        windowLabel: params.windowLabel,
      }),
      listRelayCheckpoints({
        host,
        profileId,
        windowLabel: params.windowLabel,
      }),
    ]);
    const engineCheckpointRelayUrls = resolveEngineCheckpointRelayUrls(relayCheckpoints);
    return {
      engineConfiguredRelayUrls,
      relayCheckpoints,
      engineCheckpointRelayUrls,
    };
  } catch {
    return EMPTY_TRANSPORT_RELAY_PERSISTENCE;
  }
};

export const readCheckpointRelayUrlSet = (
  checkpoints: ReadonlyArray<RelayCheckpointRecord>,
): ReadonlySet<string> => buildCheckpointRelayUrlSet(checkpoints);

/**
 * Merge user relay settings with transport-engine persistence for supervisor failover.
 * User ordering is preserved; engine URLs append unseen candidates.
 */
export const mergeSupervisorRelayUrlCandidates = (params: Readonly<{
  userEnabledRelayUrls: ReadonlyArray<string>;
  engineConfiguredRelayUrls: ReadonlyArray<string>;
}>): ReadonlyArray<string> => {
  const seen = new Set<string>();
  const merged: string[] = [];
  const append = (url: string): void => {
    const trimmed = url.trim();
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    merged.push(trimmed);
  };
  for (const url of params.userEnabledRelayUrls) {
    append(url);
  }
  for (const url of params.engineConfiguredRelayUrls) {
    append(url);
  }
  return merged;
};
