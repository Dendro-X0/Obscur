import type { AppClientGateway } from "@/app/features/runtime/types/app-client-gateway";
import type { ProfileMessageBus } from "@dweb/core/profile-message-bus";
import type { StoragePorts } from "@/app/features/profiles/types/storage-ports";
import { getProfileScopeOverride, readRegistryBackedActiveProfileId } from "./profile-scope";

type ProfileRuntimeScope = Readonly<{
    profileId: string;
    bus: ProfileMessageBus;
    /** When set (by `ProfileRuntimeProvider`), matches context `storagePorts` for non-React services. */
    storagePorts?: StoragePorts;
    /** Unified client adapter — Web / desktop / mobile mutations route here. */
    clientGateway?: AppClientGateway;
}>;

let injected: ProfileRuntimeScope | null = null;

export function setProfileRuntimeScope(scope: ProfileRuntimeScope | null): void {
    injected = scope;
}

/** Active profile/message bus installed by ProfileRuntimeProvider (v1.5 Phase 1). */
export function getProfileRuntimeScope(): ProfileRuntimeScope | null {
    return injected;
}

/**
 * Canonical read for services that cannot yet receive explicit profileId injection.
 * Prefer passing profileId through constructors once call sites are migrated.
 */
export function getResolvedProfileId(): string {
    const scopeOverride = getProfileScopeOverride();
    if (scopeOverride) {
        return scopeOverride;
    }
    return injected?.profileId ?? readRegistryBackedActiveProfileId();
}
