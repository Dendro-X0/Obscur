"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useProfile } from "@/app/features/profile/hooks/use-profile";
import { useAutoLock } from "@/app/features/settings/hooks/use-auto-lock";
import { LockScreen } from "@/app/components/lock-screen";
import { OnboardingWizard } from "@/app/components/onboarding-wizard";
import type { Passphrase } from "@dweb/crypto/passphrase";

interface AuthGatewayProps {
    children: React.ReactNode;
}

/**
 * AuthGateway handles the top-level authentication and security lifecycle.
 * It decides whether to show the Loading splash, the Lock Screen (passphrase),
 * the Onboarding flow (new users), or the main application.
 */
export const AuthGateway: React.FC<AuthGatewayProps> = ({ children }) => {
    const identity = useIdentity();
    const profile = useProfile();
    const { isLocked, unlock: clearInactivityLock } = useAutoLock();
    const [isOnboarding, setIsOnboarding] = useState(false);
    const [isUnlocking, setIsUnlocking] = useState(false);

    const isIdentityLocked = identity.state.status === "locked";
    const hasStoredIdentity = !!identity.state.stored;

    // Track when we should be in onboarding mode
    React.useEffect(() => {
        if (identity.state.status === "locked" && !hasStoredIdentity) {
            setIsOnboarding(true);
        }
        // If we have a stored identity, we only stay in onboarding if we've already started it
    }, [identity.state.status, hasStoredIdentity]);

    const handleUnlock = async (passphrase: string): Promise<boolean> => {
        setIsUnlocking(true);
        try {
            await identity.unlockIdentity({ passphrase: passphrase as Passphrase });
            // Clear the inactivity lock state
            clearInactivityLock();
            return true;
        } catch (error) {
            console.error("[AuthGateway] Unlock failed:", error);
            return false;
        } finally {
            setIsUnlocking(false);
        }
    };

    // 1. Loading state
    if (identity.state.status === "loading") {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-zinc-50 dark:bg-black z-[200]">
                <div className="relative flex h-24 w-24 items-center justify-center">
                    <Image src="/obscur-logo-light.svg" alt="Loading" width={80} height={80} className="animate-pulse dark:hidden" priority />
                    <Image src="/obscur-logo-dark.svg" alt="Loading" width={80} height={80} className="hidden animate-pulse dark:block" priority />
                </div>
            </div>
        );
    }

    // 2. Error state
    if (identity.state.status === "error") {
        return (
            <LockScreen
                publicKeyHex={identity.state.stored?.publicKeyHex}
                isUnlocking={false}
                onUnlock={handleUnlock}
                onForget={identity.forgetIdentity}
                errorMessage={identity.state.error ?? "An unknown error occurred. Please try again."}
            />
        );
    }

    // 3. New User / Onboarding Flow
    if (isOnboarding) {
        return <OnboardingWizard onComplete={() => setIsOnboarding(false)} />;
    }

    // 4. Identity is Unlocked but inactive-lock is active
    // Or Identity is Locked and we have stored data
    const shouldShowLockScreen = isLocked || (isIdentityLocked && hasStoredIdentity);

    if (shouldShowLockScreen) {
        return (
            <LockScreen
                publicKeyHex={identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex}
                isUnlocking={isUnlocking}
                onUnlock={handleUnlock}
                onForget={identity.forgetIdentity}
            />
        );
    }

    // 6. Success - Render Main App
    return <>{children}</>;
};
