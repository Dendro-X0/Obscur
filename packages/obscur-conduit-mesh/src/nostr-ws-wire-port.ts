import { extractEventIdFromNostrWirePayload } from "@obscur/conduit-mesh-contracts";

export type NostrWsWirePublishResult = Readonly<{
  accepted: boolean;
  eventId?: string;
  errorMessage?: string;
  okMessage: string;
}>;

export type NostrWsWirePort = Readonly<{
  publish: (
    relayUrl: string,
    wirePayload: string,
  ) => Promise<NostrWsWirePublishResult>;
  probe?: (relayUrl: string) => Promise<Readonly<{ healthy: boolean; detail?: string }>>;
}>;

export type InMemoryNostrWsWireOptions = Readonly<{
  rejectRelayUrls?: ReadonlySet<string>;
  offlineRelayUrls?: ReadonlySet<string>;
}>;

const buildOkMessage = (eventId: string, accepted: boolean, reason = ""): string => (
  JSON.stringify(["OK", eventId, accepted, reason])
);

export const createInMemoryNostrWsWire = (
  options: InMemoryNostrWsWireOptions = {},
): NostrWsWirePort => ({
  publish: async (relayUrl, wirePayload) => {
    if (options.offlineRelayUrls?.has(relayUrl)) {
      return {
        accepted: false,
        errorMessage: "relay_offline",
        okMessage: buildOkMessage("offline", false, "relay_offline"),
      };
    }

    const eventId = extractEventIdFromNostrWirePayload(wirePayload) ?? "unknown-event";

    if (options.rejectRelayUrls?.has(relayUrl)) {
      return {
        accepted: false,
        eventId,
        errorMessage: "relay_rejected",
        okMessage: buildOkMessage(eventId, false, "relay_rejected"),
      };
    }

    return {
      accepted: true,
      eventId,
      okMessage: buildOkMessage(eventId, true, ""),
    };
  },

  probe: async (relayUrl) => {
    if (options.offlineRelayUrls?.has(relayUrl)) {
      return { healthy: false, detail: "relay_offline" };
    }
    return { healthy: true };
  },
});
