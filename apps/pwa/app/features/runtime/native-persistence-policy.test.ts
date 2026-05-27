import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./runtime-capabilities", () => ({
  hasNativeRuntime: vi.fn(() => false),
}));

import { hasNativeRuntime } from "./runtime-capabilities";
import {
  getNativeDmHydrateRecoveryFlags,
  requiresSqlitePersistence,
} from "./native-persistence-policy";

describe("native-persistence-policy", () => {
  afterEach(() => {
    vi.mocked(hasNativeRuntime).mockReturnValue(false);
  });

  it("requiresSqlitePersistence tracks hasNativeRuntime", () => {
    vi.mocked(hasNativeRuntime).mockReturnValue(false);
    expect(requiresSqlitePersistence()).toBe(false);
    vi.mocked(hasNativeRuntime).mockReturnValue(true);
    expect(requiresSqlitePersistence()).toBe(true);
  });

  it("disables DM hydrate IDB/chat-state recovery on native", () => {
    vi.mocked(hasNativeRuntime).mockReturnValue(true);
    expect(getNativeDmHydrateRecoveryFlags()).toEqual({
      allowLegacyPersistedAuthority: false,
      allowIndexedDbMessageWindowFallback: false,
    });
  });

  it("allows persisted chat-state authority on web but never IndexedDB window fallback", () => {
    vi.mocked(hasNativeRuntime).mockReturnValue(false);
    expect(getNativeDmHydrateRecoveryFlags()).toEqual({
      allowLegacyPersistedAuthority: true,
      allowIndexedDbMessageWindowFallback: false,
    });
  });
});
