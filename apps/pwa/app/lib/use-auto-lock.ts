import { useState, useEffect, useCallback, useRef } from 'react';

export interface AutoLockSettings {
    enabled: boolean;
    timeoutMinutes: number; // 0 = never lock
}

export interface AutoLockState {
    isLocked: boolean;
    settings: AutoLockSettings;
    lastActivityTime: number;
}

const STORAGE_KEY = 'obscur-auto-lock-settings';
const DEFAULT_SETTINGS: AutoLockSettings = {
    enabled: true,
    timeoutMinutes: 15,
};

/**
 * Hook for managing auto-lock state and inactivity tracking
 */
export function useAutoLock() {
    const [settings, setSettings] = useState<AutoLockSettings>(DEFAULT_SETTINGS);
    const [isLocked, setIsLocked] = useState<boolean>(false);
    const [lastActivityTime, setLastActivityTime] = useState<number>(Date.now());
    const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Load settings from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored) as AutoLockSettings;
                setSettings(parsed);
            } catch (error) {
                console.error('Failed to parse auto-lock settings:', error);
            }
        }
    }, []);

    // Save settings to localStorage whenever they change
    const updateSettings = useCallback((newSettings: Partial<AutoLockSettings>) => {
        setSettings((prev) => {
            const updated = { ...prev, ...newSettings };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            return updated;
        });
    }, []);

    // Track user activity
    const recordActivity = useCallback(() => {
        setLastActivityTime(Date.now());
    }, []);

    // Lock the app
    const lock = useCallback(() => {
        setIsLocked(true);
    }, []);

    // Unlock the app
    const unlock = useCallback(() => {
        setIsLocked(false);
        setLastActivityTime(Date.now());
    }, []);

    // Set up activity listeners
    useEffect(() => {
        if (!settings.enabled || settings.timeoutMinutes === 0) {
            return;
        }

        const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];

        events.forEach((event) => {
            window.addEventListener(event, recordActivity, { passive: true });
        });

        return () => {
            events.forEach((event) => {
                window.removeEventListener(event, recordActivity);
            });
        };
    }, [settings.enabled, settings.timeoutMinutes, recordActivity]);

    // Set up inactivity timer
    useEffect(() => {
        if (!settings.enabled || settings.timeoutMinutes === 0 || isLocked) {
            return;
        }

        const checkInactivity = () => {
            const now = Date.now();
            const inactivityMs = now - lastActivityTime;
            const timeoutMs = settings.timeoutMinutes * 60 * 1000;

            if (inactivityMs >= timeoutMs) {
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
    }, [settings.enabled, settings.timeoutMinutes, lastActivityTime, isLocked, lock]);

    return {
        isLocked,
        settings,
        updateSettings,
        lock,
        unlock,
        lastActivityTime,
    };
}
