import type { RelayPoolRuntime } from "@/app/features/relays/services/relay-pool-runtime-port";

/** Engine-persisted relay URLs that should be subscribed on the pool but are not permanent members. */
export const resolveTransportEnginePoolSubscribeUrls = (params: Readonly<{
  permanentPoolUrls: ReadonlyArray<string>;
  engineOnlyRelayUrls: ReadonlyArray<string>;
  engineCheckpointRelayUrls: ReadonlyArray<string>;
}>): ReadonlyArray<string> => {
  const permanent = new Set(
    params.permanentPoolUrls.map((url) => url.trim()).filter((url) => url.length > 0),
  );
  const seen = new Set<string>();
  const subscribeUrls: string[] = [];
  const append = (url: string): void => {
    const trimmed = url.trim();
    if (!trimmed || permanent.has(trimmed) || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    subscribeUrls.push(trimmed);
  };
  for (const url of params.engineCheckpointRelayUrls) {
    append(url);
  }
  for (const url of params.engineOnlyRelayUrls) {
    append(url);
  }
  return subscribeUrls;
};

export const syncTransportEnginePoolSubscriptions = (params: Readonly<{
  pool: Pick<RelayPoolRuntime, "addTransientRelay">;
  subscribeUrls: ReadonlyArray<string>;
}>): number => {
  let subscribedCount = 0;
  for (const url of params.subscribeUrls) {
    params.pool.addTransientRelay(url);
    subscribedCount += 1;
  }
  return subscribedCount;
};
