"use client";

/**
 * Relay connection persistence for desktop app
 * Maintains relay connections across app restarts
 */

export interface PersistedRelayState {
  url: string;
  lastConnected: string | null;
  enabled: boolean;
  priority: number;
}

const STORAGE_KEY = "obscur.relay.persistence";

/**
 * Save relay state to persistent storage
 */
export function saveRelayState(relays: PersistedRelayState[]): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(relays));
  } catch (error) {
    console.error("Failed to save relay state:", error);
  }
}

/**
 * Load relay state from persistent storage
 */
export function loadRelayState(): PersistedRelayState[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];

    return data;
  } catch (error) {
    console.error("Failed to load relay state:", error);
    return [];
  }
}

/**
 * Update last connected time for a relay
 */
export function updateRelayLastConnected(url: string): void {
  const relays = loadRelayState();
  const relay = relays.find((r) => r.url === url);

  if (relay) {
    relay.lastConnected = new Date().toISOString();
    saveRelayState(relays);
  }
}

/**
 * Get relays sorted by priority and last connected time
 */
export function getSortedRelays(): PersistedRelayState[] {
  const relays = loadRelayState();

  return relays.sort((a, b) => {
    // First sort by priority
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }

    // Then by last connected time (most recent first)
    if (a.lastConnected && b.lastConnected) {
      return new Date(b.lastConnected).getTime() - new Date(a.lastConnected).getTime();
    }

    if (a.lastConnected) return -1;
    if (b.lastConnected) return 1;

    return 0;
  });
}

/**
 * Clear all persisted relay state
 */
export function clearRelayState(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear relay state:", error);
  }
}
