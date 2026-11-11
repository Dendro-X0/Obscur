import type { DeliverHomeEnvelope } from "@obscur/private-trust-engine";

/**
 * Cut 4.3 — default H-dc envelope deliver until Vite wires a sessioned home client (4.4).
 * Keeps native send fail-closed without importing apps/pwa private-dc-client.
 */
export const createFailClosedHomeEnvelopeDeliver = (
  message = "Vite H-dc home envelope deliver not configured (Cut 4.3 fail-closed)",
): DeliverHomeEnvelope => async () => {
  throw new Error(message);
};
