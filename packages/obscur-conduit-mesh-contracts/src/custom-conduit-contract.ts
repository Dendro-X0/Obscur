/**
 * Minimum HTTP surface for self-hosted Obscur gateways (`custom` dialect).
 * Operators implement these routes; clients use opaque MeshEnvelope JSON + base64 ciphertext.
 *
 * Version: CUSTOM_CONDUIT_HTTP_V1
 */

export const CUSTOM_CONDUIT_HTTP_V1 = "custom_conduit_http_v1" as const;

export const CUSTOM_CONDUIT_HTTP_PATHS = {
  publish: "/mesh/v1/envelopes",
  pull: "/mesh/v1/envelopes",
  stream: "/mesh/v1/stream",
  health: "/mesh/v1/health",
} as const;

/** Wire body for POST publish — ciphertext is base64; routing fields mirror MeshEnvelope subset. */
export type CustomConduitPublishBody = Readonly<{
  contractVersion: typeof CUSTOM_CONDUIT_HTTP_V1;
  envelopeId: string;
  correlationId?: string;
  messageScope: "dm" | "workspace" | "control";
  audience: Readonly<Record<string, unknown>>;
  ciphertextBase64: string;
  createdAtUnixMs: number;
}>;

export type CustomConduitPublishResponse = Readonly<{
  accepted: boolean;
  storedRef?: string;
  errorMessage?: string;
}>;

export type CustomConduitPullItem = Readonly<{
  envelopeId: string;
  messageScope: "dm" | "workspace" | "control";
  audience: Readonly<Record<string, unknown>>;
  ciphertextBase64: string;
  createdAtUnixMs: number;
  storedRef?: string;
}>;

export type CustomConduitPullResponse = Readonly<{
  items: ReadonlyArray<CustomConduitPullItem>;
  cursor?: string;
}>;

export type CustomConduitHealthResponse = Readonly<{
  ok: boolean;
  contractVersion: typeof CUSTOM_CONDUIT_HTTP_V1;
  operatorLabel?: string;
}>;
