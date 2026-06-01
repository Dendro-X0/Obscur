"use client";

import { createProfileMessageBus, type ProfileMessageBus } from "@dweb/core/profile-message-bus";
import React, { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import type { AppClientGateway } from "@/app/features/runtime/types/app-client-gateway";
import { getResolvedStoragePorts, mergeStoragePorts } from "@/app/features/profiles/services/default-storage-ports";
import { PROFILE_CHANGED_EVENT, ProfileRegistryService } from "@/app/features/profiles/services/profile-registry-service";
import { useDesktopProfileIsolationSnapshot } from "@/app/features/profiles/services/desktop-profile-runtime";
import { getProfileScopeOverride } from "@/app/features/profiles/services/profile-scope";
import { setProfileRuntimeScope } from "@/app/features/profiles/services/profile-runtime-scope";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import type { StoragePorts } from "@/app/features/profiles/types/storage-ports";
import { buildAppClientGateway } from "@/app/features/runtime/services/client-gateway-adapter";
import { getResolvedClientGateway } from "@/app/features/profiles/services/resolve-client-gateway";
import {
  scheduleExperimentIdleWork,
  shouldDeferExperimentHeavyWork,
} from "@/app/features/runtime/experiment-shell-policy";
import { messagePersistenceService } from "@/app/features/messaging/services/message-persistence-service";

type ProfileRuntimeValue = Readonly<{
    profileId: string;
    bus: ProfileMessageBus;
    /** Phase 2: injectable persistence adapters (defaults: module-backed). */
    storagePorts: StoragePorts;
    /** Unified client surface — prefer `getResolvedClientGateway()` in services. */
    clientGateway: AppClientGateway;
}>;

const ProfileRuntimeContext = createContext<ProfileRuntimeValue | null>(null);

function subscribeProfileRegistry(onStoreChange: () => void): () => void {
    if (typeof window === "undefined") {
        return (): void => {};
    }
    const handler = (): void => onStoreChange();
    window.addEventListener(PROFILE_CHANGED_EVENT, handler);
    return (): void => window.removeEventListener(PROFILE_CHANGED_EVENT, handler);
}

function getProfileRegistrySnapshot(): string {
    return ProfileRegistryService.getActiveProfileId();
}

export function ProfileRuntimeProvider(props: Readonly<{
    children: React.ReactNode;
    /** Merged over default storage ports; use for tests or alternate adapters. */
    storagePorts?: Partial<StoragePorts>;
}>): React.JSX.Element {
    const { children, storagePorts: storagePortsPartial } = props;
    const registryProfileId = useSyncExternalStore(subscribeProfileRegistry, getProfileRegistrySnapshot, getProfileRegistrySnapshot);
    const desktopSnapshot = useDesktopProfileIsolationSnapshot();
    const profileId = useMemo((): string => {
        const scopeOverride = getProfileScopeOverride();
        if (scopeOverride) {
            return scopeOverride;
        }
        if (hasNativeRuntime()) {
            const windowProfileId = desktopSnapshot.currentWindow.profileId?.trim();
            if (windowProfileId) {
                return windowProfileId;
            }
        }
        return registryProfileId;
    }, [desktopSnapshot.currentWindow.profileId, registryProfileId]);
    const bus = useMemo(() => createProfileMessageBus({ profileId }), [profileId]);
    const storagePorts = useMemo(
        (): StoragePorts => mergeStoragePorts(storagePortsPartial),
        [storagePortsPartial],
    );
    const clientGateway = useMemo(
        (): AppClientGateway => buildAppClientGateway({ profileId, storagePorts }),
        [profileId, storagePorts],
    );
    const value = useMemo((): ProfileRuntimeValue => ({
        profileId,
        bus,
        storagePorts,
        clientGateway,
    }), [profileId, bus, storagePorts, clientGateway]);

    useEffect(() => {
        setProfileRuntimeScope({ profileId, bus, storagePorts, clientGateway });
        return (): void => {
            setProfileRuntimeScope(null);
        };
    }, [profileId, bus, storagePorts, clientGateway]);

    useEffect(() => {
        if (!profileId.trim()) {
            return;
        }
        messagePersistenceService.bindProfileScope(profileId);
    }, [profileId]);

    useEffect(() => {
        if (!profileId) {
            return;
        }
        const hydrateTombstones = (): void => {
            void storagePorts.messageDeleteTombstones.hydrateMessageDeleteTombstonesFromSqlite(profileId).catch(() => {});
        };
        if (shouldDeferExperimentHeavyWork()) {
            return scheduleExperimentIdleWork(hydrateTombstones);
        }
        hydrateTombstones();
    }, [profileId, storagePorts]);

    return <ProfileRuntimeContext.Provider value={value}>{children}</ProfileRuntimeContext.Provider>;
}

export function useProfileRuntime(): ProfileRuntimeValue {
    const ctx = useContext(ProfileRuntimeContext);
    if (!ctx) {
        throw new Error("useProfileRuntime must be used within ProfileRuntimeProvider");
    }
    return ctx;
}

export function useProfileMessageBus(): ProfileMessageBus {
    return useProfileRuntime().bus;
}

/** For providers used in isolation tests without ProfileRuntimeProvider. */
export function useOptionalProfileRuntime(): ProfileRuntimeValue | null {
    return useContext(ProfileRuntimeContext);
}

export function useOptionalProfileMessageBus(): ProfileMessageBus | null {
    return useOptionalProfileRuntime()?.bus ?? null;
}

/** Storage ports when `ProfileRuntimeProvider` is mounted; otherwise `null` (e.g. isolated provider tests). */
export function useOptionalStoragePorts(): StoragePorts | null {
    return useOptionalProfileRuntime()?.storagePorts ?? null;
}

/** Same persistence as production when runtime is missing (tests, Storybook). */
export function useResolvedStoragePorts(): StoragePorts {
    return useOptionalStoragePorts() ?? getResolvedStoragePorts();
}

export function useOptionalClientGateway(): AppClientGateway | null {
    return useOptionalProfileRuntime()?.clientGateway ?? null;
}

/** Same unified gateway as production when runtime is missing (tests, Storybook). */
export function useResolvedClientGateway(): AppClientGateway {
    return useOptionalClientGateway() ?? getResolvedClientGateway();
}
