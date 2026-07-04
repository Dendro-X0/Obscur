import type { ConduitDescriptor, ConduitDriverPort } from "@obscur/conduit-mesh-contracts";

import { createCoordinationHttpConduitDriver } from "./coordination-http-conduit-driver";
import { createCustomHttpConduitDriver } from "./custom-http-conduit-driver";
import type { ConduitMeshFetch } from "./conduit-http-utils";
import { createNostrWsConduitDriver } from "./nostr-ws-conduit-driver";
import type { NostrWsWirePort } from "./nostr-ws-wire-port";
import { createTeamRelayConduitDriver } from "./team-relay-conduit-driver";
import { createMockConduitDriver } from "./mock-conduit-driver";

export type CreateConduitDriverOptions = Readonly<{
  fetch?: ConduitMeshFetch;
  nostrWire?: NostrWsWirePort;
  nostrSignerPublicKeyHex?: string;
  now?: () => number;
}>;

export const createConduitDriverFromDescriptor = (
  descriptor: ConduitDescriptor,
  options: CreateConduitDriverOptions = {},
): ConduitDriverPort => {
  const fetchImpl = options.fetch ?? globalThis.fetch?.bind(globalThis);
  const now = options.now;

  switch (descriptor.dialect) {
    case "team_relay": {
      if (!fetchImpl) {
        return createMockConduitDriver({ descriptor, now });
      }
      return createTeamRelayConduitDriver({ descriptor, fetch: fetchImpl, now });
    }
    case "coordination_http": {
      if (!fetchImpl) {
        return createMockConduitDriver({ descriptor, now });
      }
      return createCoordinationHttpConduitDriver({ descriptor, fetch: fetchImpl, now });
    }
    case "custom": {
      if (!fetchImpl) {
        return createMockConduitDriver({ descriptor, now });
      }
      return createCustomHttpConduitDriver({ descriptor, fetch: fetchImpl, now });
    }
    case "nostr_ws": {
      if (!options.nostrWire) {
        return createMockConduitDriver({ descriptor, now });
      }
      return createNostrWsConduitDriver({
        descriptor,
        wire: options.nostrWire,
        now,
        signerPublicKeyHex: options.nostrSignerPublicKeyHex,
      });
    }
    default:
      return createMockConduitDriver({ descriptor, now });
  }
};
