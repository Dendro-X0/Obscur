import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PrivacySettingsService, type PrivacySettings } from "../services/privacy-settings-service";
import { getRuntimeCapabilities } from "@/app/features/runtime/runtime-capabilities";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import { listenToNativeEvent } from "@/app/features/runtime/native-event-adapter";

const AUTOLOCK_STORAGE_KEY: string = "obscur.autolock.lastActivity";
const getAutolockStorageKey = (): string => getScopedStorageKey(AUTOLOCK_STORAGE_KEY);
type TorRuntimeState = 'disconnected' | 'starting' | 'connected' | 'error' | 'stopped';
type TorStatusSnapshot = Readonly<{
    state: TorRuntimeState;
    configured: boolean;
    ready: boolean;
    usingExternalInstance: boolean;
    proxyUrl: string;
}>;
type TorLogSnapshot = string[];

/**
 * Hook for managing auto-lock state and inactivity tracking
 * Requirement 1.4: Clipboard safety & session management
 */
export function useAutoLock() {
    const [settings, setSettings] = useState<PrivacySettings>(PrivacySettingsService.getSettings());
    const [isLocked, setIsLocked] = useState<boolean>(() => {
        if (typeof window === "undefined") return false;
        const currentSettings = PrivacySettingsService.getSettings();
        if (currentSettings.autoLockTimeout === 0) return false;
        const stored = sessionStorage.getItem(getAutolockStorageKey());
        if (!stored) return false;
        const elapsed = Date.now() - parseInt(stored, 10);
        return elapsed >= currentSettings.autoLockTimeout * 60 * 1000;
    });
    const [lastActivityTime, setLastActivityTime] = useState<number>(() => {
        if (typeof window === "undefined") return Date.now();
        const stored = sessionStorage.getItem(getAutolockStorageKey());
        return stored ? parseInt(stored, 10) : Date.now();
    });
    const [torStatus, setTorStatus] = useState<TorRuntimeState>('disconnected');
    const [torStatusSnapshot, setTorStatusSnapshot] = useState<TorStatusSnapshot | null>(null);
    const [torLogs, setTorLogs] = useState<string[]>([]);
    const [torRestartRequired, setTorRestartRequired] = useState<boolean>(false);
    const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

    const isTauri = getRuntimeCapabilities().isNativeRuntime;

    // Sync with global settings and handle Tor lifecycle
    useEffect(() => {
        const handleSettingsChange = () => {
            const newSettings = PrivacySettingsService.getSettings();
            setSettings(newSettings);
        };

        window.addEventListener('privacy-settings-changed', handleSettingsChange);

        // Listen for Tor events if in Tauri
        let unlistenStatus: (() => void) | undefined;
        let unlistenLog: (() => void) | undefined;
        let unlistenError: (() => void) | undefined;

        if (isTauri) {
            void listenToNativeEvent<unknown>('tor-status', (event) => {
                const payload: unknown = event.payload;
                if (payload === "disconnected" || payload === "starting" || payload === "connected" || payload === "error" || payload === "stopped") {
                    setTorStatus(payload);
                }
                if (payload === 'connected') {
                    setTorRestartRequired(false);
                }
                void invokeNativeCommand<TorStatusSnapshot>("get_tor_status").then((result) => {
                    if (result.ok && result.value?.state) {
                        setTorStatusSnapshot(result.value);
                    }
                });
            }).then(u => unlistenStatus = u);

            void listenToNativeEvent<string>('tor-log', (event) => {
                const log = event.payload;
                if (typeof log === "string") {
                    setTorLogs(prev => [...prev.slice(-99), log]);
                }
            }).then(u => unlistenLog = u);

            void listenToNativeEvent<unknown>('tor-error', (event) => {
                console.error('[Tor Error]', event.payload);
                setTorStatus('error');
            }).then(u => unlistenError = u);

            // Initial status check
            void invokeNativeCommand<TorStatusSnapshot>("get_tor_status").then((result) => {
                if (result.ok && result.value?.state) {
                    setTorStatus(result.value.state);
                    setTorStatusSnapshot(result.value);
                    if (result.value.ready) {
                        setTorRestartRequired(false);
                    }
                }
            });
            void invokeNativeCommand<TorLogSnapshot>("get_tor_logs").then((result) => {
                if (result.ok && Array.isArray(result.value)) {
                    setTorLogs(result.value.slice(-100));
                }
            });
        }

        return () => {
            window.removeEventListener('privacy-settings-changed', handleSettingsChange);
            if (unlistenStatus) unlistenStatus();
            if (unlistenLog) unlistenLog();
            if (unlistenError) unlistenError();
        };
    }, [isTauri]);

    // Persist lastActivityTime to sessionStorage
    useEffect(() => {
        if (typeof window === "undefined") return;
        sessionStorage.setItem(getAutolockStorageKey(), String(lastActivityTime));
    }, [lastActivityTime]);

    // Auto-start Tor on mount if enabled
    useEffect(() => {
        if (isTauri && settings.enableTorProxy && torStatus === 'disconnected') {
            void invokeNativeCommand("start_tor");
        }
    }, [isTauri, settings.enableTorProxy, torStatus]);

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

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                const now = Date.now();
                const inactivityMs = now - lastActivityTime;
                const timeoutMs = settings.autoLockTimeout * 60 * 1000;

                if (settings.autoLockTimeout > 0 && inactivityMs >= timeoutMs) {
                    lock();
                } else {
                    recordActivity();
                }
            }
        };

        events.forEach((event) => {
            window.addEventListener(event, handleActivity, { passive: true });
        });

        window.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            events.forEach((event) => {
                window.removeEventListener(event, handleActivity);
            });
            window.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [settings.autoLockTimeout, recordActivity, isLocked, lastActivityTime, lock]);

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

    // Save settings and manage Tor process
    const updateSettings = useCallback((newSettings: Partial<PrivacySettings>) => {
        const current = PrivacySettingsService.getSettings();
        const updated = { ...current, ...newSettings };

        // Handle Tor process if enableTorProxy changed
        if (isTauri && newSettings.enableTorProxy !== undefined && newSettings.enableTorProxy !== current.enableTorProxy) {
            void (async () => {
                const persisted = await invokeNativeCommand("save_tor_settings", {
                    enableTor: newSettings.enableTorProxy,
                    proxyUrl: updated.torProxyUrl,
                });
                if (persisted.ok) {
                    setTorRestartRequired(false);
                }

                if (newSettings.enableTorProxy) {
                    setTorStatus("starting");
                    await invokeNativeCommand("start_tor");
                } else {
                    setTorStatus("stopped");
                    await invokeNativeCommand("stop_tor");
                }

                const statusSnapshot = await invokeNativeCommand<TorStatusSnapshot>("get_tor_status");
                if (statusSnapshot.ok && statusSnapshot.value?.state) {
                    setTorStatus(statusSnapshot.value.state);
                    setTorStatusSnapshot(statusSnapshot.value);
                    if (statusSnapshot.value.ready) {
                        setTorRestartRequired(false);
                    }
                }
                const logSnapshot = await invokeNativeCommand<TorLogSnapshot>("get_tor_logs");
                if (logSnapshot.ok && Array.isArray(logSnapshot.value)) {
                    setTorLogs(logSnapshot.value.slice(-100));
                }
            })();
        }

        PrivacySettingsService.saveSettings(updated);
        setSettings(updated);
    }, [isTauri]);

    return useMemo(() => ({
        isLocked,
        settings,
        updateSettings,
        lock,
        unlock,
        lastActivityTime,
        torStatus,
        torStatusSnapshot,
        torLogs,
        torRestartRequired,
        isTauri
    }), [
        isLocked,
        settings,
        updateSettings,
        lock,
        unlock,
        lastActivityTime,
        torStatus,
        torStatusSnapshot,
        torLogs,
        torRestartRequired,
        isTauri
    ]);
}
