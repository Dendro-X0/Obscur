import { describe, expect, it, vi } from "vitest";
import { runWithNavigationChunkLoadAuthority } from "./navigation-chunk-load-authority";
import { loadClientChunkSafely, prefetchRouteShell, warmRouteNavigationTargets } from "./route-navigation-warmup";

vi.mock("@/app/groups/[...id]/group-home-page-client", () => ({
  default: function MockGroupHomePageClient() {
    return null;
  },
}));

describe("warmRouteNavigationTargets", () => {
  it("prefetches the route and loads the client chunk for known hrefs", async () => {
    const prefetch = vi.fn();
    const results = await runWithNavigationChunkLoadAuthority(() =>
      warmRouteNavigationTargets({ prefetch }, ["/network"]),
    );

    expect(prefetch).toHaveBeenCalledWith("/network");
    expect(results).toEqual([{ href: "/network", status: "fulfilled" }]);
  });

  it("does not reject warm-up when a client chunk fails to load", async () => {
    const prefetch = vi.fn();
    const results = await runWithNavigationChunkLoadAuthority(() =>
      warmRouteNavigationTargets({ prefetch }, ["/vault"]),
    );

    expect(results).toEqual([{ href: "/vault", status: "fulfilled" }]);
  });

  it("shell-only mode prefetches without loading client chunks", async () => {
    const prefetch = vi.fn();
    const results = await warmRouteNavigationTargets({ prefetch }, ["/network"], "shell-only");

    expect(prefetch).toHaveBeenCalledWith("/network");
    expect(results).toEqual([{ href: "/network", status: "fulfilled" }]);
  });

  it("prefetchRouteShell only prefetches the route shell", () => {
    const prefetch = vi.fn();
    prefetchRouteShell({ prefetch }, "/vault");
    expect(prefetch).toHaveBeenCalledWith("/vault");
  });

});

describe("loadClientChunkSafely", () => {
  it("returns rejected without throwing when the loader fails", async () => {
    await expect(loadClientChunkSafely(async () => {
      throw new Error("ChunkLoadError");
    })).resolves.toBe("rejected");
  });
});
