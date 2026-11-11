import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => false),
}));

import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import {
  clearPrivateDcSession,
  writePrivateDcSession,
} from "./private-dc-session";
import {
  getActiveProtocolStorageKey,
  readActiveProtocolId,
  readStoredActiveProtocolId,
  resolveActiveProtocolId,
  writeActiveProtocolId,
} from "./preferences";

const PROFILE = "cut2-default-profile";

describe("Cut 2.1 K-DEFAULT-NOSTR preference resolve", () => {
  beforeEach(() => {
    vi.mocked(requiresSqlitePersistence).mockReturnValue(false);
    clearPrivateDcSession(PROFILE);
    window.localStorage.removeItem(getActiveProtocolStorageKey(PROFILE));
  });

  afterEach(() => {
    clearPrivateDcSession(PROFILE);
    window.localStorage.removeItem(getActiveProtocolStorageKey(PROFILE));
  });

  it("keeps explicit Nostr / Matrix / private_dc selection", () => {
    writeActiveProtocolId("nostr", PROFILE);
    expect(resolveActiveProtocolId(PROFILE)).toBe("nostr");
    writeActiveProtocolId("matrix", PROFILE);
    expect(resolveActiveProtocolId(PROFILE)).toBe("matrix");
    writeActiveProtocolId("private_dc", PROFILE);
    expect(resolveActiveProtocolId(PROFILE)).toBe("private_dc");
  });

  it("defaults to nostr when no session and no stored preference", () => {
    expect(readStoredActiveProtocolId(PROFILE)).toBeNull();
    expect(resolveActiveProtocolId(PROFILE)).toBe("nostr");
    expect(readActiveProtocolId(PROFILE)).toBe("nostr");
  });

  it("prefers private_dc on native when H-dc session exists and no explicit preference", () => {
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    writePrivateDcSession({ baseUrl: "https://home.example.com" }, PROFILE);
    expect(readStoredActiveProtocolId(PROFILE)).toBeNull();
    expect(resolveActiveProtocolId(PROFILE)).toBe("private_dc");
    expect(readActiveProtocolId(PROFILE)).toBe("private_dc");
    // Must not write a Nostr default as side effect of resolve.
    expect(readStoredActiveProtocolId(PROFILE)).toBeNull();
  });

  it("does not prefer private_dc on browser (degraded) even with session", () => {
    vi.mocked(requiresSqlitePersistence).mockReturnValue(false);
    writePrivateDcSession({ baseUrl: "https://home.example.com" }, PROFILE);
    expect(resolveActiveProtocolId(PROFILE)).toBe("nostr");
  });

  it("explicit nostr still wins over H-dc session on native", () => {
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    writePrivateDcSession({ baseUrl: "https://home.example.com" }, PROFILE);
    writeActiveProtocolId("nostr", PROFILE);
    expect(resolveActiveProtocolId(PROFILE)).toBe("nostr");
  });
});
