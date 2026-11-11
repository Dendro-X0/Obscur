/**
 * Cut 1.4 — private_dc is the H-dc private-trust carrier.
 * Product send must use T3 envelopes; plaintext body is refused.
 */

export const PRIVATE_DC_T3_PLAINTEXT_REFUSED = "private_dc_t3_plaintext_refused";
export const PRIVATE_DC_T3_ENGINE_UNAVAILABLE = "private_dc_t3_engine_unavailable";

/**
 * True when private_dc wire must be T3 ciphertext (H-dc v0.1).
 * Escape hatch reserved for explicit lab override only — not product default.
 */
export const privateDcRequiresT3Wire = (): boolean => {
  if (
    typeof process !== "undefined"
    && process.env.NEXT_PUBLIC_OBSCUR_PRIVATE_DC_ALLOW_PLAINTEXT === "1"
  ) {
    return false;
  }
  return true;
};
