import { describe, expect, it, vi } from "vitest";
import { DEFAULT_STORAGE_PORTS } from "./default-storage-ports";
import { getResolvedClientGateway } from "./resolve-client-gateway";
import { setProfileRuntimeScope } from "./profile-runtime-scope";
import { buildAppClientGateway } from "@/app/features/runtime/services/client-gateway-adapter";

vi.mock("@/app/features/dm-kernel/dm-kernel-policy", () => ({
  isDmKernelAuthority: () => true,
  isDmKernelRelaySyncSuppressed: () => true,
}));

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
    expect(getResolvedClientGateway().communityTransport.kind).toBe("nostr");
    expect(getResolvedClientGateway().communityMembership.ownerId).toBe("community-membership-port-owner");
    setProfileRuntimeScope(null);
  });
});
