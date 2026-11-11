import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const read = (relativePath: string): string => (
  readFileSync(resolve(process.cwd(), relativePath), "utf8")
);

const { persistStickyTrustToKernel } = vi.hoisted(() => ({
  persistStickyTrustToKernel: vi.fn(async () => undefined),
}));

vi.mock("@/app/features/network/services/relationship-edge-authority", async () => {
  const actual = await vi.importActual<typeof import("./relationship-edge-authority")>(
    "./relationship-edge-authority",
  );
  return {
    ...actual,
    usesKernelRelationshipAuthority: () => true,
    persistStickyTrustToKernel,
    loadStickyTrustFromKernel: vi.fn(async () => ({
      acceptedPeers: [],
      mutedPeers: [],
      removedPeers: [],
    })),
  };
});

describe("Cut 1.1 CRM owner-uniqueness (K-CRM)", () => {
  it("use-peer-trust routes sticky writes through relationship_edge authority on native", () => {
    const source = read("app/features/network/hooks/use-peer-trust.ts");
    expect(source).toContain('from "@/app/features/network/services/relationship-edge-authority"');
    expect(source).toContain("usesKernelRelationshipAuthority()");
    expect(source).toContain("persistStickyTrustToKernel");
    expect(source).toContain("loadStickyTrustFromKernel");
    expect(source).toMatch(
      /if \(usesKernelRelationshipAuthority\(\)\) \{[\s\S]*?persistStickyTrustToKernel[\s\S]*?return;[\s\S]*?\}[\s\S]*?writePeerTrustLocalCache/,
    );
  });

  it("chat-state hydrate cannot mint TRUSTED under kernel CRM authority", () => {
    const source = read("app/features/network/hooks/use-peer-trust.ts");
    expect(source).toMatch(
      /hydrateAcceptedPeersFromChatState[\s\S]*?usesKernelRelationshipAuthority\(\)[\s\S]*?return;/,
    );
  });
});

describe("Cut 1.1 saveToStorage demotes peer-trust LS when kernel authority is on", () => {
  beforeEach(() => {
    persistStickyTrustToKernel.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not write obscur.peer_trust.v1 when kernel authority is active", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const { peerTrustInternals } = await import("../hooks/use-peer-trust");

    peerTrustInternals.saveToStorage(
      "aa".repeat(32) as never,
      { acceptedPeers: ["bb".repeat(32) as never], mutedPeers: [], removedPeers: [] },
      "profile-a",
    );

    expect(persistStickyTrustToKernel).toHaveBeenCalled();
    const peerTrustWrites = setItem.mock.calls.filter(([key]) =>
      String(key).includes("obscur.peer_trust.v1"),
    );
    expect(peerTrustWrites).toEqual([]);
    setItem.mockRestore();
  });
});
