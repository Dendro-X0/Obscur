import type { MeshEnvelope } from "./envelope";

/**
 * NIP-01 wire adapter for Obscur mesh envelopes.
 * Optional dialect — users may run mesh with zero `nostr_ws` conduits.
 */
export const NOSTR_WS_CONDUIT_WIRE_V1 = "nostr_ws_conduit_wire_v1" as const;

/** Replaceable-style kind for opaque mesh ciphertext on Nostr relays. */
export const OBSCUR_MESH_NOSTR_EVENT_KIND = 31990 as const;

export type NostrWsWireEvent = Readonly<{
  id: string;
  pubkey: string;
  created_at: number;
  kind: typeof OBSCUR_MESH_NOSTR_EVENT_KIND;
  tags: ReadonlyArray<readonly [string, ...string[]]>;
  content: string;
  sig: string;
}>;

export type NostrWsOkParseResult = Readonly<{
  ok: boolean;
  eventId?: string;
  errorMessage?: string;
}>;

const encodeCiphertextBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
};

/** Deterministic 64-hex id for headless stub events (not a production signature). */
export const deriveHeadlessNostrEventId = (envelopeId: string): string => {
  const seed = envelopeId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const padded = (seed + "0".repeat(64)).slice(0, 64);
  return padded;
};

/** Synthetic pubkey when caller does not supply a real signer (headless tests only). */
export const deriveHeadlessNostrPubkey = (profileId: string): string => {
  const seed = profileId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return (seed + "b".repeat(64)).slice(0, 64);
};

export const buildNostrWsEventFromMeshEnvelope = (
  envelope: MeshEnvelope,
  params: Readonly<{
    signerPublicKeyHex?: string;
    eventId?: string;
    createdAtUnixSeconds?: number;
  }> = {},
): NostrWsWireEvent => {
  const pubkey = params.signerPublicKeyHex ?? deriveHeadlessNostrPubkey(envelope.scope.profileId);
  const eventId = params.eventId ?? deriveHeadlessNostrEventId(envelope.envelopeId);
  const created_at = params.createdAtUnixSeconds ?? Math.floor(envelope.createdAtUnixMs / 1000);

  const tags: Array<readonly [string, ...string[]]> = [
    ["d", envelope.envelopeId],
    ["mesh", NOSTR_WS_CONDUIT_WIRE_V1],
    ["scope", envelope.scope.profileId],
    ["message_scope", envelope.messageScope],
  ];

  if (envelope.correlationId) {
    tags.push(["correlation", envelope.correlationId]);
  }

  return {
    id: eventId,
    pubkey,
    created_at,
    kind: OBSCUR_MESH_NOSTR_EVENT_KIND,
    tags,
    content: encodeCiphertextBase64(envelope.ciphertext),
    sig: "headless-unsigned-stub",
  };
};

export const buildNostrWsWirePayload = (
  envelope: MeshEnvelope,
  params?: Readonly<{
    signerPublicKeyHex?: string;
    eventId?: string;
    createdAtUnixSeconds?: number;
  }>,
): string => JSON.stringify(["EVENT", buildNostrWsEventFromMeshEnvelope(envelope, params)]);

export const parseNostrWsOkMessage = (message: string): NostrWsOkParseResult => {
  try {
    const parsed = JSON.parse(message) as unknown;
    if (!Array.isArray(parsed) || parsed[0] !== "OK") {
      return { ok: false, errorMessage: "not_ok_message" };
    }
    const eventId = typeof parsed[1] === "string" ? parsed[1] : undefined;
    const accepted = parsed[2] === true;
    const errorMessage = typeof parsed[3] === "string" && parsed[3].length > 0
      ? parsed[3]
      : accepted
        ? undefined
        : "relay_rejected";
    return { ok: accepted, eventId, errorMessage };
  } catch {
    return { ok: false, errorMessage: "invalid_ok_json" };
  }
};

export const extractEventIdFromNostrWirePayload = (wirePayload: string): string | undefined => {
  try {
    const parsed = JSON.parse(wirePayload) as unknown;
    if (Array.isArray(parsed) && parsed[0] === "EVENT") {
      const event = parsed[1] as { id?: string } | undefined;
      return typeof event?.id === "string" ? event.id : undefined;
    }
  } catch {
    // ignore
  }
  return undefined;
};
