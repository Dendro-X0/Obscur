import {
  CUSTOM_CONDUIT_HTTP_PATHS,
  CUSTOM_CONDUIT_HTTP_V1,
} from "@obscur/conduit-mesh-contracts";

import type { ConduitMeshFetch } from "./conduit-http-utils";

export type InMemoryConduitFetchRouterOptions = Readonly<{
  coordinationBaseUrl: string;
  teamRelayBaseUrl: string;
  membershipHeadSeq?: number;
  teamPublishFails?: boolean;
}>;

const handleMeshGateway = (
  path: string,
  method: string,
  init: RequestInit | undefined,
  options: InMemoryConduitFetchRouterOptions,
): Response | null => {
  if (method === "GET" && path === CUSTOM_CONDUIT_HTTP_PATHS.health) {
    return Response.json({
      ok: true,
      contractVersion: CUSTOM_CONDUIT_HTTP_V1,
      operatorLabel: "test-team-gateway",
    });
  }

  if (method === "POST" && path === CUSTOM_CONDUIT_HTTP_PATHS.publish) {
    if (options.teamPublishFails) {
      return Response.json(
        { accepted: false, errorMessage: "team_gateway_down" },
        { status: 503 },
      );
    }
    let envelopeId = "unknown";
    try {
      const body = JSON.parse(String(init?.body ?? "{}")) as { envelopeId?: string };
      envelopeId = body.envelopeId ?? envelopeId;
    } catch {
      // keep default
    }
    return Response.json({
      accepted: true,
      storedRef: `team-stored-${envelopeId}`,
    });
  }

  return null;
};

/**
 * Headless fetch router simulating coordination worker + team mesh HTTP v1 gateway.
 * Used by C4 integration tests — not a production server.
 */
export const createInMemoryConduitFetchRouter = (
  options: InMemoryConduitFetchRouterOptions,
): ConduitMeshFetch => {
  const coordinationBase = options.coordinationBaseUrl.replace(/\/$/, "");
  const teamBase = options.teamRelayBaseUrl.replace(/\/$/, "");
  const headSeq = options.membershipHeadSeq ?? 3;

  return async (input: string, init?: RequestInit): Promise<Response> => {
    const url = new URL(input, coordinationBase);
    const path = url.pathname;
    const method = (init?.method ?? "GET").toUpperCase();

    if (url.origin === new URL(coordinationBase).origin) {
      if (method === "GET" && path === "/health") {
        return Response.json({ ok: true, environment: "test" });
      }

      const headMatch = /^\/communities\/([^/]+)\/membership\/head$/.exec(path);
      if (method === "GET" && headMatch) {
        const communityId = decodeURIComponent(headMatch[1] ?? "");
        return Response.json({
          ok: true,
          data: {
            communityId,
            seq: headSeq,
            headHash: `head-${communityId}-${headSeq}`,
            updatedAtUnixMs: Date.now(),
          },
        });
      }
    }

    if (url.origin === new URL(teamBase).origin) {
      const meshResponse = handleMeshGateway(path, method, init, options);
      if (meshResponse) {
        return meshResponse;
      }
    }

    return Response.json({ ok: false, error: "not_found" }, { status: 404 });
  };
};
