import { describe, expect, it, vi } from "vitest";
import { DEFAULT_STORAGE_PORTS } from "./default-storage-ports";
import { getResolvedClientGateway } from "./resolve-client-gateway";
import { setProfileRuntimeScope } from "./profile-runtime-scope";
import { buildAppClientGateway } from "@/app/features/runtime/services/client-gateway-adapter";

describe("resolve-client-gateway", () => {
  it("returns scope clientGateway when profile runtime is installed", () => {
    const gateway = buildAppClientGateway({
      profileId: "p-test",
      storagePorts: DEFAULT_STORAGE_PORTS,
    });
    setProfileRuntimeScope({
      profileId: "p-test",
      bus: { publish: vi.fn(), subscribe: vi.fn(() => () => {}), profileId: "p-test" } as never,
      storagePorts: DEFAULT_STORAGE_PORTS,
      clientGateway: gateway,
    });
    expect(getResolvedClientGateway()).toBe(gateway);
    expect(getResolvedClientGateway().dmConversationMaterialization).toBeDefined();
    expect(getResolvedClientGateway().communityRoster).toBeDefined();
    setProfileRuntimeScope(null);
  });
});
