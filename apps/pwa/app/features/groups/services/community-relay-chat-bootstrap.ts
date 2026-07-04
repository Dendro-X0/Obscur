import { isLocalWorkspaceRelayHost, normalizeWorkspaceRelayUrl } from "./workspace-relay-url";
import { runRelayNipProbe } from "@/app/features/relays/lib/relay-nip-probe.mjs";
import { hasWritableCommunityRelayTransport } from "./community-relay-transport";
import {
  prepareWorkspaceRelayForJoin,
  type WorkspaceRelayPoolTransport,
} from "./workspace-relay-calibrator";

/** Fail fast (~1.5s) when the local Docker relay is not listening. */
const probeLocalWorkspaceRelaySocket = async (relayUrl: string): Promise<boolean> => {
  const canonical = normalizeWorkspaceRelayUrl(relayUrl);
  if (!isLocalWorkspaceRelayHost(canonical)) {
    return true;
  }
  try {
    const results = await runRelayNipProbe({
      relayUrls: [canonical],
      timeoutMs: 1500,
    });
    const socketResult = results.find((result) => result.check === "relay_socket");
    return socketResult?.status === "ok" || socketResult?.status === "degraded";
  } catch {
    return false;
  }
};

/** Enable + connect the community relay before chat publish (mirrors create/join path). */
export const bootstrapCommunityRelayForChat = async (params: Readonly<{
  rawRelayUrl: string;
  pool: WorkspaceRelayPoolTransport;
  addRelay: (relayParams: Readonly<{ url: string }>) => void;
  timeoutMs?: number;
}>): Promise<string | null> => {
  const trimmed = params.rawRelayUrl.trim();
  if (!hasWritableCommunityRelayTransport(trimmed)) {
    return null;
  }
  const socketReachable = await probeLocalWorkspaceRelaySocket(trimmed);
  if (!socketReachable) {
    return null;
  }
  params.addRelay({ url: trimmed });
  return prepareWorkspaceRelayForJoin({
    rawUrl: trimmed,
    pool: params.pool,
    addRelay: params.addRelay,
    timeoutMs: params.timeoutMs ?? 6000,
  });
};
