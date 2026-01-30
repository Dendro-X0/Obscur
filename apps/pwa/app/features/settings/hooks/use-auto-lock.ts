import { useState, useEffect, useCallback, useRef } from 'react';
import { PrivacySettingsService, type PrivacySettings } from "../services/privacy-settings-service";

/**
 * Hook for managing auto-lock state and inactivity tracking
 * Requirement 1.4: Clipboard safety & session management
 */
export function useAutoLock() {
    const [settings, setSettings] = useState<PrivacySettings>(PrivacySettingsService.getSettings());
    const [isLocked, setIsLocked] = useState<boolean>(false);
    const [lastActivityTime, setLastActivityTime] = useState<number>(() => Date.now());
    const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Sync with global settings
    useEffect(() => {
        const handleSettingsChange = () => {
            setSettings(PrivacySettingsService.getSettings());
        };

        window.addEventListener('privacy-settings-changed', handleSettingsChange);
        return () => window.removeEventListener('privacy-settings-changed', handleSettingsChange);
    }, []);

    // Clear clipboard if allowed and configured
    const clearClipboard = useCallback(async () => {
        if (!settings.clearClipboardOnLock) return;

        try {
            // Check if we have permission to write to clipboard
            // Note: In some browsers/environments this might fail without user gesture
            await navigator.clipboard.writeText('');
            console.log('Clipboard cleared for security');
        } catch (error) {
            console.warn('Failed to clear clipboard:', error);
        }
    }, [settings.clearClipboardOnLock]);

    // Track user activity
    const recordActivity = useCallback(() => {
        setLastActivityTime(Date.now());
    }, []);

    // Lock the app
    const lock = useCallback(() => {
        if (isLocked) return;
        setIsLocked(true);
        void clearClipboard();
    }, [isLocked, clearClipboard]);

    // Unlock the app
    const unlock = useCallback(() => {
        setIsLocked(false);
        setLastActivityTime(Date.now());
    }, []);

    // Set up activity listeners
    useEffect(() => {
        if (settings.autoLockTimeout === 0) {
            return;
        }

        const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];

        const handleActivity = () => {
            if (isLocked) return;
            recordActivity();
        };

        events.forEach((event) => {
            window.addEventListener(event, handleActivity, { passive: true });
        });

        return () => {
            events.forEach((event) => {
                window.removeEventListener(event, handleActivity);
            });
        };
    }, [settings.autoLockTimeout, recordActivity, isLocked]);

    // Set up inactivity timer
    useEffect(() => {
        if (settings.autoLockTimeout === 0 || isLocked) {
            return;
        }

        const checkInactivity = () => {
            const now = Date.now();
            const inactivityMs = now - lastActivityTime;
            const timeoutMs = settings.autoLockTimeout * 60 * 1000;

            if (inactivityMs >= timeoutMs) {
                console.log(`Auto-locking due to ${settings.autoLockTimeout}m inactivity`);
                lock();
            }
        };

        // Check every 10 seconds
        inactivityTimerRef.current = setInterval(checkInactivity, 10000);

        return () => {
            if (inactivityTimerRef.current) {
                clearInterval(inactivityTimerRef.current);
            }
        };
    }, [settings.autoLockTimeout, lastActivityTime, isLocked, lock]);

    // Save settings
    const updateSettings = useCallback((newSettings: Partial<PrivacySettings>) => {
        const current = PrivacySettingsService.getSettings();
        const updated = { ...current, ...newSettings };
        PrivacySettingsService.saveSettings(updated);
        setSettings(updated);
    }, []);

    return {
        isLocked,
        settings,
        updateSettings,
        lock,
        unlock,
        lastActivityTime,
    };
}
