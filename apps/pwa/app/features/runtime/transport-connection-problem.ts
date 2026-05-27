"use client";

/**
 * Maps transport/network failures to user-visible connection problems.
 * Local shell code must not treat these as fatal app errors.
 */
export type TransportConnectionProblem = Readonly<{
  kind: "connection" | "offline" | "timeout" | "unavailable";
  message: string;
  retryable: boolean;
}>;

const CONNECTION_MARKERS = [
  "network",
  "fetch",
  "websocket",
  "wss://",
  "ws://",
  "relay",
  "timed out",
  "timeout",
  "econnrefused",
  "enotfound",
  "offline",
  "failed to fetch",
  "connection",
] as const;

export const classifyTransportFailure = (
  error: unknown,
  fallbackMessage = "Connection unavailable. Local data is still available.",
): TransportConnectionProblem => {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return {
      kind: "offline",
      message: "You appear to be offline. Local data is still available.",
      retryable: true,
    };
  }

  const message = error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : "";

  const normalized = message.trim().toLowerCase();
  if (!normalized) {
    return {
      kind: "unavailable",
      message: fallbackMessage,
      retryable: true,
    };
  }

  if (normalized.includes("timed out") || normalized.includes("timeout")) {
    return {
      kind: "timeout",
      message: "Connection timed out. Try again when the network is stable.",
      retryable: true,
    };
  }

  if (CONNECTION_MARKERS.some((marker) => normalized.includes(marker))) {
    return {
      kind: "connection",
      message: fallbackMessage,
      retryable: true,
    };
  }

  return {
    kind: "unavailable",
    message: fallbackMessage,
    retryable: true,
  };
};
