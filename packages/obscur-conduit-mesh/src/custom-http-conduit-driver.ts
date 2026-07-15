import type {
  ConduitDescriptor,
  ConduitDriverPort,
  MeshEnvelope,
  MeshEvidenceRecord,
  MeshInterest,
  MeshPublishOutcome,
} from "@obscur/conduit-mesh-contracts";
import {
  CUSTOM_CONDUIT_HTTP_PATHS,
  CUSTOM_CONDUIT_HTTP_V1,
} from "@obscur/conduit-mesh-contracts";
import type { CustomConduitHealthResponse, CustomConduitPublishResponse } from "@obscur/conduit-mesh-contracts";

import type { ConduitMeshFetch } from "./conduit-http-utils";
import { encodeCiphertextBase64, normalizeConduitBaseUrl } from "./conduit-http-utils";
import {
  isCustomHttpPullCapable,
  longPollHttpMeshEnvelopes,
  openSseHttpMeshEnvelopeSession,
  pullHttpMeshEnvelopes,
  pullItemMatchesInterests,
  pullItemToMeshEnvelope,
} from "./custom-http-pull";

export type CustomHttpConduitDriverOptions = Readonly<{
  descriptor: ConduitDescriptor;
  fetch: ConduitMeshFetch;
  now?: () => number;
  pullIntervalMs?: number;
  /** Long-poll wait for GET /mesh/v1/stream (C12). */
  streamTimeoutMs?: number;
  onInbound?: (envelope: MeshEnvelope) => void;
}>;

let customHttpEvidenceCounter = 0;

const nextEvidenceId = (prefix: string): string => {
  customHttpEvidenceCounter += 1;
  return `${prefix}-${customHttpEvidenceCounter}`;
};

export const resetCustomHttpConduitDriverCounters = (): void => {
  customHttpEvidenceCounter = 0;
};

const buildEvidence = (
  params: Readonly<{
    envelope: MeshEnvelope;
    kind: MeshEvidenceRecord["kind"];
    descriptor: ConduitDescriptor;
    now: () => number;
    externalRef?: string;
    failureReason?: string;
  }>,
): MeshEvidenceRecord => ({
  evidenceId: nextEvidenceId(params.descriptor.conduitId),
  envelopeId: params.envelope.envelopeId,
  kind: params.kind,
  atUnixMs: params.now(),
  conduitId: params.descriptor.conduitId,
  dialect: params.descriptor.dialect,
  externalRef: params.externalRef,
  failureReason: params.failureReason,
});

const healthSupportsLongPoll = (health: CustomConduitHealthResponse | null): boolean => (
  Boolean(health?.capabilities?.includes("long_poll"))
);

const healthSupportsSse = (health: CustomConduitHealthResponse | null): boolean => (
  Boolean(health?.capabilities?.includes("sse"))
);

export const createCustomHttpConduitDriver = (
  options: CustomHttpConduitDriverOptions,
): ConduitDriverPort => {
  const now = options.now ?? (() => Date.now());
  const baseUrl = normalizeConduitBaseUrl(options.descriptor.endpoints[0] ?? "");
  const pullIntervalMs = options.pullIntervalMs ?? 3_000;
  const streamTimeoutMs = options.streamTimeoutMs ?? 25_000;
  const seenEnvelopeIds = new Set<string>();
  const pullCursorsByRecipient = new Map<string, string | undefined>();
  let pullTimer: ReturnType<typeof setInterval> | undefined;
  let streamAbort: AbortController | undefined;
  let streamLoopActive = false;

  const deliverPageItems = (
    page: Awaited<ReturnType<typeof pullHttpMeshEnvelopes>>,
    interests: ReadonlyArray<MeshInterest>,
    cursorKey: string,
  ): number => {
    let delivered = 0;
    for (const item of page.items) {
      if (!pullItemMatchesInterests(item, interests)) {
        continue;
      }
      if (seenEnvelopeIds.has(item.envelopeId)) {
        continue;
      }
      seenEnvelopeIds.add(item.envelopeId);
      const profileId = interests[0]?.scope.profileId ?? "default";
      options.onInbound?.(pullItemToMeshEnvelope(item, profileId));
      delivered += 1;
    }
    if (page.cursor) {
      pullCursorsByRecipient.set(cursorKey, page.cursor);
    }
    return delivered;
  };

  const resolvePullJobs = (
    interests: ReadonlyArray<MeshInterest>,
  ): ReadonlyArray<Readonly<{ recipientPublicKeyHex?: string; cursorKey: string }>> => {
    const dmRecipients = Array.from(new Set(
      interests
        .filter((interest) => interest.audience.kind === "dm")
        .map((interest) => (
          interest.audience.kind === "dm"
            ? interest.audience.recipientPublicKeyHex.trim().toLowerCase()
            : ""
        ))
        .filter((value) => value.length > 0),
    ));

    return dmRecipients.length > 0
      ? dmRecipients.map((recipientPublicKeyHex) => ({
        recipientPublicKeyHex,
        cursorKey: recipientPublicKeyHex,
      }))
      : [{ cursorKey: "*" }];
  };

  const runPullCycle = async (interests: ReadonlyArray<MeshInterest>): Promise<void> => {
    if (!baseUrl || !options.onInbound || interests.length === 0) {
      return;
    }

    const pullJobs = resolvePullJobs(interests);
    const pullPages = await Promise.all(pullJobs.map(async (job) => {
      const page = await pullHttpMeshEnvelopes({
        baseUrl,
        fetch: options.fetch,
        cursor: pullCursorsByRecipient.get(job.cursorKey),
        recipientPublicKeyHex: job.recipientPublicKeyHex,
      });
      return { job, page };
    }));

    for (const { job, page } of pullPages) {
      deliverPageItems(page, interests, job.cursorKey);
    }
  };

  const runSseLoop = async (
    interests: ReadonlyArray<MeshInterest>,
    signal: AbortSignal,
  ): Promise<void> => {
    if (!baseUrl || !options.onInbound || interests.length === 0) {
      return;
    }

    streamLoopActive = true;
    while (!signal.aborted && streamLoopActive) {
      const pullJobs = resolvePullJobs(interests);
      await Promise.all(pullJobs.map(async (job) => {
        if (signal.aborted) {
          return;
        }
        try {
          await openSseHttpMeshEnvelopeSession({
            baseUrl,
            fetch: options.fetch,
            cursor: pullCursorsByRecipient.get(job.cursorKey),
            recipientPublicKeyHex: job.recipientPublicKeyHex,
            signal,
            onItem: (item, cursor) => {
              if (!pullItemMatchesInterests(item, interests)) {
                return;
              }
              if (seenEnvelopeIds.has(item.envelopeId)) {
                if (cursor) {
                  pullCursorsByRecipient.set(job.cursorKey, cursor);
                }
                return;
              }
              seenEnvelopeIds.add(item.envelopeId);
              if (cursor) {
                pullCursorsByRecipient.set(job.cursorKey, cursor);
              }
              const profileId = interests[0]?.scope.profileId ?? "default";
              options.onInbound?.(pullItemToMeshEnvelope(item, profileId));
            },
          });
        } catch {
          // AbortError or transport blip — reconnect loop unless aborted.
        }
        if (!signal.aborted && streamLoopActive) {
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, 250);
            const onAbort = (): void => {
              clearTimeout(timer);
              resolve();
            };
            if (signal.aborted) {
              onAbort();
              return;
            }
            signal.addEventListener("abort", onAbort, { once: true });
          });
        }
      }));
    }
  };

  const runLongPollLoop = async (
    interests: ReadonlyArray<MeshInterest>,
    signal: AbortSignal,
  ): Promise<void> => {
    if (!baseUrl || !options.onInbound || interests.length === 0) {
      return;
    }

    streamLoopActive = true;
    while (!signal.aborted && streamLoopActive) {
      const pullJobs = resolvePullJobs(interests);
      await Promise.all(pullJobs.map(async (job) => {
        if (signal.aborted) {
          return;
        }
        const startedAt = now();
        try {
          const page = await longPollHttpMeshEnvelopes({
            baseUrl,
            fetch: options.fetch,
            cursor: pullCursorsByRecipient.get(job.cursorKey),
            recipientPublicKeyHex: job.recipientPublicKeyHex,
            timeoutMs: streamTimeoutMs,
            signal,
          });
          const delivered = deliverPageItems(page, interests, job.cursorKey);

          // Guard against immediate-empty or all-seen pages (busy-spin / sync stubs).
          if (delivered === 0 && !signal.aborted) {
            const elapsed = now() - startedAt;
            if (page.items.length === 0 || elapsed < 50) {
              await new Promise<void>((resolve) => {
                const timer = setTimeout(resolve, Math.min(250, streamTimeoutMs));
                const onAbort = (): void => {
                  clearTimeout(timer);
                  resolve();
                };
                if (signal.aborted) {
                  onAbort();
                  return;
                }
                signal.addEventListener("abort", onAbort, { once: true });
              });
            }
          }
        } catch {
          // AbortError or transport blip — loop exits on next abort check.
        }
      }));
    }
  };

  const probeHealth = async (): Promise<CustomConduitHealthResponse | null> => {
    if (!baseUrl) {
      return null;
    }
    try {
      const response = await options.fetch(`${baseUrl}${CUSTOM_CONDUIT_HTTP_PATHS.health}`);
      const body = await response.json() as CustomConduitHealthResponse;
      if (response.ok && body.ok && body.contractVersion === CUSTOM_CONDUIT_HTTP_V1) {
        return body;
      }
      return null;
    } catch {
      return null;
    }
  };

  return {
    conduitId: options.descriptor.conduitId,
    dialect: options.descriptor.dialect,
    publish: async (envelope): Promise<MeshPublishOutcome> => {
      const published = buildEvidence({
        envelope,
        kind: "published_to_conduit",
        descriptor: options.descriptor,
        now,
      });

      if (!baseUrl) {
        const failed = buildEvidence({
          envelope,
          kind: "publish_failed",
          descriptor: options.descriptor,
          now,
          failureReason: "missing_endpoint",
        });
        return {
          envelopeId: envelope.envelopeId,
          accepted: false,
          evidence: [published, failed],
          errorMessage: "missing_endpoint",
        };
      }

      const response = await options.fetch(`${baseUrl}${CUSTOM_CONDUIT_HTTP_PATHS.publish}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contractVersion: CUSTOM_CONDUIT_HTTP_V1,
          envelopeId: envelope.envelopeId,
          correlationId: envelope.correlationId,
          messageScope: envelope.messageScope,
          audience: envelope.audience,
          ciphertextBase64: encodeCiphertextBase64(envelope.ciphertext),
          createdAtUnixMs: envelope.createdAtUnixMs,
        }),
      });

      let body: CustomConduitPublishResponse = { accepted: false };
      try {
        body = await response.json() as CustomConduitPublishResponse;
      } catch {
        body = { accepted: false, errorMessage: "invalid_publish_response" };
      }

      if (!response.ok || !body.accepted) {
        const failed = buildEvidence({
          envelope,
          kind: "publish_failed",
          descriptor: options.descriptor,
          now,
          failureReason: body.errorMessage ?? `http_${response.status}`,
        });
        return {
          envelopeId: envelope.envelopeId,
          accepted: false,
          evidence: [published, failed],
          errorMessage: body.errorMessage ?? `http_${response.status}`,
        };
      }

      const accepted = buildEvidence({
        envelope,
        kind: "accepted_by_operator",
        descriptor: options.descriptor,
        now,
        externalRef: body.storedRef,
      });

      return {
        envelopeId: envelope.envelopeId,
        accepted: true,
        evidence: [published, accepted],
      };
    },
    subscribe: (interests) => {
      if (!isCustomHttpPullCapable(options.descriptor.dialect) || !options.onInbound) {
        return () => {};
      }

      streamAbort?.abort();
      if (pullTimer) {
        clearInterval(pullTimer);
        pullTimer = undefined;
      }

      const abort = new AbortController();
      streamAbort = abort;

      void (async () => {
        const health = await probeHealth();
        if (abort.signal.aborted) {
          return;
        }
        if (healthSupportsSse(health)) {
          await runSseLoop(interests, abort.signal);
          return;
        }
        if (healthSupportsLongPoll(health)) {
          await runLongPollLoop(interests, abort.signal);
          return;
        }
        void runPullCycle(interests);
        pullTimer = setInterval(() => {
          void runPullCycle(interests);
        }, pullIntervalMs);
      })();

      return () => {
        streamLoopActive = false;
        abort.abort();
        if (streamAbort === abort) {
          streamAbort = undefined;
        }
        if (pullTimer) {
          clearInterval(pullTimer);
          pullTimer = undefined;
        }
      };
    },
    probe: async () => {
      if (!baseUrl) {
        return { health: "offline" as const, detail: "missing_endpoint" };
      }
      try {
        const response = await options.fetch(`${baseUrl}${CUSTOM_CONDUIT_HTTP_PATHS.health}`);
        const body = await response.json() as CustomConduitHealthResponse;
        if (response.ok && body.ok && body.contractVersion === CUSTOM_CONDUIT_HTTP_V1) {
          return { health: "healthy" as const };
        }
        return { health: "degraded" as const, detail: "health_check_failed" };
      } catch {
        return { health: "offline" as const, detail: "health_unreachable" };
      }
    },
  };
};
