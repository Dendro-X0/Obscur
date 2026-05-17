import { describe, expect, it, vi } from "vitest";
import { warmRouteNavigationTargets } from "./route-navigation-warmup";

vi.mock("@/app/groups/[...id]/group-home-page-client", () => ({
  default: function MockGroupHomePageClient() {
    return null;
  },
}));

describe("warmRouteNavigationTargets", () => {
  it("prefetches the route and loads the client chunk for known hrefs", async () => {
    const prefetch = vi.fn();
    const results = await warmRouteNavigationTargets({ prefetch }, ["/network"]);

    expect(prefetch).toHaveBeenCalledWith("/network");
    expect(results).toEqual([{ href: "/network", status: "fulfilled" }]);
  });

});
