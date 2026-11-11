import { describe, expect, it } from "vitest";
import {
  PRIVATE_DC_SILENT_NOSTR_FALLBACK_REFUSED,
  guardPrivateTrustSendFace,
  isPrivateTrustComposeFace,
  privateTrustComposeTransportCopy,
  resolveActiveProtocolIdFromEvidence,
} from "./private-trust-compose-face";

describe("private-trust-compose-face", () => {
  it("prefers private_dc when no stored selection and H-dc evidence", () => {
    expect(resolveActiveProtocolIdFromEvidence({
      storedProtocolId: null,
      preferPrivateDcWhenNoStored: true,
    })).toBe("private_dc");
    expect(resolveActiveProtocolIdFromEvidence({
      storedProtocolId: "nostr",
      preferPrivateDcWhenNoStored: true,
    })).toBe("nostr");
  });

  it("exposes H-dc · T3 chrome for private-trust face", () => {
    expect(isPrivateTrustComposeFace("private_dc")).toBe(true);
    expect(privateTrustComposeTransportCopy().label).toBe("H-dc · T3");
  });

  it("refuses silent Nostr fallback on private_dc", () => {
    const refused = guardPrivateTrustSendFace({
      activeProtocolId: "private_dc",
      requestedCarrier: "nostr",
      body: "hello",
    });
    expect(refused?.ok).toBe(false);
    expect(refused?.reasonCode).toBe(PRIVATE_DC_SILENT_NOSTR_FALLBACK_REFUSED);
  });
});
