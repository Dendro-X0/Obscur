import { describe, expect, it } from "vitest";
import {
  MATRIX_LAB_DISPLAY_NAME,
  OBSCUR_NOSTR_DISPLAY_NAME,
  OBSCUR_NOSTR_PACKAGE_NAME,
  OBSCUR_PLATFORM_DISPLAY_NAME,
  PRIVATE_DC_DISPLAY_NAME,
  protocolDisplayName,
} from "./module-display-names";

describe("module-display-names (P5)", () => {
  it("keeps platform vs module names distinct", () => {
    expect(OBSCUR_PLATFORM_DISPLAY_NAME).toBe("Obscur");
    expect(OBSCUR_NOSTR_DISPLAY_NAME).toBe("Obscur-Nostr");
    expect(OBSCUR_NOSTR_PACKAGE_NAME).toBe("@obscur/protocol-nostr");
  });

  it("maps wire ids to glossary labels", () => {
    expect(protocolDisplayName("nostr")).toBe(OBSCUR_NOSTR_DISPLAY_NAME);
    expect(protocolDisplayName("matrix")).toBe(MATRIX_LAB_DISPLAY_NAME);
    expect(protocolDisplayName("private_dc")).toBe(PRIVATE_DC_DISPLAY_NAME);
  });
});
