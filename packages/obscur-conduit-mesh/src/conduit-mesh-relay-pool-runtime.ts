import type {
  ConduitDescriptor,
  MeshEnvelope,
} from "@obscur/conduit-mesh-contracts";

import type { ConduitMesh } from "./create-conduit-mesh";
import { createConduitMesh } from "./create-conduit-mesh";
import { createConduitDriverFromDescriptor } from "./create-conduit-driver";
import type { ConduitMeshFetch } from "./conduit-http-utils";
import { mapMeshSnapshotToRelayActivitySnapshot } from "./map-mesh-snapshot-to-relay-activity";
import type { MeshRelayActivitySnapshot } from "./map-mesh-snapshot-to-relay-activity";

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
  getTransportActivitySnapshot: () => Promise<MeshRelayActivitySnapshot>;
  isConnected: () => Promise<boolean>;
  dispose: () => void;
}>;

const urlsToConduitDescriptors = (urls: ReadonlyArray<string>): ReadonlyArray<ConduitDescriptor> => (
  urls.map((url, index) => ({
    conduitId: `url-${index}-${url}`,
    dialect: url.startsWith("ws") ? "team_relay" as const : "custom" as const,
    endpoints: [url],
    capabilities: ["publish", "subscribe"],
    networkPolicy: "clearnet" as const,
    trustTier: "user_configured" as const,
    enabled: true,
    priority: index,
  }))
);

const buildEnvelopeFromPayload = (
  payload: string,
  profileId: string,
): MeshEnvelope => ({
  envelopeId: `mesh-pool-${Date.now()}`,
  scope: { profileId },
  messageScope: "dm",
  audience: { kind: "dm", recipientPublicKeyHex: "mesh-pool-broadcast" },
  ciphertext: new TextEncoder().encode(payload),
  evidenceClass: "at_least_one_conduit_accept",
  createdAtUnixMs: Date.now(),
});

export type CreateConduitMeshRelayPoolRuntimeParams = Readonly<{
  profileId: string;
  fetch?: ConduitMeshFetch;
  now?: () => number;
}>;

export const createConduitMeshRelayPoolRuntime = (
  params: CreateConduitMeshRelayPoolRuntimeParams,
): ConduitMeshRelayPoolRuntime => {
  const mesh = createConduitMesh({
    scope: { profileId: params.profileId },
    now: params.now,
    createDriver: params.fetch
      ? (descriptor) => createConduitDriverFromDescriptor(descriptor, {
        fetch: params.fetch!,
        now: params.now,
      })
      : undefined,
  });

  let configuredUrls: ReadonlyArray<string> = [];

  return {
    mesh,

    configureUrls: async (urls) => {
      configuredUrls = urls;
      await mesh.configureConduits(urlsToConduitDescriptors(urls));
    },

    publishToUrls: async (urls, payload, options) => {
      const targetUrls = urls.length > 0 ? urls : configuredUrls;
      const quorumRequired = options?.quorumRequired ?? 1;
      const profileId = options?.profileId ?? params.profileId;
      const results: ConduitMeshRelayPoolPublishResult[] = [];
      let successCount = 0;

      for (const url of targetUrls) {
        const descriptor = urlsToConduitDescriptors([url])[0]!;
        const driver = params.fetch
          ? createConduitDriverFromDescriptor(descriptor, { fetch: params.fetch, now: params.now })
          : createConduitDriverFromDescriptor(descriptor, { now: params.now });

        const outcome = await driver.publish(buildEnvelopeFromPayload(payload, profileId));
        const entry: ConduitMeshRelayPoolPublishResult = {
          success: outcome.accepted,
          relayUrl: url,
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
      configuredUrls = [];
    },
  };
};
