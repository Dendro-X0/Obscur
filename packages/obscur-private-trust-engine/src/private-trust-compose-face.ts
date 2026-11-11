/**
 * Cut 2 / Cut 3.3 — shared private-trust product-face policy (chrome + resolve).
 * UI shells (Next + Vite) consume this; do not re-own in MessagingProvider.
 */

export type PrivateTrustProtocolId = "nostr" | "matrix" | "private_dc";

/** Cut 2.2 — product send must not silently drop to Nostr when private_dc is active. */
export const PRIVATE_DC_SILENT_NOSTR_FALLBACK_REFUSED = "private_dc_silent_nostr_fallback_refused";

export const isPrivateTrustComposeFace = (protocolId: PrivateTrustProtocolId): boolean => (
  protocolId === "private_dc"
);

/** Primary composer transport chrome when private-trust face is active. */
export const privateTrustComposeTransportCopy = (): Readonly<{
  label: string;
  detail: string;
}> => ({
  label: "H-dc · T3",
  detail: "Private-trust home · sealed envelope (accepted ≠ delivered)",
});

/**
 * Cut 2.1 — pure resolve (explicit selection wins; else prefer private_dc when H-dc native).
 * Does not write storage.
 */
export const resolveActiveProtocolIdFromEvidence = (params: Readonly<{
  storedProtocolId: PrivateTrustProtocolId | null;
  preferPrivateDcWhenNoStored: boolean;
}>): PrivateTrustProtocolId => {
  if (params.storedProtocolId) {
    return params.storedProtocolId;
  }
  if (params.preferPrivateDcWhenNoStored) {
    return "private_dc";
  }
  return "nostr";
};

export type PrivateTrustSendFaceResult = Readonly<{
  ok: boolean;
  reasonCode?: typeof PRIVATE_DC_SILENT_NOSTR_FALLBACK_REFUSED | "empty_body" | "send_failed";
  messageId?: string;
  deliveryStatus?: "accepted" | "failed";
  error?: string;
}>;

/**
 * Cut 2.2 / 3.3 — refuse silent Nostr fallback when private_dc is the active face.
 * Actual T3 wire stays on injected PAL/kernel send port.
 */
export const guardPrivateTrustSendFace = (params: Readonly<{
  activeProtocolId: PrivateTrustProtocolId;
  requestedCarrier: PrivateTrustProtocolId;
  body: string;
}>): PrivateTrustSendFaceResult | null => {
  const body = params.body.trim();
  if (!body) {
    return { ok: false, reasonCode: "empty_body", error: "Message is empty" };
  }
  if (
    isPrivateTrustComposeFace(params.activeProtocolId)
    && params.requestedCarrier === "nostr"
  ) {
    return {
      ok: false,
      reasonCode: PRIVATE_DC_SILENT_NOSTR_FALLBACK_REFUSED,
      error: "Silent Nostr fallback refused while Private DC is active",
    };
  }
  return null;
};
