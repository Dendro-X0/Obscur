import {
  expandWorkspaceRelayUrlCandidates,
  isLocalWorkspaceRelayHost,
  normalizeWorkspaceRelayUrl,
} from "./workspace-relay-url";

export type LocalWorkspaceRelayPublishResult = Readonly<{
  success: boolean;
  relayUrl: string;
  error?: string;
  latency?: number;
}>;

const LOCAL_PUBLISH_TIMEOUT_MS = 6000;

const parseOkFromMessage = (raw: string): Readonly<{ ok: boolean; eventId?: string; message: string }> | null => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed[0] !== "OK") {
      return null;
    }
    return {
      ok: parsed[2] === true,
      eventId: typeof parsed[1] === "string" ? parsed[1] : undefined,
      message: typeof parsed[3] === "string" ? parsed[3] : "",
    };
  } catch {
    return null;
  }
};

const extractEventId = (payload: string): string | undefined => {
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (Array.isArray(parsed) && parsed[0] === "EVENT") {
      const event = parsed[1] as { id?: string } | undefined;
      return typeof event?.id === "string" ? event.id : undefined;
    }
  } catch {
    // ignore
  }
  return undefined;
};

const isDuplicateAccept = (message: string): boolean => /\bduplicate\b/i.test(message);

/**
 * Publish through a one-shot browser WebSocket to a loopback workspace relay.
 * Bypasses relay-pool bookkeeping when the UI shows CONNECTED but scoped publish cannot find a writable target.
 */
export const publishViaEphemeralLocalWorkspaceSocket = async (
  rawRelayUrl: string,
  payload: string,
  timeoutMs: number = LOCAL_PUBLISH_TIMEOUT_MS,
): Promise<LocalWorkspaceRelayPublishResult> => {
  const canonical = normalizeWorkspaceRelayUrl(rawRelayUrl);
  if (!canonical || !isLocalWorkspaceRelayHost(canonical)) {
    return { success: false, relayUrl: canonical || rawRelayUrl, error: "not_local_workspace_relay" };
  }

  const eventId = extractEventId(payload);
  const candidates = expandWorkspaceRelayUrlCandidates(canonical)
    .map((url) => normalizeWorkspaceRelayUrl(url))
    .filter((url) => url.startsWith("ws://"));

  let lastError = "ephemeral_publish_failed";

  for (const relayUrl of candidates) {
    const start = Date.now();
    const result = await new Promise<LocalWorkspaceRelayPublishResult>((resolve) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finalize = (value: LocalWorkspaceRelayPublishResult): void => {
        if (settled) {
          return;
        }
        settled = true;
        if (timer) {
          clearTimeout(timer);
        }
        try {
          socket.close();
        } catch {
          // ignore
        }
        resolve(value);
      };

      let socket: WebSocket;
      try {
        socket = new WebSocket(relayUrl);
      } catch (error) {
        finalize({
          success: false,
          relayUrl,
          error: error instanceof Error ? error.message : String(error),
        });
        return;
      }

      timer = setTimeout(() => {
        finalize({
          success: false,
          relayUrl,
          error: "Timeout waiting for OK response",
          latency: Date.now() - start,
        });
      }, timeoutMs);

      socket.addEventListener("open", () => {
        try {
          socket.send(payload);
        } catch (error) {
          finalize({
            success: false,
            relayUrl,
            error: error instanceof Error ? error.message : String(error),
            latency: Date.now() - start,
          });
        }
      });

      socket.addEventListener("message", (event) => {
        if (typeof event.data !== "string") {
          return;
        }
        const okFrame = parseOkFromMessage(event.data);
        if (!okFrame) {
          return;
        }
        if (eventId && okFrame.eventId && okFrame.eventId !== eventId) {
          return;
        }
        const accepted = okFrame.ok || isDuplicateAccept(okFrame.message);
        finalize({
          success: accepted,
          relayUrl,
          error: accepted ? undefined : okFrame.message || "relay_rejected_event",
          latency: Date.now() - start,
        });
      });

      socket.addEventListener("error", () => {
        finalize({
          success: false,
          relayUrl,
          error: "WebSocket error",
          latency: Date.now() - start,
        });
      });

      socket.addEventListener("close", (event) => {
        if (!settled && !event.wasClean) {
          finalize({
            success: false,
            relayUrl,
            error: event.reason || "WebSocket closed before OK",
            latency: Date.now() - start,
          });
        }
      });
    });

    if (result.success) {
      return { ...result, relayUrl: canonical };
    }
    const error = result.error ?? lastError;
    if (
      error
      && !error.includes("Timeout")
      && !error.includes("WebSocket error")
      && !error.includes("closed before OK")
    ) {
      return { ...result, relayUrl: canonical, error };
    }
    lastError = error;
  }

  return { success: false, relayUrl: canonical, error: lastError };
};
