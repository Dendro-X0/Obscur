export const decodeRouteToken = (value: string | null | undefined): string => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return "";
  }
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
};

export const resolveGroupRouteToken = (params: Readonly<{
  routeParam: string | ReadonlyArray<string> | undefined;
  queryId: string | null | undefined;
}>): string => {
  const routeIdRaw = typeof params.routeParam === "string"
    ? params.routeParam
    : Array.isArray(params.routeParam)
      ? params.routeParam.join("/")
      : undefined;
  const routeId = decodeRouteToken(routeIdRaw);
  const queryId = decodeRouteToken(params.queryId);
  if (queryId) {
    return queryId;
  }
  if (routeId === "view") {
    return "";
  }
  return routeId;
};
