"use client";

export type GroupActionRouteParams = Readonly<{
  routeToken: string;
  relayUrl?: string;
  displayName?: string;
  communityId?: string;
}>;

export const buildGroupActionSearchParams = (params: GroupActionRouteParams): URLSearchParams => {
  const search = new URLSearchParams();
  const routeToken = params.routeToken.trim();
  if (routeToken) {
    search.set("id", routeToken);
  }
  const relayUrl = params.relayUrl?.trim() ?? "";
  if (relayUrl) {
    search.set("relay", relayUrl);
  }
  const displayName = params.displayName?.trim() ?? "";
  if (displayName) {
    search.set("name", displayName);
  }
  const communityId = params.communityId?.trim() ?? "";
  if (communityId) {
    search.set("communityId", communityId);
  }
  return search;
};

export const buildGroupViewHref = (params: GroupActionRouteParams): string => {
  const search = buildGroupActionSearchParams(params);
  return search.toString().length > 0 ? `/groups/view?${search.toString()}` : "/network";
};

export const buildGroupLeaveHref = (params: GroupActionRouteParams): string => (
  `/groups/leave?${buildGroupActionSearchParams(params).toString()}`
);

export const buildGroupBlockHref = (params: GroupActionRouteParams): string => (
  `/groups/block?${buildGroupActionSearchParams(params).toString()}`
);

export const buildGroupPurgeHref = (params: GroupActionRouteParams): string => (
  `/groups/purge?${buildGroupActionSearchParams(params).toString()}`
);
