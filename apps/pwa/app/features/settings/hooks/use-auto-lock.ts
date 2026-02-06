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
    const [torStatus, setTorStatus] = useState<'disconnected' | 'starting' | 'connected' | 'error' | 'stopped'>('disconnected');
    const [torLogs, setTorLogs] = useState<string[]>([]);
    const [torRestartRequired, setTorRestartRequired] = useState<boolean>(false);
    const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

    const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;

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
            import('@tauri-apps/api/event').then(({ listen }) => {
                listen('tor-status', (event) => {
                    setTorStatus(event.payload as any);
                }).then(u => unlistenStatus = u);

                listen('tor-log', (event) => {
                    const log = event.payload as string;
                    setTorLogs(prev => [...prev.slice(-99), log]);
                }).then(u => unlistenLog = u);

                listen('tor-error', (event) => {
                    console.error('[Tor Error]', event.payload);
                    setTorStatus('error');
                }).then(u => unlistenError = u);
            });

            // Initial status check
            import('@tauri-apps/api/core').then(({ invoke }) => {
                invoke<boolean>('get_tor_status').then(running => {
                    if (running) setTorStatus('connected');
                });
            });
        }

        return () => {
            window.removeEventListener('privacy-settings-changed', handleSettingsChange);
            if (unlistenStatus) unlistenStatus();
            if (unlistenLog) unlistenLog();
            if (unlistenError) unlistenError();
        };
    }, [isTauri]);

    // Auto-start Tor on mount if enabled
    useEffect(() => {
        if (isTauri && settings.enableTorProxy && torStatus === 'disconnected') {
            import('@tauri-apps/api/core').then(({ invoke }) => {
                invoke('start_tor').catch(console.error);
            });
        }
    }, [isTauri, settings.enableTorProxy]);

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

    // Save settings and manage Tor process
    const updateSettings = useCallback((newSettings: Partial<PrivacySettings>) => {
        const current = PrivacySettingsService.getSettings();
        const updated = { ...current, ...newSettings };

        // Handle Tor process if enableTorProxy changed
        if (isTauri && newSettings.enableTorProxy !== undefined && newSettings.enableTorProxy !== current.enableTorProxy) {
            import('@tauri-apps/api/core').then(({ invoke }) => {
                if (newSettings.enableTorProxy) {
                    invoke('start_tor').catch(console.error);
                } else {
                    invoke('stop_tor').catch(console.error);
                }

                // Persist settings to Rust for startup proxy and flag restart
                invoke('save_tor_settings', {
                    enableTor: newSettings.enableTorProxy,
                    proxyUrl: updated.torProxyUrl
                }).then(() => {
                    setTorRestartRequired(true);
                }).catch(console.error);
            });
        }

        PrivacySettingsService.saveSettings(updated);
        setSettings(updated);
    }, [isTauri]);

    return {
        isLocked,
        settings,
        updateSettings,
        lock,
        unlock,
        lastActivityTime,
        torStatus,
        torLogs,
        torRestartRequired,
        isTauri
    };
}
