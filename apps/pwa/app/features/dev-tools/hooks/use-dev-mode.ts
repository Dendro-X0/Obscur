"use client";

import { useState, useCallback, useEffect } from "react";
import { MockPool } from "../mock-pool";
import { BotEngine } from "../bot-engine";

// Singleton instances for dev mode
let mockPoolInstance: MockPool | null = null;
let botEngineInstance: BotEngine | null = null;

export const getMockPool = () => {
    if (!mockPoolInstance) {
        mockPoolInstance = new MockPool();
    }
    return mockPoolInstance;
};

export const getBotEngine = () => {
    if (!botEngineInstance) {
        botEngineInstance = new BotEngine(getMockPool());
    }
    return botEngineInstance;
};

/**
 * Hook to manage Dev Mode state and logic
 */
export function useDevMode() {
    const [isDevMode, setIsDevMode] = useState(false);

    // Load initial state from localStorage
    useEffect(() => {
        const saved = localStorage.getItem("obscur_dev_mode") === "true";
        if (saved !== isDevMode) {
            queueMicrotask(() => setIsDevMode(saved));
        }
    }, [isDevMode]);

    const toggleDevMode = useCallback(() => {
        const next = !isDevMode;
        setIsDevMode(next);
        localStorage.setItem("obscur_dev_mode", String(next));
        // Force reload to swap pool (easiest way to ensure all hooks reset)
        window.location.reload();
    }, [isDevMode]);

    return {
        isDevMode,
        toggleDevMode,
        mockPool: getMockPool(),
        botEngine: getBotEngine()
    };
}
