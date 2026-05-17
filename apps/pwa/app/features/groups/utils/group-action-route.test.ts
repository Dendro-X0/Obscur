import { describe, expect, it } from "vitest";
import {
  buildGroupActionSearchParams,
  buildGroupBlockHref,
  buildGroupLeaveHref,
  buildGroupPurgeHref,
  buildGroupViewHref,
} from "./group-action-route";

describe("group-action-route", () => {
  const base = {
    routeToken: "group-abc",
    relayUrl: "wss://nos.lol",
    displayName: "NewTest 1",
    communityId: "community-xyz",
  } as const;

  it("builds search params with all fields", () => {
    const search = buildGroupActionSearchParams(base);
    expect(search.get("id")).toBe("group-abc");
    expect(search.get("relay")).toBe("wss://nos.lol");
    expect(search.get("name")).toBe("NewTest 1");
    expect(search.get("communityId")).toBe("community-xyz");
  });

  it("builds dedicated confirmation page hrefs", () => {
    expect(buildGroupViewHref(base)).toBe(
      "/groups/view?id=group-abc&relay=wss%3A%2F%2Fnos.lol&name=NewTest+1&communityId=community-xyz",
    );
    expect(buildGroupLeaveHref(base)).toBe(
      "/groups/leave?id=group-abc&relay=wss%3A%2F%2Fnos.lol&name=NewTest+1&communityId=community-xyz",
    );
    expect(buildGroupBlockHref(base)).toBe(
      "/groups/block?id=group-abc&relay=wss%3A%2F%2Fnos.lol&name=NewTest+1&communityId=community-xyz",
    );
    expect(buildGroupPurgeHref(base)).toBe(
      "/groups/purge?id=group-abc&relay=wss%3A%2F%2Fnos.lol&name=NewTest+1&communityId=community-xyz",
    );
  });

  it("falls back to /network when route token is empty", () => {
    expect(buildGroupViewHref({ routeToken: "" })).toBe("/network");
  });
});
