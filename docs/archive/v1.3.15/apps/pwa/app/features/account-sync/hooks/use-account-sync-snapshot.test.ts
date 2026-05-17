import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { useAccountSyncSnapshot } from "./use-account-sync-snapshot";
import { accountSyncStatusStore } from "../services/account-sync-status-store";
import { queryKeyFactory } from "@/app/features/query/services/query-key-factory";
import { createQueryScope } from "@/app/features/query/services/query-scope";

const tanstackRuntimeMock = vi.fn(() => null as any);

vi.mock("@/app/features/query/providers/tanstack-query-runtime-provider", () => ({
  useTanstackQueryRuntime: () => tanstackRuntimeMock(),
}));

describe("use-account-sync-snapshot", () => {
  beforeEach(() => {
    localStorage.clear();
    accountSyncStatusStore.resetSnapshot(null);
    tanstackRuntimeMock.mockReset();
    tanstackRuntimeMock.mockReturnValue(null);
  });

  it("returns the legacy store snapshot when TanStack rollout is disabled", () => {
    accountSyncStatusStore.setSnapshot({
      publicKeyHex: "a".repeat(64) as any,
      status: "private_restored",
      portabilityStatus: "portable",
      phase: "ready",
      message: "ready",
    });

    const { result } = renderHook(() => useAccountSyncSnapshot());

    expect(result.current.status).toBe("private_restored");
    expect(result.current.portabilityStatus).toBe("portable");
  });

  it("bridges store updates into query cache when TanStack rollout is enabled", async () => {
    const queryClient = new QueryClient();
    const scope = createQueryScope({
      profileId: "alice",
      publicKeyHex: "b".repeat(64) as any,
    });
    const queryKey = queryKeyFactory.accountSyncSnapshot({ scope });
    tanstackRuntimeMock.mockReturnValue({
      enabled: true,
      scope,
      queryClient,
    });

    const { result } = renderHook(() => useAccountSyncSnapshot());

    act(() => {
      accountSyncStatusStore.setSnapshot({
        publicKeyHex: "b".repeat(64) as any,
        status: "public_restored",
        portabilityStatus: "profile_only",
        phase: "restoring_account_data",
        message: "restoring",
      });
    });

    await waitFor(() => {
      expect(result.current.status).toBe("public_restored");
    });

    const cached = queryClient.getQueryData(queryKey) as { status?: string } | undefined;
    expect(cached?.status).toBe("public_restored");
  });
});
