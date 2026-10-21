/**
 * PB2-A — URL-only reputation request builder.
 * Forbidden: message body, contact graph, keys, pubkey, conversation id.
 */

export type UrlReputationRequest = Readonly<{
  url: string;
  providerLabel: string;
}>;

export type UrlReputationBuildResult =
  | Readonly<{ ok: true; request: UrlReputationRequest }>
  | Readonly<{ ok: false; reason: UrlReputationBuildRejectReason }>;

export type UrlReputationBuildRejectReason =
  | "empty_url"
  | "invalid_url"
  | "forbidden_fields_present"
  | "non_http_scheme";

const FORBIDDEN_INPUT_KEYS = [
  "body",
  "messageBody",
  "content",
  "message",
  "contactGraph",
  "contacts",
  "pubkey",
  "publicKey",
  "privateKey",
  "nsec",
  "npub",
  "keys",
  "conversationId",
  "peerPubkey",
  "senderPubkey",
] as const;

export type UrlReputationBuilderInput = Readonly<{
  url: string;
  providerLabel?: string;
  /** Any extra bag — presence of forbidden keys rejects the build. */
  extras?: Readonly<Record<string, unknown>>;
}>;

const hasForbiddenFields = (extras: Readonly<Record<string, unknown>> | undefined): boolean => {
  if (!extras) {
    return false;
  }
  return FORBIDDEN_INPUT_KEYS.some((key) => Object.prototype.hasOwnProperty.call(extras, key));
};

const normalizeHttpUrl = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }
  return parsed.toString();
};

/**
 * Build a reputation request that contains only the URL (+ provider label for UI).
 * Never attaches message/contact/key material.
 */
export const buildUrlReputationRequest = (
  input: UrlReputationBuilderInput,
): UrlReputationBuildResult => {
  if (hasForbiddenFields(input.extras)) {
    return { ok: false, reason: "forbidden_fields_present" };
  }
  const trimmed = input.url?.trim() ?? "";
  if (!trimmed) {
    return { ok: false, reason: "empty_url" };
  }
  const normalized = normalizeHttpUrl(trimmed);
  if (!normalized) {
    try {
      // Distinguish scheme vs parse failure for clearer L1 asserts.
      const attempt = new URL(trimmed);
      if (attempt.protocol !== "http:" && attempt.protocol !== "https:") {
        return { ok: false, reason: "non_http_scheme" };
      }
    } catch {
      return { ok: false, reason: "invalid_url" };
    }
    return { ok: false, reason: "invalid_url" };
  }
  return {
    ok: true,
    request: {
      url: normalized,
      providerLabel: (input.providerLabel ?? "URLHaus").trim() || "URLHaus",
    },
  };
};

/** Assert request JSON never smuggles forbidden keys (L1 invariant helper). */
export const reputationRequestPayloadKeys = (
  request: UrlReputationRequest,
): ReadonlyArray<string> => Object.keys(request).sort();
