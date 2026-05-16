import { buildAppClientGateway } from "@/app/features/runtime/services/client-gateway-adapter";
import type { AppClientGateway } from "@/app/features/runtime/types/app-client-gateway";
import { getResolvedStoragePorts } from "./default-storage-ports";
import { getProfileRuntimeScope, getResolvedProfileId } from "./profile-runtime-scope";

/**
 * Canonical accessor for client-side mutations (delete, local visibility, tombstones, R1 hydrate).
 * Prefer this over `getResolvedStoragePorts()` or direct domain owners in feature code.
 */
export function getResolvedClientGateway(): AppClientGateway {
  const scope = getProfileRuntimeScope();
  if (scope?.clientGateway) {
    return scope.clientGateway as AppClientGateway;
  }
  return buildAppClientGateway({
    profileId: getResolvedProfileId(),
    storagePorts: getResolvedStoragePorts(),
  });
}
