import type {
  ConduitDescriptor,
  MeshEnvelope,
  MeshInterest,
  MeshUnsubscribe,
} from "@obscur/conduit-mesh-contracts";
import {
  isMeshNativeDmWirePayload,
  isNostrEventWirePayload,
  meshNativeDmWireToNostrEventWire,
  nostrEventWireToMeshNativeDmWire,
} from "@obscur/conduit-mesh-contracts";

import type { MeshTorRuntimeState } from "@obscur/conduit-mesh-contracts";

import type { ConduitMesh } from "./create-conduit-mesh";
import { createConduitMesh } from "./create-conduit-mesh";
import { createConduitDriverFromDescriptor } from "./create-conduit-driver";
import type { ConduitMeshFetch } from "./conduit-http-utils";
import type { ConduitSocksFetch } from "./create-routed-conduit-mesh-fetch";
import { createRoutedConduitMeshFetch } from "./create-routed-conduit-mesh-fetch";
import { mapMeshSnapshotToRelayActivitySnapshot } from "./map-mesh-snapshot-to-relay-activity";
import type { MeshRelayActivitySnapshot } from "./map-mesh-snapshot-to-relay-activity";
import { resolveRelayPoolConduitDescriptors } from "./resolve-relay-pool-conduit-descriptors";
import type { NostrWsWirePort } from "./nostr-ws-wire-port";

export type ConduitMeshRelayPoolPublishResult = Readonly<{
  success: boolean;
  relayUrl: string;
  error?: string;
}>;

export type ConduitMeshRelayPoolMultiPublishResult = Readonly<{
  success: boolean;
  successCount: number;
  totalRelays: number;
  metQuorum: boolean;
  quorumRequired: number;
  results: ReadonlyArray<ConduitMeshRelayPoolPublishResult>;
}>;

export type ConduitMeshRelayPoolRuntime = Readonly<{
  mesh: ConduitMesh;
  configureUrls: (urls: ReadonlyArray<string>) => Promise<void>;
  publishToUrls: (
    urls: ReadonlyArray<string>,
    payload: string,
    options?: Readonly<{ quorumRequired?: number; profileId?: string }>,
  ) => Promise<ConduitMeshRelayPoolMultiPublishResult>;
  registerInboundInterests: (interests: ReadonlyArray<MeshInterest>) => MeshUnsubscribe;
  getTransportActivitySnapshot: () => Promise<MeshRelayActivitySnapshot>;
  isConnected: () => Promise<boolean>;
  dispose: () => void;
}>;

const resolveRecipientFromEventTags = (
  event: { tags?: unknown },
): string | undefined => {
  if (!Array.isArray(event.tags)) {
    return undefined;
  }
  for (const tag of event.tags) {
    if (
      Array.isArray(tag)
      && tag[0] === "p"
      && typeof tag[1] === "string"
      && tag[1].trim().length > 0
    ) {
      return tag[1].trim().toLowerCase();
    }
  }
  return undefined;
};

const resolveDmAudienceFromPayload = (
  payload: string,
): MeshEnvelope["audience"] => {
  try {
    if (isNostrEventWirePayload(payload)) {
      const parsed = JSON.parse(payload) as unknown;
      if (Array.isArray(parsed) && parsed[0] === "EVENT" && typeof parsed[1] === "object" && parsed[1]) {
        const recipient = resolveRecipientFromEventTags(parsed[1] as { tags?: unknown });
        if (recipient) {
          return { kind: "dm", recipientPublicKeyHex: recipient };
        }
      }
    } else if (isMeshNativeDmWirePayload(payload)) {
      const parsed = JSON.parse(payload) as { event?: { tags?: unknown } };
      const recipient = parsed.event ? resolveRecipientFromEventTags(parsed.event) : undefined;
      if (recipient) {
        return { kind: "dm", recipientPublicKeyHex: recipient };
      }
    }
  } catch {
    // fall through
  }
  return { kind: "dm", recipientPublicKeyHex: "mesh-pool-broadcast" };
};

/** HTTP mesh dialect stores mesh-native DM wire — not NIP-01 EVENT array framing. */
const resolveHttpMeshCiphertextPayload = (payload: string): string => {
  if (isNostrEventWirePayload(payload)) {
    return nostrEventWireToMeshNativeDmWire(payload);
  }
  return payload;
};

const resolveInboundNostrWire = (wireMessage: string): string | undefined => {
  if (isMeshNativeDmWirePayload(wireMessage)) {
    return meshNativeDmWireToNostrEventWire(wireMessage);
  }
  if (isNostrEventWirePayload(wireMessage)) {
    return wireMessage;
  }
  return undefined;
};

const buildEnvelopeFromPayload = (
  payload: string,
  profileId: string,
): MeshEnvelope => ({
  envelopeId: `mesh-pool-${Date.now()}`,
  scope: { profileId },
  messageScope: "dm",
  audience: resolveDmAudienceFromPayload(payload),
  ciphertext: new TextEncoder().encode(payload),
  evidenceClass: "at_least_one_conduit_accept",
  createdAtUnixMs: Date.now(),
});

const resolveTargetUrls = (
  urls: ReadonlyArray<string>,
  configuredUrls: ReadonlyArray<string>,
): ReadonlyArray<string> => (
  urls.length > 0 ? urls : configuredUrls
);

const resolveDescriptorForUrl = (
  url: string,
  descriptors: ReadonlyArray<ConduitDescriptor>,
): ConduitDescriptor | undefined => (
  descriptors.find((descriptor) => descriptor.endpoints[0] === url)
);

/** HTTP mesh dialects carry Nostr EVENT as MeshEnvelope ciphertext — not WebSocket EVENT. */
const isMeshHttpPublishUrl = (
  url: string,
  descriptors: ReadonlyArray<ConduitDescriptor>,
): boolean => {
  const dialect = resolveDescriptorForUrl(url, descriptors)?.dialect;
  return dialect === "team_relay" || dialect === "custom" || dialect === "coordination_http";
};

const mergePublishResults = (
  parts: ReadonlyArray<ConduitMeshRelayPoolMultiPublishResult>,
  quorumRequired: number,
): ConduitMeshRelayPoolMultiPublishResult => {
  const results = parts.flatMap((part) => part.results);
  const successCount = results.filter((entry) => entry.success).length;
  const totalRelays = results.length;
  const metQuorum = successCount >= quorumRequired;
  return {
    success: metQuorum,
    successCount,
    totalRelays,
    metQuorum,
    quorumRequired,
    results,
  };
};

export type CreateConduitMeshRelayPoolRuntimeParams = Readonly<{
  profileId: string;
  fetch?: ConduitMeshFetch;
  /** Desktop SOCKS HTTP (C13). When omitted, socks routes return 503 socks_unavailable. */
  socksFetch?: ConduitSocksFetch;
  nostrWire?: NostrWsWirePort;
  nostrSignerPublicKeyHex?: string;
  now?: () => number;
  /** Host-supplied Tor readiness (desktop `get_tor_status` in C9). */
  getTorState?: () => MeshTorRuntimeState | Promise<MeshTorRuntimeState>;
  /** Poll interval for HTTP pull/subscribe drivers (C10). */
  httpPullIntervalMs?: number;
  /** Long-poll wait for GET /mesh/v1/stream when gateway advertises long_poll (C12). */
  streamTimeoutMs?: number;
  /** Fan-in HTTP inbound Nostr wire payloads to the client subscribe path (C10). */
  bridgeInboundWire?: (relayUrl: string, wireMessage: string) => void;
}>;

const unavailableSocksFetch: ConduitSocksFetch = async () => (
  new Response(JSON.stringify({ error: "socks_unavailable" }), {
    status: 503,
    headers: {
      "content-type": "application/json",
      "x-obscur-fetch-route": "socks_unavailable",
    },
  })
);

export const createConduitMeshRelayPoolRuntime = (
  params: CreateConduitMeshRelayPoolRuntimeParams,
): ConduitMeshRelayPoolRuntime => {
  const httpPullIntervalMs = params.httpPullIntervalMs ?? 3_000;
  const streamTimeoutMs = params.streamTimeoutMs ?? 25_000;
  const directFetch = params.fetch ?? globalThis.fetch.bind(globalThis);
  const socksFetch = params.socksFetch ?? unavailableSocksFetch;
  const getTorState = params.getTorState ?? (async () => ({ configured: false, ready: false }));

  const mesh = createConduitMesh({
    scope: { profileId: params.profileId },
    now: params.now,
    getTorState,
    createDriver: (descriptor, ctx) => {
      const routedFetch = createRoutedConduitMeshFetch({
        descriptor,
        getTorState,
        directFetch,
        socksFetch,
      });
      return createConduitDriverFromDescriptor(descriptor, {
        fetch: routedFetch,
        nostrWire: params.nostrWire,
        nostrSignerPublicKeyHex: params.nostrSignerPublicKeyHex,
        now: params.now,
        onInbound: ctx.deliverInbound,
        pullIntervalMs: httpPullIntervalMs,
        streamTimeoutMs,
      });
    },
  });

  let configuredUrls: ReadonlyArray<string> = [];
  let configuredDescriptors: ReadonlyArray<ConduitDescriptor> = [];
  let inboundInterestUnsub: MeshUnsubscribe | undefined;

  const unsubscribeMeshInbound = mesh.subscribeInbound(({ envelope, conduitId }) => {
    const descriptor = configuredDescriptors.find((entry) => entry.conduitId === conduitId);
    const relayUrl = descriptor?.endpoints[0];
    if (!relayUrl || !params.bridgeInboundWire) {
      return;
    }
    if (descriptor.dialect !== "team_relay" && descriptor.dialect !== "custom") {
      return;
    }

    const wireMessage = new TextDecoder().decode(envelope.ciphertext);
    const nostrWire = resolveInboundNostrWire(wireMessage);
    if (!nostrWire) {
      return;
    }
    params.bridgeInboundWire(relayUrl, nostrWire);
  });

  const publishPassthroughNostrEvent = async (
    targetUrls: ReadonlyArray<string>,
    payload: string,
    quorumRequired: number,
  ): Promise<ConduitMeshRelayPoolMultiPublishResult> => {
    if (!params.nostrWire) {
      return {
        success: false,
        successCount: 0,
        totalRelays: targetUrls.length,
        metQuorum: false,
        quorumRequired,
        results: targetUrls.map((relayUrl) => ({
          success: false,
          relayUrl,
          error: "nostr_wire_unavailable",
        })),
      };
    }

    const results: ConduitMeshRelayPoolPublishResult[] = [];
    let successCount = 0;

    for (const relayUrl of targetUrls) {
      const outcome = await params.nostrWire.publish(relayUrl, payload);
      const entry: ConduitMeshRelayPoolPublishResult = {
        success: outcome.accepted,
        relayUrl,
        error: outcome.errorMessage,
      };
      results.push(entry);
      if (outcome.accepted) {
        successCount += 1;
      }
    }

    const metQuorum = successCount >= quorumRequired;
    return {
      success: metQuorum,
      successCount,
      totalRelays: targetUrls.length,
      metQuorum,
      quorumRequired,
      results,
    };
  };

  const publishViaMeshEnvelope = async (
    targetUrls: ReadonlyArray<string>,
    payload: string,
    profileId: string,
    quorumRequired: number,
  ): Promise<ConduitMeshRelayPoolMultiPublishResult> => {
    const allowedConduitIds = targetUrls.map((url) => (
      resolveDescriptorForUrl(url, configuredDescriptors)?.conduitId
    )).filter((value): value is string => Boolean(value));

    const meshPayload = resolveHttpMeshCiphertextPayload(payload);
    const envelope: MeshEnvelope = {
      ...buildEnvelopeFromPayload(meshPayload, profileId),
      ...(allowedConduitIds.length > 0 ? { allowedConduitIds } : {}),
    };

    const meshOutcome = await mesh.publishEnvelope(envelope);
    const successCount = meshOutcome.accepted ? 1 : 0;
    const results: ConduitMeshRelayPoolPublishResult[] = targetUrls.map((relayUrl) => ({
      success: meshOutcome.accepted,
      relayUrl,
      error: meshOutcome.errorMessage,
    }));

    return {
      success: successCount >= quorumRequired,
      successCount,
      totalRelays: targetUrls.length,
      metQuorum: successCount >= quorumRequired,
      quorumRequired,
      results,
    };
  };

  return {
    mesh,

    configureUrls: async (urls) => {
      configuredUrls = urls;
      configuredDescriptors = resolveRelayPoolConduitDescriptors(urls);
      await mesh.configureConduits(configuredDescriptors);
    },

    publishToUrls: async (urls, payload, options) => {
      const targetUrls = resolveTargetUrls(urls, configuredUrls);
      const quorumRequired = options?.quorumRequired ?? 1;
      const profileId = options?.profileId ?? params.profileId;

      if (targetUrls.length === 0) {
        return {
          success: false,
          successCount: 0,
          totalRelays: 0,
          metQuorum: false,
          quorumRequired,
          results: [],
        };
      }

      if (isNostrEventWirePayload(payload)) {
        const meshHttpTargets = targetUrls.filter((url) => (
          isMeshHttpPublishUrl(url, configuredDescriptors)
        ));
        const wireTargets = targetUrls.filter((url) => (
          !isMeshHttpPublishUrl(url, configuredDescriptors)
        ));
        const parts: ConduitMeshRelayPoolMultiPublishResult[] = [];
        if (meshHttpTargets.length > 0) {
          parts.push(await publishViaMeshEnvelope(
            meshHttpTargets,
            payload,
            profileId,
            quorumRequired,
          ));
        }
        if (wireTargets.length > 0) {
          parts.push(await publishPassthroughNostrEvent(
            wireTargets,
            payload,
            quorumRequired,
          ));
        }
        if (parts.length === 0) {
          return {
            success: false,
            successCount: 0,
            totalRelays: targetUrls.length,
            metQuorum: false,
            quorumRequired,
            results: targetUrls.map((relayUrl) => ({
              success: false,
              relayUrl,
              error: "no_publish_path",
            })),
          };
        }
        return mergePublishResults(parts, quorumRequired);
      }

      return publishViaMeshEnvelope(targetUrls, payload, profileId, quorumRequired);
    },

    registerInboundInterests: (interests) => {
      inboundInterestUnsub?.();
      inboundInterestUnsub = mesh.registerInboundInterests(interests);
      return () => {
        inboundInterestUnsub?.();
        inboundInterestUnsub = undefined;
      };
    },

    getTransportActivitySnapshot: async () => {
      const snapshot = await mesh.getSnapshot({ profileId: params.profileId });
      return mapMeshSnapshotToRelayActivitySnapshot(snapshot);
    },

    isConnected: async () => {
      const snapshot = await mesh.getSnapshot({ profileId: params.profileId });
      return snapshot.readiness !== "offline";
    },

    dispose: () => {
      inboundInterestUnsub?.();
      inboundInterestUnsub = undefined;
      unsubscribeMeshInbound();
      configuredUrls = [];
      configuredDescriptors = [];
    },
  };
};
