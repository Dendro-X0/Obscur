import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveIdentityScopeProfileId: vi.fn(() => ""),
}));

vi.mock("@/app/features/profiles/services/read-active-desktop-profile-id", async () => {
  const actual = await vi.importActual<
    typeof import("@/app/features/profiles/services/read-active-desktop-profile-id")
  >("@/app/features/profiles/services/read-active-desktop-profile-id");
  return {
    ...actual,
    resolveIdentityScopeProfileId: () => mocks.resolveIdentityScopeProfileId(),
  };
});

import { resolveBoundAuthProfileId } from "./resolve-bound-auth-profile-id";

describe("resolveBoundAuthProfileId", () => {
  beforeEach(() => {
    mocks.resolveIdentityScopeProfileId.mockReset();
    mocks.resolveIdentityScopeProfileId.mockReturnValue("");
  });

  it("prefers identity scope over stale window-session default", () => {
    mocks.resolveIdentityScopeProfileId.mockReturnValue("pk-e07f67dcb8a58f53b13");
    expect(resolveBoundAuthProfileId("default")).toBe("pk-e07f67dcb8a58f53b13");
  });

  it("falls back to session profile id when identity scope is empty", () => {
    mocks.resolveIdentityScopeProfileId.mockReturnValue("   ");
    expect(resolveBoundAuthProfileId("default")).toBe("default");
  });
});
