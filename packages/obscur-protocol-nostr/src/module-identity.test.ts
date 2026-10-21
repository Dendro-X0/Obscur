import { describe, expect, it } from "vitest";
import {
  OBSCUR_NOSTR_IMPLEMENTATION_HOME,
  OBSCUR_NOSTR_PACKAGE_NAME,
  OBSCUR_NOSTR_PROTOCOL_ID,
} from "./module-identity";
import {
  OBSCUR_NOSTR_PRIVATE_SEND,
  OBSCUR_NOSTR_RICH_PORTS,
  PLATFORM_CANONICAL_PORTS,
} from "./port-surfaces";

describe("@obscur/protocol-nostr identity", () => {
  it("names the Obscur-Nostr package and protocol id", () => {
    expect(OBSCUR_NOSTR_PACKAGE_NAME).toBe("@obscur/protocol-nostr");
    expect(OBSCUR_NOSTR_PROTOCOL_ID).toBe("nostr");
    expect(OBSCUR_NOSTR_IMPLEMENTATION_HOME).toContain("protocol-adaptation/nostr");
  });

  it("exports port surface constants", () => {
    expect(PLATFORM_CANONICAL_PORTS).toContain("sendMessage");
    expect(OBSCUR_NOSTR_RICH_PORTS).toContain("sendDm");
    expect(OBSCUR_NOSTR_PRIVATE_SEND).toBe("nostrAdapter.sendDm");
  });
});
