import type { ConduitDescriptor, ConduitDriverPort } from "@obscur/conduit-mesh-contracts";

import { createCustomHttpConduitDriver } from "./custom-http-conduit-driver";
import type { ConduitMeshFetch } from "./conduit-http-utils";
import { normalizeConduitBaseUrl } from "./conduit-http-utils";

export type TeamRelayConduitDriverOptions = Readonly<{
  descriptor: ConduitDescriptor;
  fetch: ConduitMeshFetch;
  now?: () => number;
}>;

/** Map team relay endpoint to HTTP mesh base (wss/ws → https/http) for C4 headless HTTP. */
export const resolveTeamRelayHttpBaseUrl = (endpoint: string): string => {
  const trimmed = endpoint.trim();
  if (trimmed.startsWith("wss://")) {
    return normalizeConduitBaseUrl(trimmed.replace(/^wss:\/\//, "https://"));
  }
  if (trimmed.startsWith("ws://")) {
    return normalizeConduitBaseUrl(trimmed.replace(/^ws:\/\//, "http://"));
  }
  return normalizeConduitBaseUrl(trimmed);
};

/**
 * Team relay conduit — carries Obscur envelopes via operator mesh HTTP v1 gateway.
 * WebSocket Nostr wire is the `nostr_ws` dialect adapter (C6).
 */
export const createTeamRelayConduitDriver = (
  options: TeamRelayConduitDriverOptions,
): ConduitDriverPort => {
  const httpBase = resolveTeamRelayHttpBaseUrl(options.descriptor.endpoints[0] ?? "");
  const httpDescriptor: ConduitDescriptor = {
    ...options.descriptor,
    dialect: "team_relay",
    endpoints: httpBase ? [httpBase] : [],
  };

  return createCustomHttpConduitDriver({
    descriptor: httpDescriptor,
    fetch: options.fetch,
    now: options.now,
  });
};
