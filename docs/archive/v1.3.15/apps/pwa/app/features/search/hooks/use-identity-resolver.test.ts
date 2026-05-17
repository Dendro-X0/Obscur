import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { useIdentityResolver } from "./use-identity-resolver";
import { queryKeyFactory } from "@/app/features/query/services/query-key-factory";
import { createQueryScope } from "@/app/features/query/services/query-scope";

const relayPoolMock = {
  connections: [],
};

const tanstackRuntimeMock = vi.fn(() => null as any);
const resolveIdentityMock = vi.fn();

vi.mock("@/app/features/relays/providers/relay-provider", () => ({
  useRelay: () => ({ relayPool: relayPoolMock }),
}));

vi.mock("@/app/features/search/services/identity-resolver", () => ({
  resolveIdentity: (params: unknown) => resolveIdentityMock(params),
}));

vi.mock("@/app/features/query/providers/tanstack-query-runtime-provider", () => ({
  useTanstackQueryRuntime: () => tanstackRuntimeMock(),
}));

describe("use-identity-resolver", () => {
  beforeEach(() => {
    tanstackRuntimeMock.mockReset();
    tanstackRuntimeMock.mockReturnValue(null);
    resolveIdentityMock.mockReset();
  });

  it("resolves through the legacy path when TanStack rollout is off", async () => {
    resolveIdentityMock.mockResolvedValue({
      ok: true,
      identity: {
        pubkey: "a".repeat(64),
        source: "hex",
        confidence: "direct",
      },
    });
    const { result } = renderHook(() => useIdentityResolver());

    let resolveResult: unknown;
    await act(async () => {
      resolveResult = await result.current.resolve("a".repeat(64));
    });

    expect((resolveResult as { ok: boolean }).ok).toBe(true);
    expect(resolveIdentityMock).toHaveBeenCalledTimes(1);
  });

  it("uses TanStack query adapter and cache key scope when rollout is on", async () => {
    const queryClient = new QueryClient();
    const scope = createQueryScope({
      profileId: "alice",
      publicKeyHex: "b".repeat(64) as any,
    });
    tanstackRuntimeMock.mockReturnValue({
      enabled: true,
      scope,
      queryClient,
    });
    resolveIdentityMock.mockResolvedValue({
      ok: true,
      identity: {
        pubkey: "b".repeat(64),
        source: "hex",
        confidence: "direct",
      },
    });

    const { result } = renderHook(() => useIdentityResolver());

    await act(async () => {
      await result.current.resolve("b".repeat(64), { allowLegacyInviteCode: false });
    });

    const key = queryKeyFactory.identityResolution({
      scope,
      query: "b".repeat(64),
      allowLegacyInviteCode: false,
    });
    const cached = queryClient.getQueryData(key) as { ok?: boolean } | undefined;
    expect(cached?.ok).toBe(true);
    expect(resolveIdentityMock).toHaveBeenCalledTimes(1);
  });
});

