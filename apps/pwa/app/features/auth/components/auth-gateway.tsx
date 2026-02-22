"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useProfile } from "@/app/features/profile/hooks/use-profile";
import { useAutoLock } from "@/app/features/settings/hooks/use-auto-lock";
import { LockScreen } from "@/app/components/lock-screen";
import { AuthScreen } from "../components/auth-screen";
import type { Passphrase } from "@dweb/crypto/passphrase";
import { PinLockService } from "@/app/features/auth/services/pin-lock-service";

interface AuthGatewayProps {
    children: React.ReactNode;
}

/**
 * AuthGateway handles the top-level authentication and security lifecycle.
 * It decides whether to show the Loading splash, the Lock Screen (passphrase),
 * the Auth Screen (new users), or the main application.
 */
export const AuthGateway: React.FC<AuthGatewayProps> = ({ children }) => {
    const identity = useIdentity();
    const profile = useProfile();
    const { isLocked, unlock: clearInactivityLock } = useAutoLock();
    const [isOnboarding, setIsOnboarding] = useState(false);
    const [isUnlocking, setIsUnlocking] = useState(false);
    const [hasAttemptedAutoUnlock, setHasAttemptedAutoUnlock] = useState(false);

    const isIdentityLocked = identity.state.status === "locked";
    const hasStoredIdentity = !!identity.state.stored;

    // 1. Handle "Remember Me" Auto-Unlock logic
    useEffect(() => {
        const attemptAutoUnlock = async () => {
            if (isIdentityLocked && hasStoredIdentity && !hasAttemptedAutoUnlock) {
                const isRemembered = localStorage.getItem("obscur_remember_me") === "true";
                const token = localStorage.getItem("obscur_auth_token");

                if (isRemembered && token) {
                    try {
                        console.info("[AuthGateway] Attempting auto-unlock via Remember Me...");
                        const success = await handleUnlock(token);
                        if (success) {
                            console.info("[AuthGateway] Auto-unlock successful.");
                        } else {
                            // If it failed (maybe password changed?), clear it or let user manually unlock
                            console.warn("[AuthGateway] Auto-unlock failed.");
                        }
                    } catch (e) {
                        console.error("[AuthGateway] Auto-unlock error:", e);
                    }
                }
                setHasAttemptedAutoUnlock(true);
            }
        };

        if (identity.state.status !== "loading") {
            void attemptAutoUnlock();
        }
    }, [identity.state.status, isIdentityLocked, hasStoredIdentity, hasAttemptedAutoUnlock]);

    // 2. Track when we should be in onboarding/login mode
    useEffect(() => {
        if (identity.state.status === "locked") {
            setIsOnboarding(true);
        } else if (identity.state.status === "unlocked") {
            setIsOnboarding(false);
        }
    }, [identity.state.status]);

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

    const storedPubkey: string | null = identity.state.stored?.publicKeyHex ?? null;
    const hasPin: boolean = storedPubkey ? PinLockService.hasPin(storedPubkey) : false;

    const handleUnlockPin = async (pin: string): Promise<boolean> => {
        if (!storedPubkey) {
            return false;
        }
        setIsUnlocking(true);
        try {
            const unlocked = await PinLockService.unlockWithPin({ publicKeyHex: storedPubkey, pin });
            if (!unlocked.ok) {
                return false;
            }
            await identity.unlockWithPrivateKeyHex({ privateKeyHex: unlocked.privateKeyHex as any });
            clearInactivityLock();
            return true;
        } catch (e) {
            console.error("[AuthGateway] PIN unlock failed:", e);
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
                hasPin={hasPin}
                onUnlockPin={handleUnlockPin}
                onForget={identity.forgetIdentity}
                errorMessage={identity.state.error ?? "An unknown error occurred. Please try again."}
            />
        );
    }

    // 3. New User Flow
    if (isOnboarding) {
        return <AuthScreen />;
    }

    // 4. Identity is Unlocked but inactive-lock is active
    const shouldShowLockScreen = isLocked;

    if (shouldShowLockScreen) {
        return (
            <LockScreen
                publicKeyHex={identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex}
                isUnlocking={isUnlocking}
                onUnlock={handleUnlock}
                hasPin={hasPin}
                onUnlockPin={handleUnlockPin}
                onForget={identity.forgetIdentity}
            />
        );
    }

    // 6. Success - Render Main App
    return <>{children}</>;
};
