"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useProfile } from "@/app/features/profile/hooks/use-profile";
import { useAutoLock } from "@/app/features/settings/hooks/use-auto-lock";
import { LockScreen } from "@/app/components/lock-screen";
import { AuthScreen } from "../components/auth-screen";
import type { Passphrase } from "@dweb/crypto/passphrase";

const REMEMBER_ME_KEY = "obscur_remember_me";
const AUTH_TOKEN_KEY = "obscur_auth_token";

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
                const isRemembered = localStorage.getItem(REMEMBER_ME_KEY) === "true";
                const token = localStorage.getItem(AUTH_TOKEN_KEY);

                if (isRemembered && token) {
                    try {
                        console.info("[AuthGateway] Attempting auto-unlock via Remember Me...");
                        const success = await handleUnlock(token);
                        if (success) {
                            console.info("[AuthGateway] Auto-unlock successful.");
                        } else {
                            // If it failed (maybe password changed?), clear it or let user manually unlock
                            console.warn("[AuthGateway] Auto-unlock failed.");
                            localStorage.setItem(REMEMBER_ME_KEY, "false");
                            localStorage.removeItem(AUTH_TOKEN_KEY);
                        }
                    } catch (e) {
                        console.error("[AuthGateway] Auto-unlock error:", e);
                        localStorage.setItem(REMEMBER_ME_KEY, "false");
                        localStorage.removeItem(AUTH_TOKEN_KEY);
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

    const { settings } = useAutoLock();

    const handleBiometricUnlock = async (): Promise<boolean> => {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            const success = await invoke<boolean>('request_biometric_auth');
            if (success) {
                // Biometrics successful, clear inactivity lock
                clearInactivityLock();
                return true;
            }
            return false;
        } catch (e) {
            console.error("[AuthGateway] Biometric unlock error:", e);
            return false;
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
                onUnlockBiometric={settings.biometricLockEnabled ? handleBiometricUnlock : undefined}
                onForget={identity.forgetIdentity}
            />
        );
    }

    // 6. Success - Render Main App
    return <>{children}</>;
};
