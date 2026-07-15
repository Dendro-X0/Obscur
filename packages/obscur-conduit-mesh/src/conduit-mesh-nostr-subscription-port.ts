export type ConduitMeshNostrFilter = Readonly<{
  kinds?: ReadonlyArray<number>;
  authors?: ReadonlyArray<string>;
  "#p"?: ReadonlyArray<string>;
  since?: number;
  until?: number;
  limit?: number;
  ids?: ReadonlyArray<string>;
}>;

export type ConduitMeshNostrEvent = Readonly<Record<string, unknown>>;

export type ConduitMeshNostrConnectionSnapshot = Readonly<{
  url: string;
  status: "connecting" | "open" | "closed" | "error";
  updatedAtUnixMs: number;
  errorMessage?: string;
}>;

export type ConduitMeshNostrSubscriptionPort = Readonly<{
  getConnectionSnapshots: () => ReadonlyArray<ConduitMeshNostrConnectionSnapshot>;
  subscribe: (
    filters: ReadonlyArray<ConduitMeshNostrFilter>,
    onEvent: (event: ConduitMeshNostrEvent, relayUrl: string) => void,
  ) => string;
  unsubscribe: (subscriptionId: string) => void;
  subscribeToMessages: (
    handler: (params: Readonly<{ url: string; message: string }>) => void,
  ) => () => void;
  /** Fan-in HTTP/mesh inbound Nostr wire into the same path as WS messages (C10). */
  deliverInboundMessage: (relayUrl: string, message: string) => void;
  sendToOpen: (payload: string) => void;
  dispose: () => void;
}>;
